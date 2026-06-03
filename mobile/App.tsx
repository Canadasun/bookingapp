import 'react-native-screens';
import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useEffect, useState, useCallback, useRef, Component } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, SectionList,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform, Modal,
  StatusBar, KeyboardAvoidingView, RefreshControl, BackHandler, Linking, Switch, Share,
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
interface User { id:string; name:string; email:string; role:string; staffId:string|null; businessId:string|null; mustResetPassword?:boolean; twoFactorEnabled?:boolean; twoFactorMethod?:'EMAIL'|'SMS' }
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
function CalendarScreen() {
  const { user } = getAuth();
  const nav = useNavigation<any>();
  const [apts, setApts]       = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]     = useState<Appointment|null>(null);
  const [acting, setActing]         = useState(false);

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

  // ── Agenda: group appointments by day, today first, today's header in blue ────
  const TODAY_KEY = new Date().toDateString();
  const dayKey = (iso:string) => new Date(iso).toDateString();
  const byDay = new Map<string, Appointment[]>();
  for (const a of apts) {
    const k = dayKey(a.startsAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(a);
  }
  // Future-and-today days ascending; always include today (even if empty).
  const todayMs = new Date(TODAY_KEY).getTime();
  const dayKeys = Array.from(new Set([TODAY_KEY, ...byDay.keys()]))
    .filter(k => new Date(k).getTime() >= todayMs)
    .sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
  const sections = dayKeys.map(k => ({
    key: k,
    isToday: k === TODAY_KEY,
    title: new Date(k).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase(),
    data: (byDay.get(k) ?? []).sort((a,b)=> +new Date(a.startsAt) - +new Date(b.startsAt)),
  }));

  function fmtDur(min:number){ const h=Math.floor(min/60), r=min%60; if(h&&r) return `${h}h ${r}m`; return h?`${h}h`:`${min}m`; }

  function openMenu() {
    Alert.alert('Calendar', undefined, [
      { text:'Refresh', onPress:()=>{ setRefreshing(true); load(true); } },
      { text:'New appointment', onPress:()=>nav.navigate('Book') },
      { text:'Close', style:'cancel' },
    ]);
  }

  const monthLabel = new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={BRAND}/></View>;

  return (
    <SafeAreaView style={s.screen}>
      {/* Top bar: ⋯ (left) · Month ▾ (center) · + (right) */}
      <View style={cal.topbar}>
        <TouchableOpacity style={cal.topBtn} onPress={openMenu} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="ellipsis-horizontal" size={22} color={GRAY_700}/>
        </TouchableOpacity>
        <TouchableOpacity style={cal.monthWrap} activeOpacity={0.7} onPress={()=>{ setRefreshing(true); load(true); }}>
          <Text style={cal.monthText}>{monthLabel}</Text>
          <Ionicons name="chevron-down" size={16} color={GRAY_700} style={{marginLeft:4}}/>
        </TouchableOpacity>
        <TouchableOpacity style={cal.topBtn} onPress={()=>nav.navigate('Book')} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="add" size={26} color={BRAND}/>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(a)=>a.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom:32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={BRAND}/>}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({section})=>(
          <View style={[cal.dateHeader, (section as any).isToday && cal.dateHeaderToday]}>
            <Text style={[cal.dateHeaderText, (section as any).isToday && cal.dateHeaderTextToday]}>{(section as any).title}</Text>
          </View>
        )}
        renderSectionFooter={({section})=> (section as any).data.length===0
          ? <Text style={cal.emptyDay}>No appointments or events today.</Text>
          : null}
        renderItem={({item:a})=>{
          const d = new Date(a.startsAt);
          return (
            <TouchableOpacity style={cal.aptRow} activeOpacity={0.6} onPress={()=>setSelected(a)}>
              <View style={[cal.aptBar, {backgroundColor: STATUS_COLOR[a.status]??GRAY_200}]}/>
              <View style={{flex:1}}>
                <Text style={cal.aptClient}>{a.client.name}</Text>
                <Text style={cal.aptService}>{a.service.name}</Text>
              </View>
              <View style={{alignItems:'flex-end'}}>
                <Text style={cal.aptTime}>{d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</Text>
                <Text style={cal.aptDur}>{fmtDur(a.service.durationMinutes)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
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

// ── Checkout → Custom price → Tap to Pay ─────────────────────────────────────
function CheckoutScreen() {
  type Phase = 'amount'|'tap'|'done';
  const [phase, setPhase]     = useState<Phase>('amount');
  const [digits, setDigits]   = useState('');   // raw cents, e.g. "1234" = $12.34
  const [note, setNote]       = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<{ amountCents:number; ref:string; at:Date }|null>(null);

  const cents   = parseInt(digits || '0', 10);
  const display = (cents/100).toFixed(2);

  // Hardware back steps the flow back instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase==='tap') { setPhase('amount'); return true; }
      if (phase==='done') { reset(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [phase]);

  function pressDigit(d:string){ setDigits(p => (p + d).replace(/^0+/, '').slice(0, 7)); } // up to $99,999.99
  function back(){ setDigits(p => p.slice(0, -1)); }

  async function charge() {
    if (cents < 50) { Alert.alert('Amount too low', 'Enter at least $0.50.'); return; }
    setLoading(true);
    try {
      const r = await api<{ paymentIntentId:string; amountCents:number }>(`/payments/charge`, {
        method:'POST', body: JSON.stringify({ amountCents: cents, description: note.trim() || undefined }),
      });
      setReceipt({ amountCents: r.amountCents, ref: r.paymentIntentId, at: new Date() });
      setPhase('tap');
    } catch(e){ Alert.alert('Checkout failed', e instanceof Error ? e.message : 'Please try again'); }
    finally { setLoading(false); }
  }

  // The Stripe Terminal "Tap to Pay on iPhone" SDK confirms the PaymentIntent here
  // (collectPaymentMethod → confirmPaymentIntent). Until the Apple proximity-reader
  // entitlement is granted that hook is stubbed, so this advances to the receipt.
  function completeTap(){ setPhase('done'); }

  function reset(){ setPhase('amount'); setDigits(''); setNote(''); setReceipt(null); }

  // ── Tap to Pay on iPhone (full-screen prompt) ──
  if (phase === 'tap') {
    return (
      <SafeAreaView style={[s.screen, { backgroundColor:'#111827' }]}>
        <View style={co.tapWrap}>
          <Text style={co.tapAmount}>${(receipt!.amountCents/100).toFixed(2)}</Text>
          <View style={co.tapNfc}>
            <Ionicons name="wifi" size={44} color="#fff" style={{ transform:[{ rotate:'90deg' }] }}/>
          </View>
          <Text style={co.tapTitle}>Tap to Pay on iPhone</Text>
          <Text style={co.tapSub}>Hold the customer&apos;s card, phone, or watch near the top of your iPhone.</Text>
          <ActivityIndicator color="#fff" style={{ marginTop:24 }}/>

          <TouchableOpacity style={co.tapDone} onPress={completeTap} activeOpacity={0.85}>
            <Text style={co.tapDoneText}>Complete payment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop:16 }} onPress={()=>setPhase('amount')}>
            <Text style={co.tapCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Receipt ──
  if (phase === 'done' && receipt) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={co.receiptWrap}>
          <View style={co.receiptCheck}><Ionicons name="checkmark" size={40} color="#fff"/></View>
          <Text style={co.receiptAmount}>${(receipt.amountCents/100).toFixed(2)}</Text>
          <Text style={co.receiptPaid}>Payment received</Text>

          <View style={co.receiptCard}>
            {[
              { l:'Method', v:'Tap to Pay' },
              { l:'Date',   v: receipt.at.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) },
              { l:'Time',   v: receipt.at.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) },
              { l:'Reference', v: receipt.ref.slice(-10).toUpperCase() },
            ].map(({l,v})=>(
              <View key={l} style={co.receiptRow}>
                <Text style={co.receiptRowL}>{l}</Text>
                <Text style={co.receiptRowV}>{v}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[s.btnPrimary,{ marginTop:24, alignSelf:'stretch' }]} onPress={reset}>
            <Text style={s.btnPrimaryText}>New sale</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Amount entry (number pad) ──
  const keys: Array<string> = ['1','2','3','4','5','6','7','8','9','note','0','back'];
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Checkout</Text></View>
      <View style={co.amountArea}>
        <Text style={co.amountLabel}>Custom amount</Text>
        <Text style={co.amountValue}>${display}</Text>
        {!!note && <Text style={co.amountNote}>{note}</Text>}
      </View>

      <View style={co.pad}>
        {keys.map(k => {
          if (k==='note') return (
            <TouchableOpacity key={k} style={co.key} onPress={()=>{
              Alert.prompt?.('Add a note', 'What is this charge for?', (t)=>setNote((t||'').slice(0,80)), 'plain-text', note);
            }}>
              <Ionicons name="create-outline" size={22} color={GRAY_500}/>
            </TouchableOpacity>
          );
          if (k==='back') return (
            <TouchableOpacity key={k} style={co.key} onPress={back} onLongPress={()=>setDigits('')}>
              <Ionicons name="backspace-outline" size={24} color={GRAY_700}/>
            </TouchableOpacity>
          );
          return (
            <TouchableOpacity key={k} style={co.key} onPress={()=>pressDigit(k)} activeOpacity={0.6}>
              <Text style={co.keyText}>{k}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[co.chargeBtn, (cents<50||loading) && { opacity:0.4 }]}
        disabled={cents<50||loading}
        onPress={charge}
        activeOpacity={0.85}>
        {loading
          ? <ActivityIndicator color="#fff"/>
          : <Text style={co.chargeBtnText}>Charge ${display}</Text>}
      </TouchableOpacity>
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
  const nav = useNavigation<any>();
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile]   = useState<Client|null>(null);

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

  // Hardware back closes the open profile instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (profile) { setProfile(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [profile]);

  function initials(name:string){ return name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase(); }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={BRAND}/></View>;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Customers</Text></View>
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={GRAY_400} style={{marginRight:8}}/>
        <TextInput style={s.searchInput} placeholder="Search by name, email…"
          placeholderTextColor={GRAY_400} value={search} onChangeText={setSearch}/>
      </View>
      <FlatList
        data={clients}
        keyExtractor={c=>c.id}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No customers found</Text></View>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true,search);}} tintColor={BRAND}/>}
        showsVerticalScrollIndicator={false}
        renderItem={({item:c})=>(
          <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={()=>setProfile(c)}>
            <View style={s.avatar}><Text style={s.avatarText}>{initials(c.name)}</Text></View>
            <View style={{flex:1}}>
              <Text style={s.clientName}>{c.name}</Text>
              <Text style={s.sub}>{c.email}</Text>
              {c.phone&&<Text style={s.sub}>{c.phone}</Text>}
              {c.totalVisits!==undefined&&<Text style={s.sub}>{c.totalVisits} visit{c.totalVisits!==1?'s':''}</Text>}
            </View>
            <TouchableOpacity style={s.msgBtn} onPress={()=>onMessage(c)}>
              <Ionicons name="chatbubble-outline" size={18} color={BRAND}/>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* Customer profile */}
      {profile && (
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={()=>setProfile(null)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={()=>{}}>
            <View style={s.sheetHandle}/>
            <View style={{ alignItems:'center', marginBottom:16 }}>
              <View style={[s.avatarLg,{ marginBottom:10 }]}><Text style={s.avatarLgText}>{initials(profile.name)}</Text></View>
              <Text style={s.sheetTitle}>{profile.name}</Text>
            </View>
            {[
              { l:'Email', v:profile.email },
              { l:'Phone', v:profile.phone || '—' },
              { l:'Visits', v: profile.totalVisits!==undefined ? String(profile.totalVisits) : '—' },
              { l:'Last visit', v: profile.lastVisit ? new Date(profile.lastVisit).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—' },
            ].map(({l,v})=>(
              <View key={l} style={s.detailRow}>
                <Text style={s.detailLabel}>{l}</Text>
                <Text style={s.detailValue}>{v}</Text>
              </View>
            ))}
            <View style={s.sheetActions}>
              <TouchableOpacity style={s.btnPrimary} onPress={()=>{ const c=profile; setProfile(null); onMessage(c); nav.navigate('Messages'); }}>
                <Text style={s.btnPrimaryText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary} onPress={()=>{ setProfile(null); nav.navigate('Book'); }}>
                <Text style={s.btnSecondaryText}>Book appointment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGhost} onPress={()=>setProfile(null)}><Text style={s.btnGhostText}>Close</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
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

// ── Menu / Settings hub ──────────────────────────────────────────────────────
type MoreView = 'menu' | 'services' | 'staff' | 'offers' | 'waitlist' | 'reviews'
  | 'marketing' | 'giftcards' | 'packages' | 'settings'
  | 'booking' | 'notifications' | 'reports' | 'addons' | 'subscriptions' | 'transactions' | 'soon';
function MenuScreen({ onLogout }: { onLogout:()=>void }) {
  const { user } = getAuth();
  const [view, setView]         = useState<MoreView>('menu');
  const [soonLabel, setSoonLabel] = useState('');
  const [services, setServices] = useState<Service[] | null>(null);
  const [staff, setStaff]       = useState<Staff[] | null>(null);
  const [offers, setOffers]     = useState<any[] | null>(null);
  const [waitlist, setWaitlist] = useState<any[] | null>(null);
  const [reviews, setReviews]   = useState<any | null>(null);
  const [campaigns, setCampaigns] = useState<any[] | null>(null);
  const [giftcards, setGiftcards] = useState<any[] | null>(null);
  const [packages, setPackages] = useState<any[] | null>(null);
  const [appts, setAppts]       = useState<Appointment[] | null>(null); // for Reports
  const [payments, setPayments] = useState<any[] | null>(null);
  const [biz, setBiz]           = useState<any | null>(null);
  const [loading, setLoading]   = useState(false);
  // Two-factor sign-in (seeded from the session, updated optimistically).
  const [twoFA, setTwoFA]       = useState<boolean>(getAuth().user?.twoFactorEnabled ?? false);
  const [twoFAMethod, setTwoFAMethod] = useState<'EMAIL'|'SMS'>(getAuth().user?.twoFactorMethod ?? 'EMAIL');
  const [twoFASaving, setTwoFASaving] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]|null>(null); // shown once on enable

  async function saveTwoFA(enabled: boolean, method: 'EMAIL'|'SMS') {
    setTwoFASaving(true);
    const prev = { enabled: twoFA, method: twoFAMethod };
    setTwoFA(enabled); setTwoFAMethod(method);
    try {
      const res = await api<{ recoveryCodes?: string[] }>('/auth/2fa', { method:'POST', body: JSON.stringify({ enabled, method }) });
      if (res.recoveryCodes?.length) setRecoveryCodes(res.recoveryCodes);
      if (!enabled) setRecoveryCodes(null);
    } catch (e) {
      setTwoFA(prev.enabled); setTwoFAMethod(prev.method); // roll back
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again.');
    } finally { setTwoFASaving(false); }
  }

  // Hardware back (Android) pops a sub-view back to the menu instead of leaving
  // the app. iOS keeps the on-screen ‹ back button in <Head/>.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view !== 'menu') { setView('menu'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [view]);

  function refundPayment(p: any) {
    const remaining = (p.amountCents - p.refundedCents) / 100;
    Alert.alert('Refund payment', `Refund $${remaining.toFixed(2)} to the customer?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Refund', style:'destructive', onPress: async () => {
        try {
          await api(`/payments/${p.id}/refund`, { method:'POST', body: JSON.stringify({}) });
          setPayments(await api<any[]>(`/payments`));
          Alert.alert('Refunded', 'The payment was refunded.');
        } catch(e){ Alert.alert('Refund failed', e instanceof Error ? e.message : 'Please try again.'); }
      }},
    ]);
  }

  async function open(v: MoreView) {
    setView(v);
    try {
      if (v === 'services' && !services) { setLoading(true); setServices(await api<Service[]>(`/businesses/${bizId()}/services`)); }
      else if (v === 'staff' && !staff)  { setLoading(true); setStaff(await api<Staff[]>(`/businesses/${bizId()}/staff`)); }
      else if (v === 'offers' && !offers){ setLoading(true); setOffers(await api<any[]>(`/businesses/${bizId()}/offers`)); }
      else if (v === 'waitlist' && !waitlist){ setLoading(true); setWaitlist(await api<any[]>(`/businesses/${bizId()}/waitlist`)); }
      else if (v === 'reviews' && !reviews){ setLoading(true); setReviews(await api<any>(`/businesses/${bizId()}/reviews`)); }
      else if (v === 'marketing' && !campaigns){ setLoading(true); setCampaigns(await api<any[]>(`/businesses/${bizId()}/campaigns`)); }
      else if (v === 'giftcards' && !giftcards){ setLoading(true); setGiftcards(await api<any[]>(`/businesses/${bizId()}/gift-cards`)); }
      else if (v === 'packages' && !packages){ setLoading(true); setPackages(await api<any[]>(`/businesses/${bizId()}/packages`)); }
      else if ((v === 'settings' || v === 'booking' || v === 'subscriptions' || v === 'notifications') && !biz) { setLoading(true); setBiz(await api<any>(`/businesses/${bizId()}`)); }
      else if (v === 'reports' && !appts) { setLoading(true); setAppts((await api<{data:Appointment[]}>(`/businesses/${bizId()}/bookings`)).data); }
      else if (v === 'transactions') { setLoading(true); setPayments(await api<any[]>(`/payments`)); }
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

  if (view === 'marketing') return (
    <SafeAreaView style={s.screen}>
      <Head title="Marketing"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(campaigns ?? []).map(c => (
            <View key={c.id} style={ms.card}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <Text style={ms.rowTitle}>{c.name}</Text>
                <View style={[ms.dealChip,{ backgroundColor: c.status==='SENT' ? '#D1FAE5' : c.status==='SENDING' ? '#FEF3C7' : GRAY_100 }]}>
                  <Text style={[ms.dealChipText,{ color: c.status==='SENT' ? '#065F46' : GRAY_700 }]}>{c.status}</Text>
                </View>
              </View>
              <Text style={[ms.rowMeta,{ marginTop:2 }]}>{c.channel} · {c.audience.toLowerCase()} audience</Text>
              {!!c.subject && <Text style={[ms.rowMeta,{ marginTop:2 }]} numberOfLines={1}>{c.subject}</Text>}
              <Text style={[ms.rowMeta,{ color:GRAY_400, marginTop:4 }]}>
                {c.status==='SENT' ? `Sent to ${c.sentCount} of ${c.recipientCount}` : `${c.recipientCount} recipients`}
                {c.sentAt ? ` · ${new Date(c.sentAt).toLocaleDateString()}` : ''}
              </Text>
            </View>
          ))}
          {campaigns && campaigns.length===0 && <Text style={ms.empty}>No campaigns yet. Create one on the web dashboard.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'giftcards') return (
    <SafeAreaView style={s.screen}>
      <Head title="Gift cards"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(giftcards ?? []).map(g => (
            <View key={g.id} style={[ms.card,{ borderLeftWidth:3, borderLeftColor: g.status==='ACTIVE' ? '#10B981' : GRAY_200 }]}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <Text style={[ms.rowTitle,{ fontVariant:['tabular-nums'] }]}>{g.code}</Text>
                <View style={[ms.dealChip,{ backgroundColor: g.status==='ACTIVE' ? '#D1FAE5' : GRAY_100 }]}>
                  <Text style={[ms.dealChipText,{ color: g.status==='ACTIVE' ? '#065F46' : GRAY_700 }]}>{g.status}</Text>
                </View>
              </View>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
                <Text style={ms.rowMeta}>Balance</Text>
                <PriceTag cents={g.balanceCents}/>
              </View>
              <Text style={[ms.rowMeta,{ color:GRAY_400, marginTop:4 }]}>
                {g.recipientName ? `For ${g.recipientName} · ` : ''}of ${(g.initialCents/100).toFixed(2)} issued
              </Text>
            </View>
          ))}
          {giftcards && giftcards.length===0 && <Text style={ms.empty}>No gift cards issued yet.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'packages') return (
    <SafeAreaView style={s.screen}>
      <Head title="Packages"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(packages ?? []).map(p => (
            <View key={p.id} style={ms.row}>
              <View style={[ms.dot,{ backgroundColor: p.active ? BRAND : GRAY_200 }]}/>
              <View style={{ flex:1 }}>
                <Text style={ms.rowTitle}>{p.name}</Text>
                <Text style={ms.rowMeta}>{p.credits} credit{p.credits===1?'':'s'}{p.active ? '' : ' · inactive'}</Text>
              </View>
              <PriceTag cents={p.priceCents}/>
            </View>
          ))}
          {packages && packages.length===0 && <Text style={ms.empty}>No packages yet. Create one on the web dashboard.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'booking') {
    const bookingUrl = `${WEB_URL}/book/${biz?.slug ?? ''}`;
    return (
      <SafeAreaView style={s.screen}>
        <Head title="Online Booking"/>
        {loading ? <Loader/> : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            <Text style={[ms.cardLabel,{ marginBottom:6, marginLeft:2 }]}>YOUR BOOKING PAGE</Text>
            <View style={ms.card}>
              <Text style={[ms.rowMeta,{ color:BRAND }]} numberOfLines={2}>{bookingUrl}</Text>
              <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                <TouchableOpacity style={[ms.methodChip,{ flex:1 }]} onPress={()=>Linking.openURL(bookingUrl)}>
                  <Text style={ms.methodChipText}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.methodChip,{ flex:1 }]} onPress={()=>Share.share({ message: bookingUrl })}>
                  <Text style={ms.methodChipText}>Share link</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[ms.cardLabel,{ marginTop:18, marginBottom:6, marginLeft:2 }]}>BOOKING-PAGE TOOLS</Text>
            {[
              { label:'Reviews', icon:'star-outline' as const, v:'reviews' as MoreView },
              { label:'Offers', icon:'pricetag-outline' as const, v:'offers' as MoreView },
            ].map((r,i,arr)=>(
              <TouchableOpacity key={r.label} style={[s.menuRow, i<arr.length-1&&s.menuRowBorder]} onPress={()=>open(r.v)} activeOpacity={0.7}>
                <View style={s.menuIcon}><Ionicons name={r.icon} size={20} color={BRAND}/></View>
                <Text style={s.menuLabel}>{r.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={GRAY_400}/>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (view === 'notifications') return (
    <SafeAreaView style={s.screen}>
      <Head title="Notifications"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          <Text style={[ms.cardLabel,{ marginBottom:6, marginLeft:2 }]}>EMAIL · ALL PLANS</Text>
          <View style={ms.card}>
            {['Booking confirmation','24-hour reminder','Cancellation notice','Reschedule notice','Review request'].map((n,i,arr)=>(
              <View key={n} style={[ms.notifRow, i<arr.length-1&&ms.notifRowBorder]}>
                <Text style={ms.rowTitle}>{n}</Text>
                <View style={ms.statusOn}><View style={ms.statusDot}/><Text style={ms.statusOnText}>Active</Text></View>
              </View>
            ))}
          </View>
          <Text style={[ms.cardLabel,{ marginTop:18, marginBottom:6, marginLeft:2 }]}>SMS · PAID PLANS</Text>
          <View style={ms.card}>
            <View style={ms.notifRow}>
              <Text style={ms.rowTitle}>2-hour reminder &amp; alerts</Text>
              {biz && biz.plan !== 'FREE'
                ? <View style={ms.statusOn}><View style={ms.statusDot}/><Text style={ms.statusOnText}>Active</Text></View>
                : <Text style={[ms.rowMeta,{ color:BRAND, fontWeight:'700' }]}>Upgrade</Text>}
            </View>
          </View>
          <Text style={[ms.empty,{ marginTop:10 }]}>Client texts are a paid-plan feature. Free-tier salons don&apos;t send client SMS.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'reports') {
    const list = appts ?? [];
    const now = Date.now();
    const todayKey = new Date().toDateString();
    const todayCount = list.filter(a => new Date(a.startsAt).toDateString()===todayKey).length;
    const upcoming = list.filter(a => ['PENDING','CONFIRMED'].includes(a.status) && +new Date(a.startsAt) > now).length;
    const completed = list.filter(a => a.status==='COMPLETED');
    const revenueCents = completed.reduce((sum,a)=> sum + (a.service?.priceCents ?? 0), 0);
    const stats = [
      { label:"Today's appointments", value:String(todayCount) },
      { label:'Upcoming', value:String(upcoming) },
      { label:'Completed (all time)', value:String(completed.length) },
      { label:'Revenue (completed)', value:`$${(revenueCents/100).toFixed(2)}` },
    ];
    return (
      <SafeAreaView style={s.screen}>
        <Head title="Reports"/>
        {loading ? <Loader/> : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            {stats.map(st => (
              <View key={st.label} style={[ms.card,{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}>
                <Text style={ms.cardLabel}>{st.label}</Text>
                <Text style={[ms.cardValue,{ marginTop:0 }]}>{st.value}</Text>
              </View>
            ))}
            <Text style={[ms.empty,{ marginTop:8 }]}>Detailed reports &amp; exports live on the web dashboard.</Text>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (view === 'transactions') {
    const PK: Record<string,string> = { DEPOSIT:'Deposit', NO_SHOW_FEE:'No-show fee', LATE_CANCEL_FEE:'Late-cancel fee', IN_PERSON:'In-person', OTHER:'Charge' };
    const SC: Record<string,string> = { SUCCEEDED:'#065F46', PENDING:'#B45309', FAILED:'#991B1B', REFUNDED:GRAY_700, PARTIALLY_REFUNDED:'#B45309', CANCELED:GRAY_700 };
    const SB: Record<string,string> = { SUCCEEDED:'#D1FAE5', PENDING:'#FEF3C7', FAILED:'#FEE2E2', REFUNDED:GRAY_100, PARTIALLY_REFUNDED:'#FEF3C7', CANCELED:GRAY_100 };
    return (
      <SafeAreaView style={s.screen}>
        <Head title="Transactions"/>
        {loading ? <Loader/> : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            {(payments ?? []).map(p => {
              const refundable = (p.status==='SUCCEEDED' || p.status==='PARTIALLY_REFUNDED') && (p.amountCents - p.refundedCents) > 0;
              return (
                <View key={p.id} style={ms.card}>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                    <Text style={ms.rowTitle}>${(p.amountCents/100).toFixed(2)}</Text>
                    <View style={[ms.dealChip,{ backgroundColor: SB[p.status] ?? GRAY_100 }]}>
                      <Text style={[ms.dealChipText,{ color: SC[p.status] ?? GRAY_700 }]}>{String(p.status).replace('_',' ')}</Text>
                    </View>
                  </View>
                  <Text style={[ms.rowMeta,{ marginTop:2 }]}>{PK[p.kind] ?? p.kind}{p.client ? ` · ${p.client.name}` : ''}</Text>
                  <Text style={[ms.rowMeta,{ color:GRAY_400, marginTop:2 }]}>{new Date(p.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} · {new Date(p.createdAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</Text>
                  {p.refundedCents > 0 && <Text style={[ms.rowMeta,{ color:'#B45309', marginTop:2 }]}>Refunded ${(p.refundedCents/100).toFixed(2)}</Text>}
                  {refundable && (
                    <TouchableOpacity style={[ms.methodChip,{ marginTop:10 }]} onPress={()=>refundPayment(p)}>
                      <Text style={ms.methodChipText}>Refund</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {payments && payments.length===0 && <Text style={ms.empty}>No transactions yet. In-person charges and deposits show here.</Text>}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (view === 'addons') return (
    <SafeAreaView style={s.screen}>
      <Head title="Add-ons"/>
      <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
        <View style={ms.card}>
          {[
            { label:'Gift cards', icon:'gift-outline' as const, v:'giftcards' as MoreView },
            { label:'Packages', icon:'cube-outline' as const, v:'packages' as MoreView },
            { label:'Marketing', icon:'megaphone-outline' as const, v:'marketing' as MoreView },
            { label:'Team', icon:'people-outline' as const, v:'staff' as MoreView },
          ].map((r,i,arr)=>(
            <TouchableOpacity key={r.label} style={[ms.notifRow, i<arr.length-1&&ms.notifRowBorder]} onPress={()=>open(r.v)} activeOpacity={0.7}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                <Ionicons name={r.icon} size={20} color={BRAND}/>
                <Text style={ms.rowTitle}>{r.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={GRAY_400}/>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (view === 'subscriptions') return (
    <SafeAreaView style={s.screen}>
      <Head title="Subscriptions"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          <View style={[ms.card,{ alignItems:'center', paddingVertical:22 }]}>
            <Text style={ms.cardLabel}>CURRENT PLAN</Text>
            <Text style={{ fontSize:30, fontWeight:'800', color:BRAND, marginTop:6 }}>{biz?.plan ?? 'FREE'}</Text>
            {biz?.planExpiresAt && <Text style={[ms.rowMeta,{ marginTop:4 }]}>Renews {new Date(biz.planExpiresAt).toLocaleDateString()}</Text>}
          </View>
          <Text style={[ms.empty,{ marginTop:8 }]}>Manage or upgrade your plan on the web dashboard.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'soon') return (
    <SafeAreaView style={s.screen}>
      <Head title={soonLabel}/>
      <View style={[s.center,{ padding:32 }]}>
        <View style={ms.soonIcon}><Ionicons name="construct-outline" size={28} color={BRAND}/></View>
        <Text style={[ms.rowTitle,{ marginTop:14, textAlign:'center' }]}>{soonLabel} is coming to the app</Text>
        <Text style={[ms.empty,{ marginTop:6, textAlign:'center' }]}>Manage {soonLabel.toLowerCase()} on the web dashboard for now.</Text>
      </View>
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

          <Text style={[ms.cardLabel,{ marginTop:14, marginBottom:6, marginLeft:2 }]}>SECURITY</Text>
          <View style={ms.card}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <View style={{ flex:1, paddingRight:12 }}>
                <Text style={ms.cardValue}>Two-factor sign-in</Text>
                <Text style={[ms.rowMeta,{ marginTop:2 }]}>Ask for a one-time code after your password.</Text>
              </View>
              <Switch
                value={twoFA}
                disabled={twoFASaving}
                onValueChange={(v)=>saveTwoFA(v, twoFAMethod)}
                trackColor={{ true: BRAND, false: GRAY_200 }}
                thumbColor="#fff"
              />
            </View>
            {twoFA && (
              <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                {(['EMAIL','SMS'] as const).map(m => (
                  <TouchableOpacity key={m} disabled={twoFASaving} onPress={()=>saveTwoFA(true, m)}
                    style={[ms.methodChip, twoFAMethod===m && ms.methodChipOn]}>
                    <Text style={[ms.methodChipText, twoFAMethod===m && { color:BRAND }]}>{m==='EMAIL'?'Email':'Text message'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {twoFA && twoFAMethod==='SMS' && (
              <Text style={[ms.rowMeta,{ color:'#B45309', marginTop:8 }]}>Add a mobile number to your account — codes fall back to email otherwise.</Text>
            )}
          </View>

          {recoveryCodes && (
            <View style={ms.recoveryBox}>
              <Text style={ms.recoveryTitle}>Save your recovery codes</Text>
              <Text style={ms.recoverySub}>Each works once. If you can&apos;t receive your code, enter one of these to sign in. They won&apos;t be shown again.</Text>
              <View style={ms.recoveryGrid}>
                {recoveryCodes.map(c => <Text key={c} style={ms.recoveryCode}>{c}</Text>)}
              </View>
              <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
                <TouchableOpacity style={[ms.methodChip,{ flex:1 }]} onPress={()=>Share.share({ message: `Pulse recovery codes:\n${recoveryCodes.join('\n')}` })}>
                  <Text style={ms.methodChipText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.methodChip,{ flex:1 }]} onPress={()=>setRecoveryCodes(null)}>
                  <Text style={ms.methodChipText}>I&apos;ve saved them</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={[ms.empty,{ marginTop:8 }]}>Editing business settings is coming to the app — manage those on the web dashboard for now.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );

  // ── default menu (exact spec order) ──
  const goSoon = (label:string) => { setSoonLabel(label); setView('soon'); };
  const MENU: Array<{ label:string; icon:any; onPress:()=>void }> = [
    { label:'Items & Services', icon:'pricetags-outline',       onPress:()=>open('services') },
    { label:'Online Booking',   icon:'globe-outline',           onPress:()=>open('booking') },
    { label:'Waitlist',         icon:'hourglass-outline',       onPress:()=>open('waitlist') },
    { label:'Notifications',    icon:'notifications-outline',   onPress:()=>open('notifications') },
    { label:'Invoices',         icon:'document-text-outline',   onPress:()=>goSoon('Invoices') },
    { label:'Estimates',        icon:'calculator-outline',      onPress:()=>goSoon('Estimates') },
    { label:'Transactions',     icon:'swap-horizontal-outline', onPress:()=>open('transactions') },
    { label:'Orders',           icon:'cart-outline',            onPress:()=>goSoon('Orders') },
    { label:'Reports',          icon:'bar-chart-outline',       onPress:()=>open('reports') },
    { label:'Money',            icon:'cash-outline',            onPress:()=>goSoon('Money') },
    { label:'Add-ons',          icon:'extension-puzzle-outline',onPress:()=>open('addons') },
    { label:'Subscriptions',    icon:'card-outline',            onPress:()=>open('subscriptions') },
    { label:'Support',          icon:'help-buoy-outline',       onPress:()=>Linking.openURL('mailto:support@pulseappointments.com') },
    { label:'Settings',         icon:'settings-outline',        onPress:()=>open('settings') },
  ];
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Menu</Text></View>
      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
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
          {MENU.map((r,i)=>(
            <TouchableOpacity key={r.label} style={[s.menuRow, i<MENU.length-1&&s.menuRowBorder]} onPress={r.onPress} activeOpacity={0.7}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

// Calendar agenda styles
const cal = StyleSheet.create({
  topbar:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:GRAY_100, backgroundColor:'#fff' },
  topBtn:        { width:32, height:32, alignItems:'center', justifyContent:'center' },
  monthWrap:     { flexDirection:'row', alignItems:'center' },
  monthText:     { fontSize:17, fontWeight:'700', color:GRAY_900 },
  dateHeader:    { backgroundColor:GRAY_50, paddingHorizontal:16, paddingVertical:8 },
  dateHeaderToday:{ backgroundColor:'#EFF6FF' },
  dateHeaderText:{ fontSize:12, fontWeight:'700', color:GRAY_500, letterSpacing:0.5 },
  dateHeaderTextToday:{ color:'#2563EB' },
  emptyDay:      { paddingHorizontal:16, paddingVertical:16, color:GRAY_400, fontSize:14 },
  aptRow:        { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:GRAY_100, backgroundColor:'#fff' },
  aptBar:        { width:3, height:38, borderRadius:2 },
  aptClient:     { fontSize:15, fontWeight:'700', color:GRAY_900 },
  aptService:    { fontSize:13, color:GRAY_500, marginTop:2 },
  aptTime:       { fontSize:15, fontWeight:'600', color:GRAY_900 },
  aptDur:        { fontSize:13, color:GRAY_500, marginTop:2 },
});

// Checkout / Tap to Pay styles
const co = StyleSheet.create({
  amountArea:   { alignItems:'center', paddingVertical:28 },
  amountLabel:  { fontSize:13, color:GRAY_500, marginBottom:8 },
  amountValue:  { fontSize:48, fontWeight:'800', color:GRAY_900, letterSpacing:-1 },
  amountNote:   { fontSize:13, color:GRAY_500, marginTop:8 },
  pad:          { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:24 },
  key:          { width:'33.33%', height:62, alignItems:'center', justifyContent:'center' },
  keyText:      { fontSize:26, fontWeight:'600', color:GRAY_900 },
  chargeBtn:    { backgroundColor:BRAND, margin:20, marginTop:12, borderRadius:16, paddingVertical:18, alignItems:'center' },
  chargeBtnText:{ color:'#fff', fontSize:17, fontWeight:'700' },
  // Tap to Pay full-screen
  tapWrap:      { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:32 },
  tapAmount:    { color:'#fff', fontSize:40, fontWeight:'800', marginBottom:28 },
  tapNfc:       { width:96, height:96, borderRadius:48, borderWidth:2, borderColor:'rgba(255,255,255,0.4)', alignItems:'center', justifyContent:'center', marginBottom:24 },
  tapTitle:     { color:'#fff', fontSize:22, fontWeight:'700', marginBottom:8 },
  tapSub:       { color:'rgba(255,255,255,0.7)', fontSize:14, textAlign:'center', lineHeight:20 },
  tapDone:      { marginTop:32, backgroundColor:'#fff', paddingVertical:15, borderRadius:14, alignSelf:'stretch', alignItems:'center' },
  tapDoneText:  { color:'#111827', fontWeight:'700', fontSize:16 },
  tapCancel:    { color:'rgba(255,255,255,0.6)', fontSize:14 },
  // Receipt
  receiptWrap:  { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:28 },
  receiptCheck: { width:72, height:72, borderRadius:36, backgroundColor:'#10B981', alignItems:'center', justifyContent:'center', marginBottom:20 },
  receiptAmount:{ fontSize:40, fontWeight:'800', color:GRAY_900 },
  receiptPaid:  { fontSize:15, color:GRAY_500, marginTop:4, marginBottom:24 },
  receiptCard:  { alignSelf:'stretch', backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:GRAY_100, paddingVertical:4 },
  receiptRow:   { flexDirection:'row', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:GRAY_50 },
  receiptRowL:  { color:GRAY_500, fontSize:14 },
  receiptRowV:  { color:GRAY_900, fontSize:14, fontWeight:'600' },
});

const ms = StyleSheet.create({
  row:       { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#fff', borderRadius:14, borderWidth:1, borderColor:GRAY_100, padding:14, marginBottom:10 },
  methodChip:  { flex:1, alignItems:'center', paddingVertical:10, borderRadius:12, borderWidth:1, borderColor:GRAY_200 },
  methodChipOn:{ borderColor:BRAND, backgroundColor:BRAND_LT },
  methodChipText:{ fontSize:14, fontWeight:'600', color:GRAY_700 },
  notifRow:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:14, paddingHorizontal:4 },
  notifRowBorder:{ borderBottomWidth:1, borderBottomColor:GRAY_50 },
  statusOn:    { flexDirection:'row', alignItems:'center', gap:6 },
  statusDot:   { width:7, height:7, borderRadius:4, backgroundColor:'#10B981' },
  statusOnText:{ fontSize:13, fontWeight:'600', color:'#047857' },
  soonIcon:    { width:60, height:60, borderRadius:30, backgroundColor:BRAND_LT, alignItems:'center', justifyContent:'center' },
  recoveryBox: { marginTop:12, borderWidth:1, borderColor:'#FCD34D', backgroundColor:'#FFFBEB', borderRadius:14, padding:14 },
  recoveryTitle:{ fontSize:14, fontWeight:'700', color:'#92400E' },
  recoverySub: { fontSize:12, color:'#B45309', marginTop:2, marginBottom:10 },
  recoveryGrid:{ flexDirection:'row', flexWrap:'wrap', backgroundColor:'#fff', borderRadius:10, borderWidth:1, borderColor:'#FDE68A', padding:10 },
  recoveryCode:{ width:'50%', fontSize:13, color:GRAY_900, paddingVertical:3, fontVariant:['tabular-nums'] },
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
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recovery, setRecovery] = useState('');

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
    if (!challenge) return;
    const entered = (recoveryMode ? recovery : code).trim();
    if (entered.length<4) return;
    setLoading(true);
    try {
      const res = await api<{accessToken:string;refreshToken:string;user:User}>('/auth/2fa/verify',{
        method:'POST', body:JSON.stringify({ challengeId: challenge.id, code: entered }),
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
          <Text style={s.loginTitle}>{recoveryMode ? 'Enter a recovery code' : 'Enter your code'}</Text>
          <Text style={s.loginSub}>
            {recoveryMode
              ? 'Enter one of the one-time recovery codes you saved when you turned on two-factor sign-in.'
              : `We sent a 6-digit code to your ${challenge.method==='SMS'?'phone':'email'}. It expires in 10 minutes.`}
          </Text>

          {recoveryMode ? (
            <>
              <Text style={[s.fieldLabel,{marginTop:12}]}>Recovery code</Text>
              <TextInput style={[s.input,{textAlign:'center',letterSpacing:2,fontSize:18}]} placeholder="xxxxx-xxxxx" placeholderTextColor={GRAY_400}
                autoCapitalize="none" autoCorrect={false} value={recovery} onChangeText={(t)=>setRecovery(t.trim())} onSubmitEditing={verify} autoFocus/>
            </>
          ) : (
            <>
              <Text style={[s.fieldLabel,{marginTop:12}]}>Verification code</Text>
              <TextInput style={[s.input,{textAlign:'center',letterSpacing:8,fontSize:20}]} placeholder="123456" placeholderTextColor={GRAY_400}
                keyboardType="number-pad" value={code} onChangeText={(t)=>setCode(t.replace(/\D/g,'').slice(0,6))} onSubmitEditing={verify} autoFocus/>
            </>
          )}

          <TouchableOpacity style={[s.btnPrimary,{marginTop:24}]} disabled={loading||(recoveryMode?recovery.trim().length<4:code.trim().length<4)} onPress={verify}>
            {loading?<ActivityIndicator color="#fff"/>:<Text style={s.btnPrimaryText}>Verify &amp; sign in</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={{ alignSelf:'center', marginTop:16 }} onPress={()=>setRecoveryMode(m=>!m)}>
            <Text style={s.authSwitchLink}>{recoveryMode ? 'Use the code we sent instead' : 'Lost access? Use a recovery code'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignSelf:'center', marginTop:12 }} onPress={()=>{setChallenge(null);setCode('');setRecovery('');setRecoveryMode(false);}}>
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
            tabBarActiveTintColor: GRAY_900,
            tabBarInactiveTintColor: GRAY_400,
            // Active tab = rounded grey pill behind the icon + label.
            tabBarActiveBackgroundColor: GRAY_100,
            tabBarStyle: { backgroundColor:'#fff', borderTopColor:GRAY_100, height:64, paddingTop:6, paddingBottom:8, paddingHorizontal:6 },
            tabBarItemStyle: { borderRadius:16, marginHorizontal:4, marginVertical:6 },
            tabBarLabelStyle: { fontSize:11, fontWeight:'600' },
            tabBarIcon: ({ color, size, focused }) => {
              const icons: Record<string,[string,string]> = {
                Calendar:['calendar','calendar-outline'], Checkout:['card','card-outline'],
                Customers:['people','people-outline'], Messages:['chatbubbles','chatbubbles-outline'],
                Menu:['menu','menu-outline'],
              };
              const pair = icons[route.name] ?? ['ellipse','ellipse-outline'];
              return <Ionicons name={(focused ? pair[0] : pair[1]) as any} size={size} color={color}/>;
            },
          })}
        >
          <Tab.Screen name="Calendar" component={CalendarScreen}/>
          <Tab.Screen name="Checkout" component={CheckoutScreen}/>
          <Tab.Screen name="Customers">
            {()=><ClientsScreen onMessage={c=>setMsgClient(c)}/>}
          </Tab.Screen>
          <Tab.Screen name="Messages">
            {()=><MessagesScreen initialClient={msgClient} onClearClient={()=>setMsgClient(null)}/>}
          </Tab.Screen>
          <Tab.Screen name="Menu">
            {()=><MenuScreen onLogout={handleLogout}/>}
          </Tab.Screen>
          {/* Hidden route — opened from the Calendar "+" to add an appointment. */}
          <Tab.Screen name="Book" component={BookScreen} options={{ tabBarButton: () => null }}/>
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
