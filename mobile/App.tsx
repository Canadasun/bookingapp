import 'react-native-screens';
import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useEffect, useState, useCallback, useRef, Component } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform,
  StatusBar, KeyboardAvoidingView, RefreshControl,
} from 'react-native';

// ── Error Boundary ────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; error?: Error }
class ErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[ErrorBoundary]', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center', padding:28, backgroundColor:'#F8F9FA' }}>
        <View style={{ width:60, height:60, borderRadius:30, backgroundColor:'#FEF2F2', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
          <Text style={{ fontSize:28 }}>⚠️</Text>
        </View>
        <Text style={{ fontSize:18, fontWeight:'700', color:'#111827', marginBottom:8, textAlign:'center' }}>Something went wrong</Text>
        <Text style={{ fontSize:13, color:'#6B7280', textAlign:'center', marginBottom:24 }}>
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor:'#7C3AED', paddingHorizontal:24, paddingVertical:12, borderRadius:12 }}
          onPress={() => this.setState({ hasError: false, error: undefined })}>
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:15 }}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
}
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

// ── Constants ────────────────────────────────────────────────────────────────
// Auto-detect the dev machine's IP from Expo's host URI so the app works
// on physical devices without changing .env every time.
function resolveApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_BASE && !process.env.EXPO_PUBLIC_API_BASE.includes('localhost')) {
    return process.env.EXPO_PUBLIC_API_BASE; // explicit non-localhost override wins
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default;
    const hostUri: string | undefined =
      Constants.expoConfig?.hostUri ??        // Expo Go SDK 46+
      Constants.manifest2?.extra?.expoClient?.hostUri ?? // EAS preview
      Constants.manifest?.debuggerHost;       // older SDK
    if (hostUri) {
      const host = hostUri.split(':')[0]; // strip port, keep IP
      return `http://${host}:3001/api`;
    }
  } catch { /* expo-constants not available — fall through */ }
  return process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3001/api';
}

const API_BASE = resolveApiBase();
const BIZ_ID   = process.env.EXPO_PUBLIC_BUSINESS_ID ?? '';
const PURPLE     = '#7C3AED';
const PURPLE_LT  = '#EDE9FE';
const GRAY_50    = '#F9FAFB';
const GRAY_100   = '#F3F4F6';
const GRAY_200   = '#E5E7EB';
const GRAY_400   = '#9CA3AF';
const GRAY_500   = '#6B7280';
const GRAY_700   = '#374151';
const GRAY_900   = '#111827';

// ── Types ────────────────────────────────────────────────────────────────────
interface User { id:string; name:string; email:string; role:string; staffId:string|null; businessId:string|null; mustResetPassword?:boolean }
interface Appointment { id:string; startsAt:string; endsAt:string; status:string; notes?:string; cancelReason?:string; service:{name:string;durationMinutes:number;priceCents:number}; staff:{id:string;user:{name:string}}; client:{id:string;name:string;email:string;phone?:string} }
interface ServiceCategory { id:string; name:string; color:string; sortOrder:number }
interface Service { id:string; name:string; durationMinutes:number; priceCents:number; color:string; active:boolean; description?:string; categoryId?:string|null; category?:ServiceCategory|null }
interface Staff { id:string; user:{name:string}; staffServices:{serviceId:string}[]; bio?:string }
interface Slot { startsAt:string; endsAt:string; startsAtLocal:string }
interface Client { id:string; name:string; email:string; phone?:string; totalVisits?:number; lastVisit?:string }
interface Message { id:string; content:string; fromClient:boolean; read:boolean; createdAt:string }

const STATUS_COLOR: Record<string,string> = {
  PENDING:'#F59E0B', CONFIRMED:'#10B981', CANCELLED:'#EF4444', COMPLETED:'#6B7280', NO_SHOW:'#1F2937',
};

// ── Auth store (token + refresh token, persisted via SecureStore) ────────────
let _token:   string|null = null;
let _refresh: string|null = null;
let _user:    User|null   = null;
const listeners: Set<()=>void> = new Set();
const notify = () => listeners.forEach(fn => fn());
const AUTH_KEY = 'bookingapp.auth.v1';

const setAuth = (token: string|null, user: User|null, refresh?: string|null) => {
  _token = token; _user = user;
  if (refresh !== undefined) _refresh = refresh;
  notify();
};
const getAuth = () => ({ token: _token, user: _user, refresh: _refresh });

// Persist the current session to the device keychain (or clear it). Wrapped in
// try/catch because SecureStore is unavailable on web — there we stay in-memory.
async function persistAuth() {
  try {
    if (_token && _refresh) {
      await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify({ token: _token, refresh: _refresh, user: _user }));
    } else {
      await SecureStore.deleteItemAsync(AUTH_KEY);
    }
  } catch { /* keychain unavailable — session remains in memory only */ }
}

// Load a previously persisted session on cold start. Returns true if a refresh
// token was found (so the caller can refresh for a fresh access token).
async function loadPersistedAuth(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { token?:string; refresh?:string; user?:User };
    setAuth(parsed.token ?? null, parsed.user ?? null, parsed.refresh ?? null);
    return !!parsed.refresh;
  } catch { return false; }
}

// Exchange the stored refresh token (7d) for a fresh access token (15m).
// Called on cold start and on a 401 mid-session. Rotates + re-persists tokens.
async function refreshSession(): Promise<boolean> {
  if (!_refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: _refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json() as { accessToken:string; refreshToken:string; user:User };
    setAuth(data.accessToken, data.user, data.refreshToken);
    await persistAuth();
    return true;
  } catch { return false; }
}

