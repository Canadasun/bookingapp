import 'react-native-screens';
import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useEffect, useState, useCallback, useRef, Component } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform,
  StatusBar, KeyboardAvoidingView, RefreshControl, BackHandler, Linking,
} from 'react-native';

// Public marketing/legal site (where Terms & Privacy live).
const WEB_URL = 'https://www.pulseappointments.com';

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
          style={{ backgroundColor:'#E9A23C', paddingHorizontal:24, paddingVertical:12, borderRadius:12 }}
          onPress={() => this.setState({ hasError: false, error: undefined })}>
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:15 }}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
}
import { NavigationContainer, useNavigation } from '@react-navigation/native';
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
const BRAND     = '#E9A23C'; // amber/gold brand
const BRAND_LT  = '#FBE8CF'; // light tint for selected backgrounds
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

// The active business is the one the signed-in owner/staff belongs to. Each
// account is fully isolated — we never assume the baked EXPO_PUBLIC_BUSINESS_ID
// (kept only as a fallback for the unauthenticated/demo case).
const bizId = (): string => getAuth().user?.businessId || BIZ_ID;

// Client-side phone normalization to E.164 (mirrors the API). North-America-first:
// a bare 10-digit number becomes +1…; already-international (+…) numbers are kept.
// Returns null when the input can't be a complete number so the UI can flag it.
function normalizePhoneClient(input?: string|null): string|null {
  if (input == null) return null;
  const raw = input.trim();
  if (!raw) return null;
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

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
  const [day, setDay]               = useState<string|null>(null); // null = All; else a toDateString() key

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api<{data: Appointment[]}>(`/businesses/${bizId()}/bookings`);
      const all = res.data;
      const filtered = user?.role==='STAFF' && user?.staffId
        ? all.filter(a => a.staff.id === user.staffId)
        : all;
      setApts(filtered.sort((a,b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    } catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.staffId, user?.role]);

  useEffect(() => { load(); }, [load]);

  // Hardware back (Android) closes the open appointment detail instead of leaving
  // the app; the overlay also has an on-screen close for iOS.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) { setSelected(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [selected]);

  async function confirm(id:string) {
    setActing(true);
    try { await api(`/businesses/${bizId()}/bookings/${id}/confirm`,{method:'PATCH'}); load(true); setSelected(null); Alert.alert('Done','Appointment confirmed'); }
    catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setActing(false); }
  }
  async function cancel(id:string) {
    Alert.alert('Cancel appointment','Are you sure?',[
      {text:'No',style:'cancel'},
      {text:'Cancel it',style:'destructive',onPress:async()=>{
        setActing(true);
        try { await api(`/businesses/${bizId()}/bookings/${id}/status`,{method:'PATCH',body:JSON.stringify({status:'CANCELLED'})}); load(true); setSelected(null); }
        catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
        finally { setActing(false); }
      }},
    ]);
  }
  async function complete(id:string) {
    setActing(true);
    try { await api(`/businesses/${bizId()}/bookings/${id}/status`,{method:'PATCH',body:JSON.stringify({status:'COMPLETED'})}); load(true); setSelected(null); }
    catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setActing(false); }
  }
  // No-show protection: marks NO_SHOW and charges the client's saved card off-session
  // for the business's no-show fee (Stripe). If no card is on file the backend just
  // marks NO_SHOW and tells us to collect manually.
  function noShow(id:string) {
    Alert.alert('Mark as no-show?','This marks the appointment NO_SHOW and charges the no-show fee to the card on file, if any.',[
      {text:'Cancel',style:'cancel'},
      {text:'Mark no-show',style:'destructive',onPress:async()=>{
        setActing(true);
        try {
          const r = await api<{charged:boolean; feeCents:number; message?:string}>(`/payments/no-show/${id}`,{method:'POST'});
          load(true); setSelected(null);
          Alert.alert(
            r.charged ? 'No-show fee charged' : 'Marked no-show',
            r.charged ? `Charged $${(r.feeCents/100).toFixed(2)} to the card on file.` : (r.message || 'No saved card — collect the fee manually.'),
          );
        } catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
        finally { setActing(false); }
      }},
    ]);
  }

  const upcoming = apts.filter(a => ['PENDING','CONFIRMED'].includes(a.status) && new Date(a.startsAt) > new Date());
  const past     = apts.filter(a => !['PENDING','CONFIRMED'].includes(a.status) || new Date(a.startsAt) <= new Date());

  // Week date-strip (scheduler feel): 14 days from today; tap to filter the list.
  const dayKey = (iso:string) => new Date(iso).toDateString();
  const stripDays = Array.from({length:14}, (_,i) => { const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+i); return d; });
  const dayAppts = day ? apts.filter(a => dayKey(a.startsAt) === day).sort((a,b)=> +new Date(a.startsAt) - +new Date(b.startsAt)) : null;
  const listData = dayAppts ?? [...upcoming, ...past];

  function DateStrip() {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:16, paddingVertical:10, gap:8 }}>
        <TouchableOpacity onPress={()=>setDay(null)} style={[dst.chip, !day && dst.chipOn]}>
          <Text style={[dst.chipDow, !day && dst.chipTextOn]}>All</Text>
        </TouchableOpacity>
        {stripDays.map(d => {
          const key = d.toDateString();
          const on = day === key;
          const has = apts.some(a => dayKey(a.startsAt) === key && ['PENDING','CONFIRMED'].includes(a.status));
          return (
            <TouchableOpacity key={key} onPress={()=>setDay(on ? null : key)} style={[dst.chip, on && dst.chipOn]}>
              <Text style={[dst.chipDow, on && dst.chipTextOn]}>{d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</Text>
              <Text style={[dst.chipNum, on && dst.chipTextOn]}>{d.getDate()}</Text>
              {has && <View style={[dst.chipDot, on && { backgroundColor:'#fff' }]}/>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

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

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={BRAND}/></View>;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Appointments</Text></View>
      <DateStrip/>
      <FlatList
        data={listData}
        keyExtractor={a=>a.id}
        renderItem={({item})=><AptCard a={item}/>}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={<Text style={s.sectionLabel}>{day ? `${new Date(day).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})} (${listData.length})` : `Upcoming (${upcoming.length})`}</Text>}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>{day ? 'No appointments this day' : 'No appointments yet'}</Text></View>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={BRAND}/>}
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
              {selected.status==='CONFIRMED' && <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>noShow(selected.id)}><Text style={s.btnSecondaryText}>No-show &amp; charge fee</Text></TouchableOpacity>}
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
    api<Service[]>(`/businesses/${bizId()}/services`).then(s=>setServices(s.filter(x=>x.active))).catch(()=>{});
  },[]);

  function toggleSvc(sv: Service) {
    setSelectedSvcs(p => p.find(s=>s.id===sv.id) ? p.filter(s=>s.id!==sv.id) : [...p, sv]);
  }

  async function goToStaff() {
    if (selectedSvcs.length === 0) return;
    try {
      const ids = new Set(selectedSvcs.map(s=>s.id));
      const all = await api<Staff[]>(`/businesses/${bizId()}/staff`);
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
    if (form.name.trim().length < 2){ Alert.alert('Name required','Enter the client’s full name.'); return; }
    if (!form.email.trim()){ Alert.alert('Email required','Enter the client’s email.'); return; }
    // Phone is optional, but if given it must be a complete number so SMS can send.
    let normalizedPhone: string | undefined;
    if (form.phone.trim()) {
      const np = normalizePhoneClient(form.phone);
      if (!np){ Alert.alert('Check the phone number','Enter a complete number, e.g. +1 555 123 4567, or leave it blank.'); return; }
      normalizedPhone = np;
    }
    if (!policyAccepted){ Alert.alert('Policy required','Please accept the cancellation policy to continue.'); return; }
    setLoading(true);
    try {
      const staffId = staff && staff !== 'any' ? staff.id : (staffList[0]?.id ?? '');
      const client = await api<{id:string; matched?:boolean}>(`/businesses/${bizId()}/clients`, {
        method:'POST', body: JSON.stringify({name:form.name.trim(),email:form.email.trim(),phone:normalizedPhone}),
      });
      // Owner/staff booking from the app → confirmed immediately (the /manual
      // endpoint skips approval and sends the client their confirmation).
      const apt = await api<{id:string}>(`/businesses/${bizId()}/bookings/manual`, {
        method:'POST', body: JSON.stringify({staffId, serviceId:selectedSvcs[0].id, clientId:client.id, startsAt:slot!.startsAt}),
      });
      if (client.matched) {
        Alert.alert('Existing client', 'We matched this booking to an existing client profile and synced their details.');
      }
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
                      <View style={{width:8, height:8, borderRadius:4, backgroundColor: group.color ?? BRAND}}/>
                      <Text style={[s.sectionLabel, {marginBottom:0}]}>{group.label}</Text>
                    </View>
                  )}
                  {group.svcs.map(sv=>{
                    const sel = selectedSvcs.some(s=>s.id===sv.id);
                    return (
                      <TouchableOpacity key={sv.id} activeOpacity={0.7}
                        style={[s.card, sel && {borderColor:BRAND,backgroundColor:BRAND_LT}]}
                        onPress={()=>toggleSvc(sv)}>
                        <View style={[s.svcDot,{backgroundColor:sv.color}]}/>
                        <View style={{flex:1}}>
                          <Text style={[s.clientName, sel&&{color:BRAND}]}>{sv.name}</Text>
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
            <TouchableOpacity style={[s.card, staff==='any'&&{borderColor:BRAND,backgroundColor:BRAND_LT}]}
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
              <TouchableOpacity key={st.id} style={[s.card, (staff&&staff!=='any'&&(staff as Staff).id===st.id)&&{borderColor:BRAND,backgroundColor:BRAND_LT}]}
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
            {loading&&<ActivityIndicator color={BRAND} style={{marginTop:20}}/>}
          </>}

          {/* ── Time slots ─────────────────────────────────────────── */}
          {step==='time' && <>
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep('date')}><Text style={s.backText}>← Back</Text></TouchableOpacity>
            <Text style={s.stepLabel}>Available times</Text>
            <Text style={[s.sub,{marginBottom:12}]}>{new Date(date+'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</Text>
            {loading&&<ActivityIndicator color={BRAND} style={{marginTop:20}}/>}
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
              {k:'name',   label:'Full name *',    type:'default' as const,       ph:'Jane Doe'},
              {k:'email',  label:'Email *',         type:'email-address' as const, ph:'you@example.com'},
              {k:'phone',  label:'Phone (optional)',type:'phone-pad' as const,     ph:'+1 555 123 4567'},
            ].map(({k,label,type,ph})=>(
              <View key={k} style={{marginBottom:12}}>
                <Text style={s.fieldLabel}>{label}</Text>
                <TextInput style={s.input} placeholder={ph} placeholderTextColor={GRAY_400}
                  keyboardType={type} autoCapitalize={k==='name'?'words':'none'}
                  value={form[k as keyof typeof form]}
                  onChangeText={v=>setForm(p=>({...p,[k]:v}))}
                  onBlur={k==='phone'?()=>{ const np=normalizePhoneClient(form.phone); if(np) setForm(p=>({...p,phone:np})); }:undefined}/>
                {k==='phone' && <Text style={s.fieldHint}>Used for SMS reminders. Leave blank if none.</Text>}
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
      const res = await api<{data: Client[]}>(`/businesses/${bizId()}/clients${q?`?search=${encodeURIComponent(q)}`:''}`);
      setClients(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{
    const t = setTimeout(()=>load(true,search),400);
    return ()=>clearTimeout(t);
  },[search, load]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={BRAND}/></View>;

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true,search);}} tintColor={BRAND}/>}
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
              <Ionicons name="chatbubble-outline" size={18} color={BRAND}/>
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
    try { setThreads(await api(`/businesses/${bizId()}/messages`)); }
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
      const data = await api<Message[]>(`/businesses/${bizId()}/clients/${c.id}/messages`);
      setMsgs(data);
      await api(`/businesses/${bizId()}/clients/${c.id}/messages/read`,{method:'PATCH'});
    } catch {}
    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:false}),100);
  }

  async function send() {
    if (!reply.trim()||!selected) return;
    setSending(true);
    try {
      await api(`/businesses/${bizId()}/clients/${selected.id}/messages/reply`,{
        method:'POST', body:JSON.stringify({content:reply.trim()}),
      });
      setReply('');
      const data = await api<Message[]>(`/businesses/${bizId()}/clients/${selected.id}/messages`);
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
      {loading?<ActivityIndicator color={BRAND} style={{marginTop:40}}/>:(
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
type MoreView = 'menu' | 'services' | 'staff' | 'offers' | 'waitlist' | 'reviews' | 'settings';
function MoreScreen({ onLogout }: { onLogout:()=>void }) {
  const { user } = getAuth();
  const [view, setView]         = useState<MoreView>('menu');
  const [services, setServices] = useState<Service[] | null>(null);
  const [staff, setStaff]       = useState<Staff[] | null>(null);
  const [offers, setOffers]     = useState<any[] | null>(null);
  const [waitlist, setWaitlist] = useState<any[] | null>(null);
  const [reviews, setReviews]   = useState<any | null>(null);
  const [biz, setBiz]           = useState<any | null>(null);
  const [loading, setLoading]   = useState(false);

  // Hardware back (Android) pops a sub-view back to the menu instead of leaving
  // the app. iOS keeps the on-screen ‹ back button in <Head/>.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view !== 'menu') { setView('menu'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [view]);

  async function open(v: MoreView) {
    setView(v);
    try {
      if (v === 'services' && !services) { setLoading(true); setServices(await api<Service[]>(`/businesses/${bizId()}/services`)); }
      else if (v === 'staff' && !staff)  { setLoading(true); setStaff(await api<Staff[]>(`/businesses/${bizId()}/staff`)); }
      else if (v === 'offers' && !offers){ setLoading(true); setOffers(await api<any[]>(`/businesses/${bizId()}/offers`)); }
      else if (v === 'waitlist' && !waitlist){ setLoading(true); setWaitlist(await api<any[]>(`/businesses/${bizId()}/waitlist`)); }
      else if (v === 'reviews' && !reviews){ setLoading(true); setReviews(await api<any>(`/businesses/${bizId()}/reviews`)); }
      else if (v === 'settings' && !biz) { setLoading(true); setBiz(await api<any>(`/businesses/${bizId()}`)); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  const Head = ({ title }: { title:string }) => (
    <View style={[s.header, view!=='menu' && { flexDirection:'row', alignItems:'center' }]}>
      {view !== 'menu' && (
        <TouchableOpacity onPress={()=>setView('menu')} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
      )}
      <Text style={s.headerTitle}>{title}</Text>
    </View>
  );
  const Loader = () => <View style={{ padding:40, alignItems:'center' }}><ActivityIndicator color={BRAND}/></View>;

  if (view === 'services') return (
    <SafeAreaView style={s.screen}>
      <Head title="Services"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(services ?? []).filter(x=>x.active).map(sv => (
            <View key={sv.id} style={ms.row}>
              <View style={[ms.dot,{ backgroundColor: sv.color || BRAND }]}/>
              <View style={{ flex:1 }}>
                <Text style={ms.rowTitle}>{sv.name}</Text>
                <Text style={ms.rowMeta}>{sv.durationMinutes} min</Text>
              </View>
              <PriceTag cents={sv.priceCents}/>
            </View>
          ))}
          {services && services.length===0 && <Text style={ms.empty}>No services yet.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'staff') return (
    <SafeAreaView style={s.screen}>
      <Head title="Team"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(staff ?? []).map(st => (
            <View key={st.id} style={ms.row}>
              <View style={s.avatar}><Text style={{ color:BRAND, fontWeight:'700' }}>{st.user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</Text></View>
              <View style={{ flex:1 }}>
                <Text style={ms.rowTitle}>{st.user.name}</Text>
                <Text style={ms.rowMeta} numberOfLines={1}>{st.bio || `${st.staffServices?.length ?? 0} services`}</Text>
              </View>
            </View>
          ))}
          {staff && staff.length===0 && <Text style={ms.empty}>No team members yet.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'offers') return (
    <SafeAreaView style={s.screen}>
      <Head title="Offers"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(offers ?? []).map(of => (
            <View key={of.id} style={[ms.card,{ borderLeftWidth:3, borderLeftColor:'#10B981' }]}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <Text style={ms.rowTitle}>{of.title}</Text>
                {!!of.discount && <View style={[ms.dealChip]}><Text style={ms.dealChipText}>{of.discount}</Text></View>}
              </View>
              {!!of.description && <Text style={ms.rowMeta}>{of.description}</Text>}
              {!!of.expiresAt && <Text style={[ms.rowMeta,{ color:GRAY_400 }]}>Expires {new Date(of.expiresAt).toLocaleDateString()}</Text>}
            </View>
          ))}
          {offers && offers.length===0 && <Text style={ms.empty}>No active offers.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'waitlist') return (
    <SafeAreaView style={s.screen}>
      <Head title="Waitlist"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(waitlist ?? []).map(w => (
            <View key={w.id} style={ms.row}>
              <View style={s.avatar}><Text style={{ color:BRAND, fontWeight:'700' }}>{String(w.name||'?').split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}</Text></View>
              <View style={{ flex:1 }}>
                <Text style={ms.rowTitle}>{w.name}</Text>
                <Text style={ms.rowMeta} numberOfLines={1}>{w.email}{w.phone ? ` · ${w.phone}` : ''}</Text>
              </View>
            </View>
          ))}
          {waitlist && waitlist.length===0 && <Text style={ms.empty}>No one on the waitlist.</Text>}
          {waitlist && waitlist.length>0 && <Text style={[ms.empty,{ marginTop:4 }]}>Waiting clients are emailed automatically when a spot opens.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'reviews') return (
    <SafeAreaView style={s.screen}>
      <Head title="Reviews"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {reviews && reviews.count>0 && (
            <View style={[ms.card,{ alignItems:'center', paddingVertical:16 }]}>
              <Text style={{ fontSize:32, fontWeight:'800', color:GRAY_700 }}>{Number(reviews.average||0).toFixed(1)}</Text>
              <View style={{ flexDirection:'row', marginTop:2 }}>
                {[1,2,3,4,5].map(n => <Ionicons key={n} name={n<=Math.round(reviews.average||0)?'star':'star-outline'} size={16} color="#F59E0B"/>)}
              </View>
              <Text style={[ms.rowMeta,{ marginTop:4 }]}>{reviews.count} review{reviews.count===1?'':'s'}</Text>
            </View>
          )}
          {(reviews?.reviews ?? []).map((r:any) => (
            <View key={r.id} style={ms.card}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <Text style={ms.rowTitle}>{r.clientName}</Text>
                <View style={{ flexDirection:'row' }}>
                  {[1,2,3,4,5].map(n => <Ionicons key={n} name={n<=r.rating?'star':'star-outline'} size={13} color="#F59E0B"/>)}
                </View>
              </View>
              {!!r.comment && <Text style={[ms.rowMeta,{ marginTop:4 }]}>{r.comment}</Text>}
              <Text style={[ms.rowMeta,{ color:GRAY_400, marginTop:4 }]}>{new Date(r.createdAt).toLocaleDateString()}</Text>
            </View>
          ))}
          {reviews && reviews.count===0 && <Text style={ms.empty}>No reviews yet.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'settings') return (
    <SafeAreaView style={s.screen}>
      <Head title="Settings"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          <View style={ms.card}>
            <Text style={ms.cardLabel}>Business</Text>
            <Text style={ms.cardValue}>{biz?.name ?? '—'}</Text>
          </View>
          <View style={ms.card}>
            <Text style={ms.cardLabel}>Plan</Text>
            <Text style={ms.cardValue}>{(biz as any)?.plan ?? 'FREE'}</Text>
          </View>
          <View style={ms.card}>
            <Text style={ms.cardLabel}>Cancellation window</Text>
            <Text style={ms.cardValue}>{(biz as any)?.cancellationWindowHours ?? 24} hours</Text>
          </View>
          <View style={ms.card}>
            <Text style={ms.cardLabel}>Deposit required</Text>
            <Text style={ms.cardValue}>{(biz as any)?.requireDeposit ? `Yes · ${(biz as any)?.depositPercent ?? 25}%` : 'No'}</Text>
          </View>
          <Text style={[ms.empty,{ marginTop:8 }]}>Editing settings is coming to the app — manage on the web dashboard for now.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );

  // ── default menu ──
  const rows = [
    { label:'Services', icon:'cut-outline' as const, v:'services' as MoreView },
    { label:'Team', icon:'people-outline' as const, v:'staff' as MoreView },
    { label:'Offers', icon:'pricetag-outline' as const, v:'offers' as MoreView },
    { label:'Waitlist', icon:'hourglass-outline' as const, v:'waitlist' as MoreView },
    { label:'Reviews', icon:'star-outline' as const, v:'reviews' as MoreView },
    { label:'Settings', icon:'settings-outline' as const, v:'settings' as MoreView },
  ];
  return (
    <SafeAreaView style={s.screen}>
      <Head title="More"/>
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
            <TouchableOpacity key={r.label} style={[s.menuRow, i<rows.length-1&&s.menuRowBorder]} onPress={()=>open(r.v)} activeOpacity={0.7}>
              <View style={s.menuIcon}><Ionicons name={r.icon} size={20} color={BRAND}/></View>
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

const ms = StyleSheet.create({
  row:       { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#fff', borderRadius:14, borderWidth:1, borderColor:GRAY_100, padding:14, marginBottom:10 },
  dot:       { width:10, height:10, borderRadius:5 },
  rowTitle:  { fontSize:15, fontWeight:'600', color:GRAY_900 },
  rowMeta:   { fontSize:13, color:GRAY_500, marginTop:2 },
  card:      { backgroundColor:'#fff', borderRadius:14, borderWidth:1, borderColor:GRAY_100, padding:14, marginBottom:10 },
  cardLabel: { fontSize:12, color:GRAY_500 },
  cardValue: { fontSize:16, fontWeight:'700', color:GRAY_900, marginTop:2 },
  empty:     { fontSize:13, color:GRAY_400, textAlign:'center', paddingVertical:12 },
  dealChip:  { backgroundColor:'#D1FAE5', borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  dealChipText:{ fontSize:12, fontWeight:'700', color:'#065F46' },
});

const dst = StyleSheet.create({
  chip:      { minWidth:46, alignItems:'center', paddingVertical:8, paddingHorizontal:10, borderRadius:12, borderWidth:1, borderColor:GRAY_200, backgroundColor:'#fff' },
  chipOn:    { backgroundColor:BRAND, borderColor:BRAND },
  chipDow:   { fontSize:11, fontWeight:'700', color:GRAY_500 },
  chipNum:   { fontSize:16, fontWeight:'800', color:GRAY_900, marginTop:2 },
  chipTextOn:{ color:'#fff' },
  chipDot:   { width:5, height:5, borderRadius:3, backgroundColor:BRAND, marginTop:4 },
});

// ── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onRegister, onForgot }: { onLogin:(t:string,r:string,u:User)=>void; onRegister:()=>void; onForgot:()=>void }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  // 2FA: set once a password passes for an account with two-factor enabled.
  const [challenge, setChallenge] = useState<{id:string;method:string}|null>(null);
  const [code, setCode]         = useState('');

  async function login() {
    if (!email||!password) return;
    setLoading(true);
    try {
      const res = await api<{accessToken?:string;refreshToken?:string;user?:User;twoFactorRequired?:boolean;challengeId?:string;method?:string}>('/auth/login',{
        method:'POST', body:JSON.stringify({email,password}),
      });
      if (res.twoFactorRequired && res.challengeId) {
        setChallenge({ id: res.challengeId, method: res.method ?? 'EMAIL' });
        return;
      }
      onLogin(res.accessToken!, res.refreshToken!, res.user!);
    } catch {
      Alert.alert('Sign in failed','Check your email and password and try again.');
    } finally { setLoading(false); }
  }

  async function verify() {
    if (!challenge || code.trim().length<4) return;
    setLoading(true);
    try {
      const res = await api<{accessToken:string;refreshToken:string;user:User}>('/auth/2fa/verify',{
        method:'POST', body:JSON.stringify({ challengeId: challenge.id, code: code.trim() }),
      });
      onLogin(res.accessToken, res.refreshToken, res.user);
    } catch {
      Alert.alert('Verification failed','That code is invalid or expired. Please try again.');
    } finally { setLoading(false); }
  }

  if (challenge) {
    return (
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS==='ios'?'padding':'height'}>
          <View style={s.loginLogo}>
            <View style={s.logoIcon}><Ionicons name="shield-checkmark" size={28} color="#fff"/></View>
            <Text style={s.logoText}>Pulse</Text>
          </View>
          <Text style={s.loginTitle}>Enter your code</Text>
          <Text style={s.loginSub}>We sent a 6-digit code to your {challenge.method==='SMS'?'phone':'email'}. It expires in 10 minutes.</Text>

          <Text style={[s.fieldLabel,{marginTop:12}]}>Verification code</Text>
          <TextInput style={[s.input,{textAlign:'center',letterSpacing:8,fontSize:20}]} placeholder="123456" placeholderTextColor={GRAY_400}
            keyboardType="number-pad" value={code} onChangeText={(t)=>setCode(t.replace(/\D/g,'').slice(0,6))} onSubmitEditing={verify} autoFocus/>

          <TouchableOpacity style={[s.btnPrimary,{marginTop:24}]} disabled={loading||code.trim().length<4} onPress={verify}>
            {loading?<ActivityIndicator color="#fff"/>:<Text style={s.btnPrimaryText}>Verify &amp; sign in</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={{ alignSelf:'center', marginTop:16 }} onPress={()=>{setChallenge(null);setCode('');}}>
            <Text style={s.authSwitchLink}>← Back to sign in</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={s.loginLogo}>
          <View style={s.logoIcon}><Ionicons name="calendar" size={28} color="#fff"/></View>
          <Text style={s.logoText}>Pulse</Text>
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

        <TouchableOpacity style={{ alignSelf:'center', marginTop:16 }} onPress={onForgot}>
          <Text style={s.authSwitchLink}>Forgot password?</Text>
        </TouchableOpacity>

        <View style={s.authSwitch}>
          <Text style={s.authSwitchText}>New here? </Text>
          <TouchableOpacity onPress={onRegister}>
            <Text style={s.authSwitchLink}>Create your business</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Forgot password: emails a reset link (reset completes on the web page) ────
function ForgotPasswordScreen({ onBack }: { onBack:()=>void }) {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);

  async function submit() {
    if (!email.trim()) { Alert.alert('Email','Enter your account email.'); return; }
    setLoading(true);
    try {
      await api('/auth/forgot-password', { method:'POST', body: JSON.stringify({ email: email.trim() }) });
      setSent(true); // always succeeds (server never reveals if the email exists)
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Try again.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={s.loginLogo}>
          <View style={s.logoIcon}><Ionicons name="key" size={24} color="#fff"/></View>
          <Text style={s.logoText}>Pulse</Text>
        </View>
        <Text style={s.loginTitle}>Reset password</Text>
        {sent ? (
          <>
            <Text style={s.loginSub}>If an account exists for {email.trim()}, we’ve emailed a reset link. It expires in 30 minutes.</Text>
            <TouchableOpacity style={[s.btnPrimary,{marginTop:24}]} onPress={onBack}>
              <Text style={s.btnPrimaryText}>Back to sign in</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.loginSub}>Enter your email and we’ll send you a reset link.</Text>
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor={GRAY_400}
              keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} onSubmitEditing={submit}/>
            <TouchableOpacity style={[s.btnPrimary,{marginTop:24}]} disabled={loading||!email} onPress={submit}>
              {loading?<ActivityIndicator color="#fff"/>:<Text style={s.btnPrimaryText}>Send reset link</Text>}
            </TouchableOpacity>
            <View style={s.authSwitch}>
              <Text style={s.authSwitchText}>Remembered it? </Text>
              <TouchableOpacity onPress={onBack}><Text style={s.authSwitchLink}>Sign in</Text></TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Business-owner sign up: creates an OWNER + a fresh, empty business ────────
function RegisterScreen({ onRegistered, onBack }: { onRegistered:(t:string,r:string,u:User)=>void; onBack:()=>void }) {
  const [name, setName]             = useState('');
  const [businessName, setBizName]  = useState('');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [terms, setTerms]           = useState(false);
  const [loading, setLoading]       = useState(false);

  async function submit() {
    if (name.trim().length < 2) { Alert.alert('Your name','Enter your full name.'); return; }
    if (businessName.trim().length < 2) { Alert.alert('Business name','Enter your business name.'); return; }
    if (!email.trim()) { Alert.alert('Email','Enter your email.'); return; }
    if (password.length < 8) { Alert.alert('Weak password','Password must be at least 8 characters.'); return; }
    if (!terms) { Alert.alert('Terms required','Please accept the Terms of Service & Privacy Policy to continue.'); return; }
    let normalizedPhone: string | undefined;
    if (phone.trim()) {
      const np = normalizePhoneClient(phone);
      if (!np) { Alert.alert('Check the phone number','Enter a complete number, e.g. +1 555 123 4567, or leave it blank.'); return; }
      normalizedPhone = np;
    }
    setLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api<{accessToken:string;refreshToken:string;user:User}>('/auth/register',{
        method:'POST',
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), password, role:'OWNER',
          businessName: businessName.trim(),
          ...(normalizedPhone ? { businessPhone: normalizedPhone } : {}),
          ...(tz ? { timezone: tz } : {}),
        }),
      });
      onRegistered(res.accessToken, res.refreshToken, res.user);
    } catch (e) {
      Alert.alert('Could not create account', e instanceof Error ? e.message : 'Try again.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.loginLogo}>
            <View style={s.logoIcon}><Ionicons name="storefront" size={26} color="#fff"/></View>
            <Text style={s.logoText}>Pulse</Text>
          </View>
          <Text style={s.loginTitle}>Create your business</Text>
          <Text style={s.loginSub}>Set up your account — you’ll add services and staff next.</Text>

          <Text style={s.fieldLabel}>Your name</Text>
          <TextInput style={s.input} placeholder="Jane Doe" placeholderTextColor={GRAY_400}
            autoCapitalize="words" value={name} onChangeText={setName}/>

          <Text style={[s.fieldLabel,{marginTop:12}]}>Business name</Text>
          <TextInput style={s.input} placeholder="Jane’s Salon" placeholderTextColor={GRAY_400}
            autoCapitalize="words" value={businessName} onChangeText={setBizName}/>

          <Text style={[s.fieldLabel,{marginTop:12}]}>Email</Text>
          <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor={GRAY_400}
            keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail}/>

          <Text style={[s.fieldLabel,{marginTop:12}]}>Business phone (optional)</Text>
          <TextInput style={s.input} placeholder="+1 555 123 4567" placeholderTextColor={GRAY_400}
            keyboardType="phone-pad" value={phone} onChangeText={setPhone}
            onBlur={()=>{ const np=normalizePhoneClient(phone); if(np) setPhone(np); }}/>

          <Text style={[s.fieldLabel,{marginTop:12}]}>Password</Text>
          <View style={{position:'relative'}}>
            <TextInput style={s.input} placeholder="At least 8 characters" placeholderTextColor={GRAY_400}
              secureTextEntry={!showPw} value={password} onChangeText={setPassword} onSubmitEditing={submit}/>
            <TouchableOpacity style={s.pwToggle} onPress={()=>setShowPw(p=>!p)}>
              <Ionicons name={showPw?'eye-off-outline':'eye-outline'} size={18} color={GRAY_400}/>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[s.policyCheck,{marginTop:18}]} activeOpacity={0.7} onPress={()=>setTerms(t=>!t)}>
            <View style={[s.checkbox, terms&&s.checkboxActive]}>
              {terms&&<Ionicons name="checkmark" size={12} color="#fff"/>}
            </View>
            <Text style={s.policyCheckText}>
              I agree to the{' '}
              <Text style={s.authSwitchLink} onPress={()=>Linking.openURL(`${WEB_URL}/terms`)}>Terms of Service</Text>
              {' '}&amp;{' '}
              <Text style={s.authSwitchLink} onPress={()=>Linking.openURL(`${WEB_URL}/privacy`)}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btnPrimary,{marginTop:18, opacity:terms?1:0.6}]} disabled={loading} onPress={submit}>
            {loading?<ActivityIndicator color="#fff"/>:<Text style={s.btnPrimaryText}>Create account</Text>}
          </TouchableOpacity>

          <View style={s.authSwitch}>
            <Text style={s.authSwitchText}>Already have an account? </Text>
            <TouchableOpacity onPress={onBack}>
              <Text style={s.authSwitchLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
          <Text style={s.logoText}>Pulse</Text>
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

// ── Home / Dashboard (Square-style landing) ──────────────────────────────────
function HomeScreen() {
  const nav = useNavigation<any>();
  const { user } = getAuth();
  const [appts, setAppts]       = useState<Appointment[]>([]);
  const [bizName, setBizName]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const [res, biz] = await Promise.all([
        api<{ data:Appointment[] }>(`/businesses/${bizId()}/bookings`).catch(()=>({ data:[] as Appointment[] })),
        api<{ name:string }>(`/businesses/${bizId()}`).catch(()=>({ name:'' })),
      ]);
      setAppts(Array.isArray(res?.data) ? res.data : []);
      setBizName(biz?.name ?? '');
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(()=>{ load(); }, [load]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name ?? 'there').split(' ')[0];

  const todayStr = now.toDateString();
  const real = appts
    .filter(a => new Date(a.startsAt).toDateString() === todayStr)
    .sort((a,b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  // Demo-friendly: when there are no real appointments today, show realistic
  // sample data so the dashboard looks populated. (Swap for live data later.)
  const at = (h:number,m:number) => { const d=new Date(); d.setHours(h,m,0,0); return d.toISOString(); };
  const SAMPLE = [
    { id:'s1', startsAt:at(9,0),  endsAt:at(10,0), status:'CONFIRMED', notes:'', service:{name:'Haircut',durationMinutes:60,priceCents:4500}, staff:{id:'x',user:{name:'Alex'}}, client:{id:'c1',name:'Jordan Lee',email:''} },
    { id:'s2', startsAt:at(11,30),endsAt:at(13,30),status:'PENDING',   notes:'', service:{name:'Color & Highlights',durationMinutes:120,priceCents:12000}, staff:{id:'x',user:{name:'Sam'}}, client:{id:'c2',name:'Riley Chen',email:''} },
    { id:'s3', startsAt:at(14,0), endsAt:at(14,30),status:'CONFIRMED', notes:'', service:{name:'Beard Trim',durationMinutes:30,priceCents:2500}, staff:{id:'x',user:{name:'Alex'}}, client:{id:'c3',name:'Taylor Brooks',email:''} },
  ] as unknown as Appointment[];

  const isSample = real.length === 0;
  const agenda = isSample ? SAMPLE : real;
  const todayCount   = isSample ? 6     : real.length;
  const pendingCount = isSample ? 2     : appts.filter(a => a.status === 'PENDING').length;
  const revenueCents = isSample ? 24500 : real.filter(a => a.status==='CONFIRMED' || a.status==='COMPLETED').reduce((s,a)=> s + (a.service?.priceCents ?? 0), 0);

  const Stat = ({ label, value, icon, color }:{label:string;value:string;icon:any;color:string}) => (
    <View style={hs.stat}>
      <View style={[hs.statIcon,{backgroundColor:color+'18'}]}><Ionicons name={icon} size={16} color={color}/></View>
      <Text style={hs.statValue}>{value}</Text>
      <Text style={hs.statLabel}>{label}</Text>
    </View>
  );
  const Action = ({ label, icon, to }:{label:string;icon:any;to:string}) => (
    <TouchableOpacity style={hs.action} onPress={()=>nav.navigate(to)}>
      <View style={hs.actionIcon}><Ionicons name={icon} size={20} color={BRAND}/></View>
      <Text style={hs.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) return <SafeAreaView style={s.screen}><View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={BRAND}/></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:32}} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={BRAND}/>}>
        <Text style={hs.greeting}>{greeting}, {firstName} 👋</Text>
        {!!bizName && <Text style={hs.biz}>{bizName}</Text>}

        <View style={hs.statRow}>
          <Stat label="Today" value={String(todayCount)} icon="calendar" color={BRAND}/>
          <Stat label="Pending" value={String(pendingCount)} icon="time" color="#F59E0B"/>
          <Stat label="Revenue" value={`$${(revenueCents/100).toFixed(0)}`} icon="cash" color="#10B981"/>
        </View>

        <View style={hs.actionRow}>
          <Action label="New booking" icon="add-circle" to="Book"/>
          <Action label="Clients" icon="people" to="Clients"/>
          <Action label="Messages" icon="chatbubbles" to="Messages"/>
        </View>

        <View style={hs.sectionHead}>
          <Text style={hs.sectionTitle}>Today’s schedule</Text>
          {isSample && <View style={hs.sampleChip}><Text style={hs.sampleChipText}>Sample</Text></View>}
        </View>

        {agenda.map(a => {
          const d = new Date(a.startsAt);
          const hr = ((d.getHours() + 11) % 12) + 1;
          const mm = String(d.getMinutes()).padStart(2, '0');
          const ap = d.getHours() < 12 ? 'AM' : 'PM';
          return (
          <TouchableOpacity key={a.id} style={hs.apt} activeOpacity={0.7} onPress={()=>nav.navigate('Appointments')}>
            <View style={hs.aptTime}>
              <Text style={hs.aptHour}>{hr}:{mm}</Text>
              <Text style={hs.aptAmPm}>{ap}</Text>
            </View>
            <View style={{flex:1,minWidth:0}}>
              <Text style={hs.aptService} numberOfLines={1}>{a.service?.name}</Text>
              <Text style={hs.aptMeta} numberOfLines={1}>{a.client?.name} · {a.staff?.user?.name}</Text>
            </View>
            <View style={{alignItems:'flex-end',gap:4}}>
              <PriceTag cents={a.service?.priceCents ?? 0}/>
              <Pill label={a.status} color={STATUS_COLOR[a.status] ?? GRAY_500}/>
            </View>
          </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const hs = StyleSheet.create({
  greeting:   { fontSize:24, fontWeight:'800', color:GRAY_900 },
  biz:        { fontSize:14, color:GRAY_500, marginTop:2, marginBottom:18 },
  statRow:    { flexDirection:'row', gap:10, marginBottom:18 },
  stat:       { flex:1, backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:GRAY_100, padding:14 },
  statIcon:   { width:30, height:30, borderRadius:9, alignItems:'center', justifyContent:'center', marginBottom:10 },
  statValue:  { fontSize:22, fontWeight:'800', color:GRAY_900 },
  statLabel:  { fontSize:12, color:GRAY_500, marginTop:1 },
  actionRow:  { flexDirection:'row', gap:10, marginBottom:22 },
  action:     { flex:1, backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:GRAY_100, paddingVertical:16, alignItems:'center' },
  actionIcon: { width:40, height:40, borderRadius:12, backgroundColor:BRAND_LT, alignItems:'center', justifyContent:'center', marginBottom:8 },
  actionLabel:{ fontSize:12, fontWeight:'600', color:GRAY_700 },
  sectionHead:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 },
  sectionTitle:{ fontSize:17, fontWeight:'700', color:GRAY_900 },
  sampleChip: { backgroundColor:'#FEF3C7', borderRadius:6, paddingHorizontal:7, paddingVertical:2 },
  sampleChipText:{ fontSize:10, fontWeight:'700', color:'#92400E' },
  apt:        { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#fff', borderRadius:14, borderWidth:1, borderColor:GRAY_100, padding:14, marginBottom:10 },
  aptTime:    { width:54, alignItems:'center' },
  aptHour:    { fontSize:15, fontWeight:'800', color:GRAY_900 },
  aptAmPm:    { fontSize:11, color:GRAY_400, fontWeight:'600' },
  aptService: { fontSize:15, fontWeight:'600', color:GRAY_900 },
  aptMeta:    { fontSize:13, color:GRAY_500, marginTop:2 },
});

// ── Tab navigator ────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

export default function App() {
  const [token, setToken]             = useState<string|null>(null);
  const [user, setUser]               = useState<User|null>(null);
  const [msgClient, setMsgClient]     = useState<Client|null>(null);
  const [_, forceRender]              = useState(0);
  const [booting, setBooting]         = useState(true);
  const [authView, setAuthView]       = useState<'login'|'register'|'forgot'>('login');

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
          <ActivityIndicator color={BRAND}/>
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );

  if (!token) return (
    <ErrorBoundary>
      {authView === 'register'
        ? <RegisterScreen onRegistered={handleLogin} onBack={()=>setAuthView('login')}/>
        : authView === 'forgot'
        ? <ForgotPasswordScreen onBack={()=>setAuthView('login')}/>
        : <LoginScreen onLogin={handleLogin} onRegister={()=>setAuthView('register')} onForgot={()=>setAuthView('forgot')}/>}
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
            tabBarActiveTintColor: BRAND,
            tabBarInactiveTintColor: GRAY_400,
            tabBarStyle: { backgroundColor:'#fff', borderTopColor:GRAY_100, height:60, paddingBottom:8 },
            tabBarLabelStyle: { fontSize:11, fontWeight:'600' },
            tabBarIcon: ({ color, size }) => {
              const icons: Record<string,string> = {
                Home:'home-outline', Appointments:'calendar-outline', Book:'add-circle-outline',
                Clients:'people-outline', Messages:'chatbubbles-outline', More:'menu-outline',
              };
              return <Ionicons name={(icons[route.name]??'ellipse-outline') as any} size={size} color={color}/>;
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen}/>
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
  dateText:        { fontSize:12, color:BRAND, fontWeight:'500', marginTop:3 },
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
  btnPrimary:      { backgroundColor:BRAND, borderRadius:12, padding:14, alignItems:'center' },
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
  backText:        { color:BRAND, fontSize:14, fontWeight:'500' },
  svcDot:          { width:12, height:12, borderRadius:99, marginRight:4 },
  avatar:          { width:40, height:40, borderRadius:20, backgroundColor:BRAND_LT, alignItems:'center', justifyContent:'center' },
  avatarText:      { color:BRAND, fontWeight:'700', fontSize:13 },
  checkbox:        { width:20, height:20, borderRadius:10, borderWidth:2, borderColor:GRAY_200, alignItems:'center', justifyContent:'center', marginLeft:8 },
  checkboxActive:  { borderColor:BRAND, backgroundColor:BRAND },
  cartBar:         { backgroundColor:BRAND_LT, borderRadius:12, padding:12, marginTop:8, alignItems:'center' },
  cartText:        { color:BRAND, fontWeight:'700', fontSize:14 },
  datePill:        { width:52, marginRight:8, borderRadius:12, borderWidth:1, borderColor:GRAY_200, backgroundColor:'#fff', paddingVertical:10, alignItems:'center' },
  datePillActive:  { backgroundColor:BRAND, borderColor:BRAND },
  datePillDay:     { fontSize:11, color:GRAY_500, fontWeight:'600' },
  datePillNum:     { fontSize:17, fontWeight:'700', color:GRAY_900, marginTop:2 },
  slotGrid:        { flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:8 },
  slotBtn:         { borderWidth:1, borderColor:GRAY_200, borderRadius:10, paddingVertical:10, paddingHorizontal:14, backgroundColor:'#fff' },
  slotBtnActive:   { borderColor:BRAND, backgroundColor:BRAND_LT },
  slotText:        { color:GRAY_700, fontSize:13, fontWeight:'500' },
  slotTextActive:  { color:BRAND, fontWeight:'700' },
  summaryBox:      { backgroundColor:BRAND_LT, borderRadius:14, padding:14, marginBottom:20 },
  summaryTitle:    { fontSize:15, fontWeight:'700', color:BRAND },
  summarySub:      { fontSize:13, color:'#5B21B6', marginTop:3 },
  fieldLabel:      { fontSize:13, fontWeight:'600', color:GRAY_700, marginBottom:6 },
  fieldHint:       { fontSize:11, color:GRAY_400, marginTop:5 },
  authSwitch:      { flexDirection:'row', justifyContent:'center', alignItems:'center', marginTop:20 },
  authSwitchText:  { fontSize:13, color:GRAY_500 },
  authSwitchLink:  { fontSize:13, color:BRAND, fontWeight:'700' },
  input:           { borderWidth:1, borderColor:GRAY_200, borderRadius:12, padding:13, fontSize:15, color:GRAY_900, backgroundColor:'#fff' },
  policyBox:       { backgroundColor:GRAY_50, borderRadius:14, borderWidth:1, borderColor:GRAY_200, padding:14, marginBottom:16 },
  policyTitle:     { fontSize:13, fontWeight:'700', color:GRAY_900, marginBottom:6 },
  policyText:      { fontSize:12, color:GRAY_500, lineHeight:18 },
  policyCheck:     { flexDirection:'row', alignItems:'center', marginTop:12 },
  policyCheckText: { fontSize:13, color:GRAY_700, fontWeight:'500', marginLeft:10, flex:1 },
  doneBox:         { alignItems:'center', paddingTop:40 },
  doneIcon:        { width:72, height:72, borderRadius:36, backgroundColor:BRAND, alignItems:'center', justifyContent:'center', marginBottom:16 },
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
  bubbleRight:     { backgroundColor:BRAND, alignSelf:'flex-end', borderBottomRightRadius:4 },
  bubbleText:      { fontSize:14 },
  bubbleTextLeft:  { color:GRAY_900 },
  bubbleTextRight: { color:'#fff' },
  bubbleTime:      { fontSize:10, color:GRAY_400, marginTop:4, alignSelf:'flex-end' },
  composeRow:      { flexDirection:'row', alignItems:'flex-end', padding:12, borderTopWidth:1, borderTopColor:GRAY_100, gap:8, backgroundColor:'#fff' },
  composeInput:    { flex:1, borderWidth:1, borderColor:GRAY_200, borderRadius:20, paddingHorizontal:16, paddingVertical:10, fontSize:14, color:GRAY_900, maxHeight:100 },
  sendBtn:         { width:42, height:42, borderRadius:21, backgroundColor:BRAND, alignItems:'center', justifyContent:'center' },
  unreadDot:       { width:8, height:8, borderRadius:4, backgroundColor:BRAND, marginLeft:6 },
  msgTime:         { fontSize:11, color:GRAY_400 },
  // More
  profileCard:     { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:GRAY_100, padding:16, marginBottom:16, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, shadowOffset:{width:0,height:1} },
  avatarLg:        { width:52, height:52, borderRadius:26, backgroundColor:BRAND_LT, alignItems:'center', justifyContent:'center' },
  avatarLgText:    { color:BRAND, fontWeight:'700', fontSize:18 },
  profileName:     { fontSize:16, fontWeight:'700', color:GRAY_900 },
  profileRole:     { fontSize:13, color:GRAY_500, textTransform:'capitalize', marginTop:2 },
  menuCard:        { backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:GRAY_100, marginBottom:16, overflow:'hidden', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, shadowOffset:{width:0,height:1} },
  menuRow:         { flexDirection:'row', alignItems:'center', padding:16, gap:12 },
  menuRowBorder:   { borderBottomWidth:1, borderBottomColor:GRAY_100 },
  menuIcon:        { width:36, height:36, borderRadius:10, backgroundColor:BRAND_LT, alignItems:'center', justifyContent:'center' },
  menuLabel:       { flex:1, fontSize:15, fontWeight:'500', color:GRAY_900 },
  logoutBtn:       { flexDirection:'row', alignItems:'center', justifyContent:'center', padding:16, backgroundColor:'#FEF2F2', borderRadius:14, borderWidth:1, borderColor:'#FCA5A5' },
  // Login
  loginWrap:       { flex:1, padding:28, justifyContent:'center' },
  loginLogo:       { flexDirection:'row', alignItems:'center', gap:12, marginBottom:32 },
  logoIcon:        { width:48, height:48, borderRadius:14, backgroundColor:BRAND, alignItems:'center', justifyContent:'center' },
  logoText:        { fontSize:24, fontWeight:'800', color:GRAY_900, letterSpacing:-0.5 },
  loginTitle:      { fontSize:28, fontWeight:'800', color:GRAY_900, letterSpacing:-0.5 },
  loginSub:        { fontSize:14, color:GRAY_500, marginTop:4, marginBottom:24 },
  pwToggle:        { position:'absolute', right:14, top:14 },
  // Search
  unreadCount:     { fontSize:11, color:'#fff', backgroundColor:BRAND, borderRadius:99, paddingHorizontal:6, paddingVertical:1, fontWeight:'700' },
});