// ── API helpers ──────────────────────────────────────────────────────────────
async function api<T>(path: string, init?: RequestInit, _retried = false): Promise<T> {
  const { token } = getAuth();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  // Access token expired mid-session → refresh once and retry transparently.
  if (res.status === 401 && !_retried && _refresh) {
    if (await refreshSession()) return api<T>(path, init, true);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string,unknown>;
    throw new Error(typeof body.message === 'string' ? body.message : `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Tiny components ──────────────────────────────────────────────────────────
function Pill({ label, color }: { label:string; color:string }) {
  return (
    <View style={[s.pill, {borderColor:color+'33',backgroundColor:color+'15'}]}>
      <Text style={[s.pillText,{color}]}>{label}</Text>
    </View>
  );
}
function PriceTag({ cents }: { cents:number }) {
  return <Text style={s.price}>${(cents/100).toFixed(2)}</Text>;
}

// ── Appointments screen ──────────────────────────────────────────────────────
function AppointmentsScreen() {
  const { user } = getAuth();
  const [apts, setApts]       = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]     = useState<Appointment|null>(null);
  const [acting, setActing]         = useState(false);

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api<{data: Appointment[]}>(`/businesses/${BIZ_ID}/bookings`);
      const all = res.data;
      const filtered = user?.role==='STAFF' && user?.staffId
        ? all.filter(a => a.staff.id === user.staffId)
        : all;
      setApts(filtered.sort((a,b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    } catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.staffId, user?.role]);

  useEffect(() => { load(); }, [load]);

  async function confirm(id:string) {
    setActing(true);
    try { await api(`/businesses/${BIZ_ID}/bookings/${id}/confirm`,{method:'PATCH'}); load(true); setSelected(null); Alert.alert('Done','Appointment confirmed'); }
    catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setActing(false); }
  }
  async function cancel(id:string) {
    Alert.alert('Cancel appointment','Are you sure?',[
      {text:'No',style:'cancel'},
      {text:'Cancel it',style:'destructive',onPress:async()=>{
        setActing(true);
        try { await api(`/businesses/${BIZ_ID}/bookings/${id}/status`,{method:'PATCH',body:JSON.stringify({status:'CANCELLED'})}); load(true); setSelected(null); }
        catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
        finally { setActing(false); }
      }},
    ]);
  }
  async function complete(id:string) {
    setActing(true);
    try { await api(`/businesses/${BIZ_ID}/bookings/${id}/status`,{method:'PATCH',body:JSON.stringify({status:'COMPLETED'})}); load(true); setSelected(null); }
    catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setActing(false); }
  }

  const upcoming = apts.filter(a => ['PENDING','CONFIRMED'].includes(a.status) && new Date(a.startsAt) > new Date());
  const past     = apts.filter(a => !['PENDING','CONFIRMED'].includes(a.status) || new Date(a.startsAt) <= new Date());

  function AptCard({ a }: { a:Appointment }) {
    const d = new Date(a.startsAt);
    return (
      <TouchableOpacity style={s.card} onPress={()=>setSelected(a)} activeOpacity={0.7}>
        <View style={s.cardLeft}>
          <View style={[s.dot, {backgroundColor: STATUS_COLOR[a.status]??GRAY_400}]} />
        </View>
        <View style={s.cardBody}>
          <View style={s.row}>
            <Text style={s.clientName}>{a.client.name}</Text>
            <Pill label={a.status} color={STATUS_COLOR[a.status]??GRAY_400} />
          </View>
          <Text style={s.sub}>{a.service.name} · {a.staff.user.name}</Text>
          <Text style={s.dateText}>
            {d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
            {' · '}
            {d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
          </Text>
        </View>
        <PriceTag cents={a.service.priceCents} />
      </TouchableOpacity>
    );
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PURPLE}/></View>;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Appointments</Text></View>
      <FlatList
        data={[...upcoming,...past]}
        keyExtractor={a=>a.id}
        renderItem={({item})=><AptCard a={item}/>}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={<Text style={s.sectionLabel}>Upcoming ({upcoming.length})</Text>}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No appointments yet</Text></View>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={PURPLE}/>}
        showsVerticalScrollIndicator={false}
      />

      {/* Detail modal */}
      {selected && (
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={()=>setSelected(null)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={()=>{}}>
            <View style={s.sheetHandle}/>
            <Text style={s.sheetTitle}>Appointment</Text>

            <View style={[s.aptBlock, {borderLeftColor: STATUS_COLOR[selected.status]??GRAY_200}]}>
              <Text style={s.aptBlockDate}>
                {new Date(selected.startsAt).toLocaleString('en-US',{weekday:'long',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}
              </Text>
              <Text style={s.aptBlockSub}>{selected.service.name} · {selected.staff.user.name}</Text>
            </View>

            {[
              {l:'Client', v:selected.client.name},
              {l:'Email',  v:selected.client.email},
              {l:'Phone',  v:selected.client.phone||'—'},
              {l:'Status', v:selected.status},
              {l:'Price',  v:`$${(selected.service.priceCents/100).toFixed(2)}`},
            ].map(({l,v})=>(
              <View key={l} style={s.detailRow}>
                <Text style={s.detailLabel}>{l}</Text>
                <Text style={s.detailValue}>{v}</Text>
              </View>
            ))}
            {selected.notes && (
              <View style={s.notesBox}>
                <Text style={s.notesText}>{selected.notes}</Text>
              </View>
            )}

            <View style={s.sheetActions}>
              {selected.status==='PENDING' && <TouchableOpacity style={s.btnPrimary} disabled={acting} onPress={()=>confirm(selected.id)}><Text style={s.btnPrimaryText}>Confirm</Text></TouchableOpacity>}
              {selected.status==='CONFIRMED' && <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>complete(selected.id)}><Text style={s.btnSecondaryText}>Mark completed</Text></TouchableOpacity>}
              {['PENDING','CONFIRMED'].includes(selected.status) && (
                <TouchableOpacity style={s.btnDanger} disabled={acting} onPress={()=>cancel(selected.id)}><Text style={s.btnDangerText}>Cancel</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnGhost} onPress={()=>setSelected(null)}><Text style={s.btnGhostText}>Close</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ── Book screen ──────────────────────────────────────────────────────────────
function BookScreen() {
  type Step = 'service'|'staff'|'date'|'time'|'details'|'done';
  const [step, setStep]               = useState<Step>('service');
  const [services, setServices]       = useState<Service[]>([]);
  const [staffList, setStaffList]     = useState<Staff[]>([]);
  const [slots, setSlots]             = useState<Slot[]>([]);
  const [selectedSvcs, setSelectedSvcs] = useState<Service[]>([]);
  const [staff, setStaff]             = useState<Staff|null|'any'>(null);
  const [date, setDate]               = useState('');
  const [slot, setSlot]               = useState<Slot|null>(null);
  const [form, setForm]               = useState({name:'',email:'',phone:''});
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [bookedId, setBookedId]       = useState('');

  // Build a 21-day date strip from today
  const dateStrip = Array.from({length: 21}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  function fmtStripDate(iso: string) {
    const d = new Date(iso + 'T00:00:00');
    return {
      day: d.toLocaleDateString('en-US', {weekday:'short'}),
      num: d.getDate().toString(),
    };
  }

  function totalDuration(svcs: Service[]) {
    const m = svcs.reduce((s, x) => s + x.durationMinutes, 0);
    const h = Math.floor(m / 60), r = m % 60;
    if (h > 0 && r > 0) return `${h}h ${r}m`;
    return h > 0 ? `${h}h` : `${m}m`;
  }
  function totalPrice(svcs: Service[]) {
    return '$' + (svcs.reduce((s, x) => s + x.priceCents, 0) / 100).toFixed(2);
  }

  useEffect(()=>{
    api<Service[]>(`/businesses/${BIZ_ID}/services`).then(s=>setServices(s.filter(x=>x.active))).catch(()=>{});
  },[]);

  function toggleSvc(sv: Service) {
    setSelectedSvcs(p => p.find(s=>s.id===sv.id) ? p.filter(s=>s.id!==sv.id) : [...p, sv]);
  }

  async function goToStaff() {
    if (selectedSvcs.length === 0) return;
    try {
      const ids = new Set(selectedSvcs.map(s=>s.id));
      const all = await api<Staff[]>(`/businesses/${BIZ_ID}/staff`);
      setStaffList(all.filter(st=>st.staffServices.some(ss=>ids.has(ss.serviceId))));
      setStep('staff');
    } catch { Alert.alert('Error','Could not load staff'); }
  }

  async function pickDate(d: string) {
    setDate(d); setLoading(true); setSlots([]);
    try {
      const staffId = staff && staff !== 'any' ? staff.id : (staffList[0]?.id ?? '');
      const serviceId = selectedSvcs[0]?.id ?? '';
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await api<Slot[]>(`/availability/slots?staffId=${staffId}&serviceId=${serviceId}&startDate=${d}&endDate=${d}&timezone=${tz}`);
      setSlots(data); setStep('time');
    } catch { Alert.alert('Error','Could not load times'); }
    finally { setLoading(false); }
  }

  async function book() {
    if (!form.name||!form.email){ Alert.alert('Required','Name and email are required'); return; }
    if (!policyAccepted){ Alert.alert('Policy required','Please accept the cancellation policy to continue.'); return; }
    setLoading(true);
    try {
      const staffId = staff && staff !== 'any' ? staff.id : (staffList[0]?.id ?? '');
      const client = await api<{id:string}>(`/businesses/${BIZ_ID}/clients`, {
        method:'POST', body: JSON.stringify({name:form.name,email:form.email,phone:form.phone||undefined}),
      });
      const apt = await api<{id:string}>(`/businesses/${BIZ_ID}/bookings`, {
        method:'POST', body: JSON.stringify({staffId, serviceId:selectedSvcs[0].id, clientId:client.id, startsAt:slot!.startsAt}),
      });
      setBookedId(apt.id); setStep('done');
    } catch(e){ Alert.alert('Booking failed', e instanceof Error ? e.message : 'Please try again'); }
    finally { setLoading(false); }
  }

  function reset() {
    setStep('service'); setSelectedSvcs([]); setStaff(null); setDate(''); setSlot(null);
    setForm({name:'',email:'',phone:''}); setPolicyAccepted(false); setBookedId('');
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Book appointment</Text></View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Services (multi-select, grouped by category) ──────── */}
          {step==='service' && <>
            <Text style={s.stepLabel}>Choose services</Text>
            <Text style={[s.sub,{marginBottom:12}]}>Select one or more</Text>
            {(()=>{
              // Build category groups
              const catMap = new Map<string|null, Service[]>();
              const catMeta = new Map<string, ServiceCategory>();
              services.forEach(sv => {
                const key = sv.categoryId ?? null;
                if (!catMap.has(key)) catMap.set(key, []);
                catMap.get(key)!.push(sv);
                if (sv.category) catMeta.set(sv.category.id, sv.category);
              });
              // Sort: named categories first (by sortOrder), then uncategorised
              const groups: Array<{catId:string|null, label:string|null, color:string|null, svcs:Service[]}> = [];
              catMeta.forEach((cat) => {
                const svcs = catMap.get(cat.id) ?? [];
                if (svcs.length) groups.push({ catId: cat.id, label: cat.name, color: cat.color, svcs });
              });
              groups.sort((a, b) => {
                const ao = catMeta.get(a.catId!)?.sortOrder ?? 0;
                const bo = catMeta.get(b.catId!)?.sortOrder ?? 0;
                return ao - bo;
              });
              const uncategorised = catMap.get(null) ?? [];
              if (uncategorised.length) groups.push({ catId: null, label: null, color: null, svcs: uncategorised });

              return groups.map(group => (
                <View key={group.catId ?? '__none__'} style={{marginBottom: 16}}>
                  {group.label && (
                    <View style={{flexDirection:'row', alignItems:'center', marginBottom:8, gap:8}}>
                      <View style={{width:8, height:8, borderRadius:4, backgroundColor: group.color ?? PURPLE}}/>
                      <Text style={[s.sectionLabel, {marginBottom:0}]}>{group.label}</Text>
                    </View>
                  )}
                  {group.svcs.map(sv=>{
                    const sel = selectedSvcs.some(s=>s.id===sv.id);
                    return (
                      <TouchableOpacity key={sv.id} activeOpacity={0.7}
                        style={[s.card, sel && {borderColor:PURPLE,backgroundColor:PURPLE_LT}]}
                        onPress={()=>toggleSvc(sv)}>
                        <View style={[s.svcDot,{backgroundColor:sv.color}]}/>
                        <View style={{flex:1}}>
                          <Text style={[s.clientName, sel&&{color:PURPLE}]}>{sv.name}</Text>
                          {sv.description && <Text style={s.sub}>{sv.description}</Text>}
                          <Text style={s.sub}>{sv.durationMinutes} min</Text>
                        </View>
                        <PriceTag cents={sv.priceCents}/>
                        <View style={[s.checkbox, sel&&s.checkboxActive]}>
                          {sel&&<Ionicons name="checkmark" size={12} color="#fff"/>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ));
            })()}
            {selectedSvcs.length>0&&(
              <View style={s.cartBar}>
                <Text style={s.cartText}>{selectedSvcs.length} service{selectedSvcs.length>1?'s':''} · {totalDuration(selectedSvcs)} · {totalPrice(selectedSvcs)}</Text>
              </View>
            )}
            <TouchableOpacity style={[s.btnPrimary,{marginTop:16,opacity:selectedSvcs.length===0?0.4:1}]} disabled={selectedSvcs.length===0} onPress={goToStaff}>
              <Text style={s.btnPrimaryText}>Continue</Text>
            </TouchableOpacity>
          </>}

          {/* ── Staff ──────────────────────────────────────────────── */}
          {step==='staff' && <>
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep('service')}><Text style={s.backText}>← Back</Text></TouchableOpacity>
            <Text style={s.stepLabel}>Choose a provider</Text>
            <TouchableOpacity style={[s.card, staff==='any'&&{borderColor:PURPLE,backgroundColor:PURPLE_LT}]}
              activeOpacity={0.7} onPress={()=>{setStaff('any');setStep('date');}}>
              <View style={[s.avatar,{backgroundColor:GRAY_100}]}><Text style={{fontSize:18}}>✨</Text></View>
              <View style={{flex:1}}>
                <Text style={s.clientName}>Any available</Text>
                <Text style={s.sub}>Best availability</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={GRAY_400}/>
            </TouchableOpacity>
            {staffList.length===0&&<Text style={[s.emptyText,{marginTop:8}]}>No staff available for selected services</Text>}
            {staffList.map(st=>(
              <TouchableOpacity key={st.id} style={[s.card, (staff&&staff!=='any'&&(staff as Staff).id===st.id)&&{borderColor:PURPLE,backgroundColor:PURPLE_LT}]}
                activeOpacity={0.7} onPress={()=>{setStaff(st);setStep('date');}}>
                <View style={s.avatar}><Text style={s.avatarText}>{st.user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</Text></View>
                <View style={{flex:1}}>
                  <Text style={s.clientName}>{st.user.name}</Text>
                  {st.bio&&<Text style={s.sub}>{st.bio}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={16} color={GRAY_400}/>
              </TouchableOpacity>
            ))}
          </>}

          {/* ── Date strip ─────────────────────────────────────────── */}
          {step==='date' && <>
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep('staff')}><Text style={s.backText}>← Back</Text></TouchableOpacity>
            <Text style={s.stepLabel}>Pick a date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}}>
              {dateStrip.map(d=>{
                const {day,num} = fmtStripDate(d);
                const sel = date===d;
                return (
                  <TouchableOpacity key={d} activeOpacity={0.7}
                    style={[s.datePill, sel&&s.datePillActive]}
                    onPress={()=>pickDate(d)}>
                    <Text style={[s.datePillDay, sel&&{color:'#fff'}]}>{day}</Text>
                    <Text style={[s.datePillNum, sel&&{color:'#fff'}]}>{num}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {loading&&<ActivityIndicator color={PURPLE} style={{marginTop:20}}/>}
          </>}

          {/* ── Time slots ─────────────────────────────────────────── */}
          {step==='time' && <>
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep('date')}><Text style={s.backText}>← Back</Text></TouchableOpacity>
            <Text style={s.stepLabel}>Available times</Text>
            <Text style={[s.sub,{marginBottom:12}]}>{new Date(date+'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</Text>
            {loading&&<ActivityIndicator color={PURPLE} style={{marginTop:20}}/>}
            {!loading&&slots.length===0&&<Text style={s.emptyText}>No availability on this date — try another</Text>}
            <View style={s.slotGrid}>
              {slots.map(sl=>(
                <TouchableOpacity key={sl.startsAt} style={[s.slotBtn, slot?.startsAt===sl.startsAt&&s.slotBtnActive]}
                  onPress={()=>{setSlot(sl);setStep('details');}}>
                  <Text style={[s.slotText, slot?.startsAt===sl.startsAt&&s.slotTextActive]}>
                    {new Date(sl.startsAtLocal).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}

          {/* ── Details + Policy ───────────────────────────────────── */}
          {step==='details' && <>
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep('time')}><Text style={s.backText}>← Back</Text></TouchableOpacity>
            <View style={s.summaryBox}>
              <Text style={s.summaryTitle}>{selectedSvcs.map(s=>s.name).join(' + ')}</Text>
              <Text style={s.summarySub}>
                {staff&&staff!=='any'?(staff as Staff).user.name:'Any available'} · {date.slice(5).replace('-','/')} at {slot&&new Date(slot.startsAtLocal).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
              </Text>
              <Text style={[s.summarySub,{marginTop:4}]}>{totalDuration(selectedSvcs)} · {totalPrice(selectedSvcs)}</Text>
            </View>
            {[
              {k:'name',   label:'Full name *',    type:'default' as const},
              {k:'email',  label:'Email *',         type:'email-address' as const},
              {k:'phone',  label:'Phone (optional)',type:'phone-pad' as const},
            ].map(({k,label,type})=>(
              <View key={k} style={{marginBottom:12}}>
                <Text style={s.fieldLabel}>{label}</Text>
                <TextInput style={s.input} placeholder={label} placeholderTextColor={GRAY_400}
                  keyboardType={type} autoCapitalize={k==='name'?'words':'none'}
                  value={form[k as keyof typeof form]}
                  onChangeText={v=>setForm(p=>({...p,[k]:v}))}/>
              </View>
            ))}
            {/* Cancellation policy */}
            <View style={s.policyBox}>
              <Text style={s.policyTitle}>Cancellation Policy</Text>
              <Text style={s.policyText}>Appointments cancelled within 24 hours may be subject to a cancellation fee. No-shows may be charged a fee. Please contact us at least 24 hours in advance if you need to cancel or reschedule.</Text>
              <TouchableOpacity style={s.policyCheck} activeOpacity={0.7} onPress={()=>setPolicyAccepted(p=>!p)}>
                <View style={[s.checkbox, policyAccepted&&s.checkboxActive]}>
                  {policyAccepted&&<Ionicons name="checkmark" size={12} color="#fff"/>}
                </View>
                <Text style={s.policyCheckText}>I agree to the cancellation policy</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.btnPrimary,{opacity:loading||!policyAccepted?0.5:1}]} disabled={loading||!policyAccepted} onPress={book}>
              <Text style={s.btnPrimaryText}>{loading?'Booking…':'Confirm booking'}</Text>
            </TouchableOpacity>
          </>}

          {/* ── Done ───────────────────────────────────────────────── */}
          {step==='done' && (
            <View style={s.doneBox}>
              <View style={s.doneIcon}><Ionicons name="checkmark" size={36} color="#fff"/></View>
              <Text style={s.doneTitle}>You're booked!</Text>
              <Text style={s.doneSub}>Confirmation sent to {form.email}</Text>
              <Text style={s.doneRef}>Ref #{bookedId.slice(-8).toUpperCase()}</Text>
              <TouchableOpacity style={[s.btnPrimary,{marginTop:24}]} onPress={reset}>
                <Text style={s.btnPrimaryText}>Book another</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Clients screen ───────────────────────────────────────────────────────────
function ClientsScreen({ onMessage }: { onMessage:(c:Client)=>void }) {
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent=false, q='') => {
    if (!silent) setLoading(true);
    try {
      const res = await api<{data: Client[]}>(`/businesses/${BIZ_ID}/clients${q?`?search=${encodeURIComponent(q)}`:''}`);
      setClients(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{
    const t = setTimeout(()=>load(true,search),400);
    return ()=>clearTimeout(t);
  },[search, load]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PURPLE}/></View>;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Clients</Text></View>
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={GRAY_400} style={{marginRight:8}}/>
        <TextInput style={s.searchInput} placeholder="Search by name, email…"
          placeholderTextColor={GRAY_400} value={search} onChangeText={setSearch}/>
      </View>
      <FlatList
        data={clients}
        keyExtractor={c=>c.id}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No clients found</Text></View>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true,search);}} tintColor={PURPLE}/>}
        showsVerticalScrollIndicator={false}
        renderItem={({item:c})=>(
          <View style={s.card}>
            <View style={s.avatar}><Text style={s.avatarText}>{c.name.slice(0,2).toUpperCase()}</Text></View>
            <View style={{flex:1}}>
              <Text style={s.clientName}>{c.name}</Text>
              <Text style={s.sub}>{c.email}</Text>
              {c.phone&&<Text style={s.sub}>{c.phone}</Text>}
              {c.totalVisits!==undefined&&<Text style={s.sub}>{c.totalVisits} visit{c.totalVisits!==1?'s':''}</Text>}
            </View>
            <TouchableOpacity style={s.msgBtn} onPress={()=>onMessage(c)}>
              <Ionicons name="chatbubble-outline" size={18} color={PURPLE}/>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

// ── Messages screen ──────────────────────────────────────────────────────────
function MessagesScreen({ initialClient, onClearClient }: { initialClient:Client|null; onClearClient:()=>void }) {
  const [threads, setThreads]   = useState<Array<{clientId:string;client:{name:string;email:string};lastMessage:string;fromClient:boolean;read:boolean;createdAt:string}>>([]);
  const [selected, setSelected] = useState<Client|null>(null);
  const [msgs, setMsgs]         = useState<Message[]>([]);
  const [reply, setReply]       = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const loadThreads = useCallback(async () => {
    try { setThreads(await api(`/businesses/${BIZ_ID}/messages`)); }
    catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(()=>{ loadThreads(); },[loadThreads]);

  useEffect(()=>{
    if (initialClient) { openThread(initialClient); onClearClient(); }
  },[initialClient]);

  async function openThread(c:Client) {
    setSelected(c);
    try {
      const data = await api<Message[]>(`/businesses/${BIZ_ID}/clients/${c.id}/messages`);
      setMsgs(data);
      await api(`/businesses/${BIZ_ID}/clients/${c.id}/messages/read`,{method:'PATCH'});
    } catch {}
    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:false}),100);
  }

  async function send() {
    if (!reply.trim()||!selected) return;
    setSending(true);
    try {
      await api(`/businesses/${BIZ_ID}/clients/${selected.id}/messages/reply`,{
        method:'POST', body:JSON.stringify({content:reply.trim()}),
      });
      setReply('');
      const data = await api<Message[]>(`/businesses/${BIZ_ID}/clients/${selected.id}/messages`);
      setMsgs(data);
      setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),50);
    } catch(e){ Alert.alert('Error','Could not send message'); }
    finally { setSending(false); }
  }

  if (selected) return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>{setSelected(null);loadThreads();}} style={{marginRight:12}}>
          <Ionicons name="arrow-back" size={22} color={GRAY_700}/>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{selected.name}</Text>
      </View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={88}>
        <ScrollView ref={scrollRef} contentContainerStyle={{padding:16}} showsVerticalScrollIndicator={false}>
          {msgs.length===0&&<Text style={[s.emptyText,{textAlign:'center',marginTop:40}]}>No messages yet</Text>}
          {msgs.map(m=>(
            <View key={m.id} style={[s.bubble, m.fromClient?s.bubbleLeft:s.bubbleRight]}>
              <Text style={[s.bubbleText, m.fromClient?s.bubbleTextLeft:s.bubbleTextRight]}>{m.content}</Text>
              <Text style={s.bubbleTime}>{new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.composeRow}>
          <TextInput style={s.composeInput} placeholder="Type a message…" placeholderTextColor={GRAY_400}
            value={reply} onChangeText={setReply} multiline returnKeyType="send" onSubmitEditing={send}/>
          <TouchableOpacity style={[s.sendBtn, (!reply.trim()||sending)&&{opacity:0.4}]}
            disabled={!reply.trim()||sending} onPress={send}>
            <Ionicons name="send" size={18} color="#fff"/>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Messages</Text></View>
      {loading?<ActivityIndicator color={PURPLE} style={{marginTop:40}}/>:(
        <FlatList
          data={threads}
          keyExtractor={t=>t.clientId}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No messages yet</Text></View>}
          showsVerticalScrollIndicator={false}
          renderItem={({item:t})=>(
            <TouchableOpacity style={s.card} activeOpacity={0.7}
              onPress={()=>openThread({id:t.clientId,...t.client})}>
              <View style={s.avatar}><Text style={s.avatarText}>{t.client.name.slice(0,2).toUpperCase()}</Text></View>
              <View style={{flex:1}}>
                <View style={s.row}>
                  <Text style={s.clientName}>{t.client.name}</Text>
                  {t.fromClient&&!t.read&&<View style={s.unreadDot}/>}
                </View>
                <Text style={s.sub} numberOfLines={1}>{t.lastMessage}</Text>
              </View>
              <Text style={s.msgTime}>{new Date(t.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── More/Settings screen ─────────────────────────────────────────────────────
function MoreScreen({ onLogout }: { onLogout:()=>void }) {
  const { user } = getAuth();
  const rows = [
    { label:'Staff', icon:'people-outline' as const, onPress:()=>Alert.alert('Staff','Staff management is available on the web dashboard.') },
    { label:'Services', icon:'cut-outline' as const, onPress:()=>Alert.alert('Services','Service management is available on the web dashboard.') },
    { label:'Settings', icon:'settings-outline' as const, onPress:()=>Alert.alert('Settings','Full settings are available on the web dashboard.') },
    { label:'Booking link', icon:'link-outline' as const, onPress:()=>Alert.alert('Booking link',`${API_BASE.replace('/api','')}/book`) },
  ];
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>More</Text></View>
      <View style={s.listContent}>
        {user&&(
          <View style={s.profileCard}>
            <View style={s.avatarLg}><Text style={s.avatarLgText}>{user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</Text></View>
            <View>
              <Text style={s.profileName}>{user.name}</Text>
              <Text style={s.profileRole}>{user.role}</Text>
            </View>
          </View>
        )}
        <View style={s.menuCard}>
          {rows.map((r,i)=>(
            <TouchableOpacity key={r.label} style={[s.menuRow, i<rows.length-1&&s.menuRowBorder]} onPress={r.onPress} activeOpacity={0.7}>
              <View style={s.menuIcon}><Ionicons name={r.icon} size={20} color={PURPLE}/></View>
              <Text style={s.menuLabel}>{r.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={GRAY_400}/>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={()=>{
          Alert.alert('Sign out','Are you sure?',[{text:'Cancel',style:'cancel'},{text:'Sign out',style:'destructive',onPress:onLogout}]);
        }}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{marginRight:8}}/>
          <Text style={{color:'#EF4444',fontWeight:'600',fontSize:15}}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin:(t:string,r:string,u:User)=>void }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  async function login() {
    if (!email||!password) return;
    setLoading(true);
    try {
      const res = await api<{accessToken:string;refreshToken:string;user:User}>('/auth/login',{
        method:'POST', body:JSON.stringify({email,password}),
      });
      onLogin(res.accessToken, res.refreshToken, res.user);
    } catch {
      Alert.alert('Sign in failed','Check your email and password and try again.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={s.loginLogo}>
          <View style={s.logoIcon}><Ionicons name="calendar" size={28} color="#fff"/></View>
          <Text style={s.logoText}>BookingApp</Text>
        </View>
        <Text style={s.loginTitle}>Sign in</Text>
        <Text style={s.loginSub}>Enter your credentials to continue</Text>

        <Text style={s.fieldLabel}>Email</Text>
        <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor={GRAY_400}
          keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail}/>

        <Text style={[s.fieldLabel,{marginTop:12}]}>Password</Text>
        <View style={{position:'relative'}}>
          <TextInput style={s.input} placeholder="Password" placeholderTextColor={GRAY_400}
            secureTextEntry={!showPw} value={password} onChangeText={setPassword} onSubmitEditing={login}/>
          <TouchableOpacity style={s.pwToggle} onPress={()=>setShowPw(p=>!p)}>
            <Ionicons name={showPw?'eye-off-outline':'eye-outline'} size={18} color={GRAY_400}/>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.btnPrimary,{marginTop:24}]} disabled={loading||!email||!password} onPress={login}>
          {loading?<ActivityIndicator color="#fff"/>:<Text style={s.btnPrimaryText}>Sign in</Text>}
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Forced password reset (first login for invited staff / bootstrap admin) ──
function ChangePasswordScreen({ onDone }: { onDone:()=>void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (next.length < 8) { Alert.alert('Weak password','New password must be at least 8 characters.'); return; }
    if (next !== confirm) { Alert.alert('Mismatch','New passwords do not match.'); return; }
    setLoading(true);
    try {
      await api('/auth/change-password', { method:'POST', body:JSON.stringify({ currentPassword: current, newPassword: next }) });
      Alert.alert('Password updated','Please sign in again with your new password.', [{ text:'OK', onPress:onDone }]);
    } catch (e) {
      Alert.alert('Could not change password', e instanceof Error ? e.message : 'Try again.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={s.loginLogo}>
          <View style={s.logoIcon}><Ionicons name="lock-closed" size={26} color="#fff"/></View>
          <Text style={s.logoText}>BookingApp</Text>
        </View>
        <Text style={s.loginTitle}>Set a new password</Text>
        <Text style={s.loginSub}>For your security, choose a new password before continuing.</Text>

        <Text style={s.fieldLabel}>Current password</Text>
        <TextInput style={s.input} placeholder="Current / temporary password" placeholderTextColor={GRAY_400}
          secureTextEntry value={current} onChangeText={setCurrent}/>

        <Text style={[s.fieldLabel,{marginTop:12}]}>New password</Text>
        <TextInput style={s.input} placeholder="At least 8 characters" placeholderTextColor={GRAY_400}
          secureTextEntry value={next} onChangeText={setNext}/>

        <Text style={[s.fieldLabel,{marginTop:12}]}>Confirm new password</Text>
        <TextInput style={s.input} placeholder="Re-enter new password" placeholderTextColor={GRAY_400}
          secureTextEntry value={confirm} onChangeText={setConfirm} onSubmitEditing={submit}/>

        <TouchableOpacity style={[s.btnPrimary,{marginTop:24}]} disabled={loading||!current||!next||!confirm} onPress={submit}>
          {loading?<ActivityIndicator color="#fff"/>:<Text style={s.btnPrimaryText}>Update password</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Tab navigator ────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

export default function App() {
  const [token, setToken]             = useState<string|null>(null);
  const [user, setUser]               = useState<User|null>(null);
  const [msgClient, setMsgClient]     = useState<Client|null>(null);
  const [_, forceRender]              = useState(0);
  const [booting, setBooting]         = useState(true);

  useEffect(()=>{ const unsub=()=>forceRender(n=>n+1); listeners.add(unsub); return ()=>{ listeners.delete(unsub); }; },[]);

  // Restore a persisted session on cold start. The stored access token may be
  // expired (15m), so refresh it via the saved refresh token (7d). If that
  // fails, clear the session and fall through to the login screen.
  useEffect(()=>{ (async()=>{
    const hadRefresh = await loadPersistedAuth();
    if (hadRefresh) {
      const ok = await refreshSession();
      if (!ok) { setAuth(null,null,null); await persistAuth(); }
    }
    const a = getAuth(); setToken(a.token); setUser(a.user);
    setBooting(false);
  })(); },[]);

  function handleLogin(t:string, r:string, u:User) { setAuth(t,u,r); setToken(t); setUser(u); persistAuth(); }
  function handleLogout() { setAuth(null,null,null); setToken(null); setUser(null); persistAuth(); }

  if (booting) return (
    <ErrorBoundary>
      <SafeAreaView style={s.screen}>
        <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
          <ActivityIndicator color={PURPLE}/>
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );

  if (!token) return (
    <ErrorBoundary>
      <LoginScreen onLogin={handleLogin}/>
    </ErrorBoundary>
  );

  // Forced first-login password reset (staff invites + bootstrap admin).
  if (user?.mustResetPassword) return (
    <ErrorBoundary>
      <ChangePasswordScreen onDone={handleLogout}/>
    </ErrorBoundary>
  );

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff"/>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: PURPLE,
            tabBarInactiveTintColor: GRAY_400,
            tabBarStyle: { backgroundColor:'#fff', borderTopColor:GRAY_100, height:60, paddingBottom:8 },
            tabBarLabelStyle: { fontSize:11, fontWeight:'600' },
            tabBarIcon: ({ color, size }) => {
              const icons: Record<string,string> = {
                Appointments:'calendar-outline', Book:'add-circle-outline',
                Clients:'people-outline', Messages:'chatbubbles-outline', More:'menu-outline',
              };
              return <Ionicons name={(icons[route.name]??'ellipse-outline') as any} size={size} color={color}/>;
            },
          })}
        >
          <Tab.Screen name="Appointments" component={AppointmentsScreen}/>
          <Tab.Screen name="Book" component={BookScreen}/>
          <Tab.Screen name="Clients">
            {()=><ClientsScreen onMessage={c=>setMsgClient(c)}/>}
          </Tab.Screen>
          <Tab.Screen name="Messages">
            {()=><MessagesScreen initialClient={msgClient} onClearClient={()=>setMsgClient(null)}/>}
          </Tab.Screen>
          <Tab.Screen name="More">
            {()=><MoreScreen onLogout={handleLogout}/>}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:          { flex:1, backgroundColor:'#fff' },
  center:          { flex:1, alignItems:'center', justifyContent:'center' },
  header:          { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:GRAY_100, backgroundColor:'#fff' },
  headerTitle:     { fontSize:17, fontWeight:'700', color:GRAY_900, flex:1 },
  listContent:     { padding:16 },
  sectionLabel:    { fontSize:11, fontWeight:'700', color:GRAY_400, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8, marginTop:4 },
  emptyText:       { color:GRAY_400, fontSize:14, textAlign:'center', marginTop:20 },
  row:             { flexDirection:'row', alignItems:'center', gap:8 },
  card:            { backgroundColor:'#fff', borderRadius:14, borderWidth:1, borderColor:GRAY_100, padding:14, marginBottom:10, flexDirection:'row', alignItems:'center', gap:12, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, shadowOffset:{width:0,height:1}, elevation:1 },
  cardLeft:        { width:16, alignItems:'center' },
  cardBody:        { flex:1 },
  dot:             { width:10, height:10, borderRadius:5 },
  clientName:      { fontSize:14, fontWeight:'600', color:GRAY_900 },
  sub:             { fontSize:12, color:GRAY_500, marginTop:2 },
  dateText:        { fontSize:12, color:PURPLE, fontWeight:'500', marginTop:3 },
  price:           { fontSize:13, fontWeight:'700', color:GRAY_700 },
  pill:            { paddingHorizontal:8, paddingVertical:3, borderRadius:99, borderWidth:1 },
  pillText:        { fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.5 },
  // Detail sheet
  overlay:         { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end', zIndex:99 },
  sheet:           { backgroundColor:'#fff', borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, paddingBottom:Platform.OS==='ios'?34:20, maxHeight:'90%' },
  sheetHandle:     { width:40, height:4, backgroundColor:GRAY_200, borderRadius:99, alignSelf:'center', marginBottom:16 },
  sheetTitle:      { fontSize:18, fontWeight:'700', color:GRAY_900, marginBottom:16 },
  aptBlock:        { borderLeftWidth:3, paddingLeft:12, marginBottom:16 },
  aptBlockDate:    { fontSize:14, fontWeight:'600', color:GRAY_900 },
  aptBlockSub:     { fontSize:13, color:GRAY_500, marginTop:2 },
  detailRow:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:7, borderBottomWidth:1, borderBottomColor:GRAY_100 },
  detailLabel:     { fontSize:13, color:GRAY_400 },
  detailValue:     { fontSize:13, fontWeight:'600', color:GRAY_900 },
  notesBox:        { backgroundColor:GRAY_50, borderRadius:10, padding:12, marginTop:12 },
  notesText:       { fontSize:13, color:GRAY_700 },
  sheetActions:    { gap:8, marginTop:20 },
  btnPrimary:      { backgroundColor:PURPLE, borderRadius:12, padding:14, alignItems:'center' },
  btnPrimaryText:  { color:'#fff', fontWeight:'700', fontSize:15 },
  btnSecondary:    { backgroundColor:GRAY_100, borderRadius:12, padding:14, alignItems:'center' },
  btnSecondaryText:{ color:GRAY_700, fontWeight:'600', fontSize:15 },
  btnDanger:       { backgroundColor:'#FEF2F2', borderRadius:12, borderWidth:1, borderColor:'#FCA5A5', padding:14, alignItems:'center' },
  btnDangerText:   { color:'#DC2626', fontWeight:'600', fontSize:15 },
  btnGhost:        { borderRadius:12, padding:12, alignItems:'center' },
  btnGhostText:    { color:GRAY_500, fontSize:14 },
  // Book
  stepLabel:       { fontSize:16, fontWeight:'700', color:GRAY_900, marginBottom:6 },
  backBtn:         { marginBottom:12 },
  backText:        { color:PURPLE, fontSize:14, fontWeight:'500' },
  svcDot:          { width:12, height:12, borderRadius:99, marginRight:4 },
  avatar:          { width:40, height:40, borderRadius:20, backgroundColor:PURPLE_LT, alignItems:'center', justifyContent:'center' },
  avatarText:      { color:PURPLE, fontWeight:'700', fontSize:13 },
  checkbox:        { width:20, height:20, borderRadius:10, borderWidth:2, borderColor:GRAY_200, alignItems:'center', justifyContent:'center', marginLeft:8 },
  checkboxActive:  { borderColor:PURPLE, backgroundColor:PURPLE },
  cartBar:         { backgroundColor:PURPLE_LT, borderRadius:12, padding:12, marginTop:8, alignItems:'center' },
  cartText:        { color:PURPLE, fontWeight:'700', fontSize:14 },
  datePill:        { width:52, marginRight:8, borderRadius:12, borderWidth:1, borderColor:GRAY_200, backgroundColor:'#fff', paddingVertical:10, alignItems:'center' },
  datePillActive:  { backgroundColor:PURPLE, borderColor:PURPLE },
  datePillDay:     { fontSize:11, color:GRAY_500, fontWeight:'600' },
  datePillNum:     { fontSize:17, fontWeight:'700', color:GRAY_900, marginTop:2 },
  slotGrid:        { flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:8 },
  slotBtn:         { borderWidth:1, borderColor:GRAY_200, borderRadius:10, paddingVertical:10, paddingHorizontal:14, backgroundColor:'#fff' },
  slotBtnActive:   { borderColor:PURPLE, backgroundColor:PURPLE_LT },
  slotText:        { color:GRAY_700, fontSize:13, fontWeight:'500' },
  slotTextActive:  { color:PURPLE, fontWeight:'700' },
  summaryBox:      { backgroundColor:PURPLE_LT, borderRadius:14, padding:14, marginBottom:20 },
  summaryTitle:    { fontSize:15, fontWeight:'700', color:PURPLE },
  summarySub:      { fontSize:13, color:'#5B21B6', marginTop:3 },
  fieldLabel:      { fontSize:13, fontWeight:'600', color:GRAY_700, marginBottom:6 },
  input:           { borderWidth:1, borderColor:GRAY_200, borderRadius:12, padding:13, fontSize:15, color:GRAY_900, backgroundColor:'#fff' },
  policyBox:       { backgroundColor:GRAY_50, borderRadius:14, borderWidth:1, borderColor:GRAY_200, padding:14, marginBottom:16 },
  policyTitle:     { fontSize:13, fontWeight:'700', color:GRAY_900, marginBottom:6 },
  policyText:      { fontSize:12, color:GRAY_500, lineHeight:18 },
  policyCheck:     { flexDirection:'row', alignItems:'center', marginTop:12 },
  policyCheckText: { fontSize:13, color:GRAY_700, fontWeight:'500', marginLeft:10, flex:1 },
  doneBox:         { alignItems:'center', paddingTop:40 },
  doneIcon:        { width:72, height:72, borderRadius:36, backgroundColor:PURPLE, alignItems:'center', justifyContent:'center', marginBottom:16 },
  doneTitle:       { fontSize:22, fontWeight:'700', color:GRAY_900 },
  doneSub:         { fontSize:14, color:GRAY_500, marginTop:6 },
  doneRef:         { fontSize:12, color:GRAY_400, marginTop:4, fontFamily:Platform.OS==='ios'?'Menlo':'monospace' },
  // Clients
  searchBox:       { flexDirection:'row', alignItems:'center', margin:16, marginBottom:0, padding:12, backgroundColor:GRAY_50, borderRadius:12, borderWidth:1, borderColor:GRAY_200 },
  searchInput:     { flex:1, fontSize:14, color:GRAY_900 },
  msgBtn:          { padding:8 },
  // Messages
  bubble:          { maxWidth:'78%', borderRadius:14, padding:12, marginBottom:8 },
  bubbleLeft:      { backgroundColor:GRAY_100, alignSelf:'flex-start', borderBottomLeftRadius:4 },
  bubbleRight:     { backgroundColor:PURPLE, alignSelf:'flex-end', borderBottomRightRadius:4 },
  bubbleText:      { fontSize:14 },
  bubbleTextLeft:  { color:GRAY_900 },
  bubbleTextRight: { color:'#fff' },
  bubbleTime:      { fontSize:10, color:GRAY_400, marginTop:4, alignSelf:'flex-end' },
  composeRow:      { flexDirection:'row', alignItems:'flex-end', padding:12, borderTopWidth:1, borderTopColor:GRAY_100, gap:8, backgroundColor:'#fff' },
  composeInput:    { flex:1, borderWidth:1, borderColor:GRAY_200, borderRadius:20, paddingHorizontal:16, paddingVertical:10, fontSize:14, color:GRAY_900, maxHeight:100 },
  sendBtn:         { width:42, height:42, borderRadius:21, backgroundColor:PURPLE, alignItems:'center', justifyContent:'center' },
  unreadDot:       { width:8, height:8, borderRadius:4, backgroundColor:PURPLE, marginLeft:6 },
  msgTime:         { fontSize:11, color:GRAY_400 },
  // More
  profileCard:     { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:GRAY_100, padding:16, marginBottom:16, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, shadowOffset:{width:0,height:1} },
  avatarLg:        { width:52, height:52, borderRadius:26, backgroundColor:PURPLE_LT, alignItems:'center', justifyContent:'center' },
  avatarLgText:    { color:PURPLE, fontWeight:'700', fontSize:18 },
  profileName:     { fontSize:16, fontWeight:'700', color:GRAY_900 },
  profileRole:     { fontSize:13, color:GRAY_500, textTransform:'capitalize', marginTop:2 },
  menuCard:        { backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:GRAY_100, marginBottom:16, overflow:'hidden', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, shadowOffset:{width:0,height:1} },
  menuRow:         { flexDirection:'row', alignItems:'center', padding:16, gap:12 },
  menuRowBorder:   { borderBottomWidth:1, borderBottomColor:GRAY_100 },
  menuIcon:        { width:36, height:36, borderRadius:10, backgroundColor:PURPLE_LT, alignItems:'center', justifyContent:'center' },
  menuLabel:       { flex:1, fontSize:15, fontWeight:'500', color:GRAY_900 },
  logoutBtn:       { flexDirection:'row', alignItems:'center', justifyContent:'center', padding:16, backgroundColor:'#FEF2F2', borderRadius:14, borderWidth:1, borderColor:'#FCA5A5' },
  // Login
  loginWrap:       { flex:1, padding:28, justifyContent:'center' },
  loginLogo:       { flexDirection:'row', alignItems:'center', gap:12, marginBottom:32 },
  logoIcon:        { width:48, height:48, borderRadius:14, backgroundColor:PURPLE, alignItems:'center', justifyContent:'center' },
  logoText:        { fontSize:24, fontWeight:'800', color:GRAY_900, letterSpacing:-0.5 },
  loginTitle:      { fontSize:28, fontWeight:'800', color:GRAY_900, letterSpacing:-0.5 },
  loginSub:        { fontSize:14, color:GRAY_500, marginTop:4, marginBottom:24 },
  pwToggle:        { position:'absolute', right:14, top:14 },
  // Search
  unreadCount:     { fontSize:11, color:'#fff', backgroundColor:PURPLE, borderRadius:99, paddingHorizontal:6, paddingVertical:1, fontWeight:'700' },
});
