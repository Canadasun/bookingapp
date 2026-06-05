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
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
interface Appointment { id:string; startsAt:string; endsAt:string; status:string; notes?:string; cancelReason?:string; service:{id:string;name:string;durationMinutes:number;priceCents:number}; staff:{id:string;user:{name:string}}; client:{id:string;name:string;email:string;phone?:string} }
interface ServiceCategory { id:string; name:string; color:string; sortOrder:number }
interface Service { id:string; name:string; durationMinutes:number; priceCents:number; color:string; active:boolean; description?:string; categoryId?:string|null; category?:ServiceCategory|null }
interface AvailabilityRule { id?:string; staffId?:string; dayOfWeek:number; startTime:string; endTime:string }
interface Staff { id:string; active?:boolean; user:{name:string; email?:string; role?:string}; staffServices:{serviceId:string}[]; availabilityRules?:AvailabilityRule[]; bio?:string }
interface Slot { startsAt:string; endsAt:string; startsAtLocal:string }
type BookingSlot = Slot & { staffId?:string; staffName?:string };
interface Client { id:string; name:string; email:string; phone?:string; totalVisits?:number; lastVisit?:string }
interface Message { id:string; content:string; fromClient:boolean; read:boolean; createdAt:string }
interface NotificationItem { id:string; kind:'BOOKING_NEW'|'BOOKING_UPDATE'|'PAYMENT'|'SYSTEM'; title:string; body?:string|null; linkUrl?:string|null; read:boolean; createdAt:string }
interface NotificationDelivery { id:string; channel:'EMAIL'|'SMS'|'PUSH'; recipient:string; type:string; status:'SENT'|'FAILED'|'SKIPPED'; error?:string|null; createdAt:string; retryReason?:string|null }
interface TaskItem { id:string; title:string; notes?:string|null; dueAt?:string|null; status:'OPEN'|'DONE'; staffId?:string|null; staff?:{id:string;user:{name:string}}|null }
interface ServiceDueItem { id:string; status:'SCHEDULED'|'DUE'|'SENT'|'CANCELLED'; dueAt:string; cadenceDays?:number|null; client:{id:string;name:string;email?:string;phone?:string}; service?:{id:string;name:string}|null }
interface ClientPortalAppointment extends Appointment { business:{id:string;name:string;slug?:string;phone?:string;address?:string}; manageToken?:string }
interface ClientPortalMessageThread { businessId:string; businessName:string; clientId:string; messages:Message[] }
interface ClientPortalOffer { id:string; title:string; description?:string; discount?:string; expiresAt?:string; business:{id:string;name:string;slug?:string} }

const STATUS_COLOR: Record<string,string> = {
  PENDING:'#F59E0B', CONFIRMED:'#10B981', CANCELLED:'#EF4444', COMPLETED:'#6B7280', NO_SHOW:'#1F2937',
};

const fmtTime = (value: string | Date) =>
  new Date(value).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false });

// Human duration, e.g. 75 → "1h 15m". Shared across the calendar and the service editor.
function fmtDur(min:number){ const h=Math.floor(min/60), r=min%60; if(h&&r) return `${h}h ${r}m`; return h?`${h}h`:`${min}m`; }

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

async function registerPushNotifications() {
  const { token, user } = getAuth();
  if (!token || !user) return;
  try {
    // Optional at runtime so local type-checks do not require the native module
    // before dependencies are installed. EAS installs expo-notifications from package.json.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    const current = await Notifications.getPermissionsAsync();
    const finalStatus = current.status === 'granted'
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== 'granted') return;
    const result = await Notifications.getExpoPushTokenAsync();
    const pushToken = result?.data;
    if (!pushToken) return;
    await api('/users/me/device-token', {
      method:'POST',
      body: JSON.stringify({ token: pushToken, platform: Platform.OS.toUpperCase() }),
    }).catch(() => {});
  } catch {
    // Push is best-effort; never block login or app launch.
  }
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
// Small "Verified" trust pill — mirrors the (now compact) web badge. Only render
// when the business has been approved by a Pulse admin.
function VerifiedPill() {
  return (
    <View style={s.verifiedPill}>
      <Ionicons name="shield-checkmark" size={10} color="#fff"/>
      <Text style={s.verifiedPillText}>Verified</Text>
    </View>
  );
}

// ── Appointments screen ──────────────────────────────────────────────────────
function CalendarScreen() {
  const { user } = getAuth();
  const nav = useNavigation<any>();
  const [apts, setApts]       = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]     = useState<Appointment|null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL'|'PENDING'|'CONFIRMED'|'COMPLETED'|'CANCELLED'|'NO_SHOW'>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  // Calendar date strip: null = full upcoming agenda; a toDateString() key = that day only.
  const [dayFilter, setDayFilter] = useState<string|null>(null);
  const [reschedule, setReschedule] = useState<{ appointment:Appointment; date:string; slots:Slot[]; loading:boolean }|null>(null);
  const [editAppt, setEditAppt] = useState<{ appointment:Appointment; name:string; email:string; phone:string; notes:string; notifyClient:boolean }|null>(null);
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
  async function syncCalendar(id:string) {
    setActing(true);
    try {
      await api(`/calendar-sync/${id}`, { method:'POST' });
      Alert.alert('Calendar sync queued', 'This appointment was sent to the calendar sync service.');
    } catch(e) {
      Alert.alert('Sync failed', e instanceof Error ? e.message : 'Please try again.');
    } finally { setActing(false); }
  }
  async function openReschedule(a: Appointment) {
    const today = new Date().toISOString().slice(0, 10);
    setSelected(null);
    setReschedule({ appointment: a, date: today, slots: [], loading: true });
    await loadRescheduleSlots(a, today);
  }

  async function loadRescheduleSlots(a: Appointment, d: string) {
    setReschedule(prev => prev ? { ...prev, date: d, loading: true, slots: [] } : prev);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await api<Slot[]>(`/availability/slots?staffId=${a.staff.id}&serviceId=${a.service.id}&startDate=${d}&endDate=${d}&timezone=${tz}`);
      setReschedule(prev => prev ? { ...prev, date: d, slots: data, loading: false } : prev);
    } catch(e) {
      setReschedule(prev => prev ? { ...prev, loading: false } : prev);
      Alert.alert('Could not load slots', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function saveReschedule(startsAt: string) {
    if (!reschedule) return;
    setActing(true);
    try {
      await api(`/businesses/${bizId()}/bookings/${reschedule.appointment.id}/reschedule`, {
        method:'PATCH',
        body: JSON.stringify({ startsAt }),
      });
      setReschedule(null);
      load(true);
      Alert.alert('Rescheduled', 'The appointment was moved and the client was notified.');
    } catch(e) {
      Alert.alert('Could not reschedule', e instanceof Error ? e.message : 'Please try again.');
    } finally { setActing(false); }
  }

  function openEdit(a: Appointment) {
    setSelected(null);
    setEditAppt({
      appointment: a,
      name: a.client.name,
      email: a.client.email,
      phone: a.client.phone ?? '',
      notes: a.notes ?? '',
      notifyClient: true,
    });
  }

  async function saveAppointmentEdit() {
    if (!editAppt) return;
    if (!editAppt.name.trim() || !editAppt.email.trim()) {
      Alert.alert('Check details', 'Client name and email are required.');
      return;
    }
    setActing(true);
    try {
      await api(`/businesses/${bizId()}/bookings/${editAppt.appointment.id}`, {
        method:'PATCH',
        body: JSON.stringify({
          clientName: editAppt.name.trim(),
          clientEmail: editAppt.email.trim().toLowerCase(),
          clientPhone: editAppt.phone.trim() || undefined,
          notes: editAppt.notes.trim(),
          notifyClient: editAppt.notifyClient,
        }),
      });
      setEditAppt(null);
      load(true);
      Alert.alert('Saved', editAppt.notifyClient ? 'The client was notified.' : 'Saved without notifying the client.');
    } catch(e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally { setActing(false); }
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
  const visibleApts = apts.filter(a =>
    (statusFilter === 'ALL' || a.status === statusFilter) &&
    (staffFilter === 'ALL' || a.staff.id === staffFilter)
  );
  for (const a of visibleApts) {
    const k = dayKey(a.startsAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(a);
  }
  // Future-and-today days ascending; always include today (even if empty).
  const todayMs = new Date(TODAY_KEY).getTime();
  const allDayKeys = Array.from(new Set([TODAY_KEY, ...byDay.keys()]))
    .filter(k => new Date(k).getTime() >= todayMs)
    .sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
  // A 14-day horizontal strip starting today, so the screen reads as a calendar.
  const STRIP_DAYS = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+i);
    const key = d.toDateString();
    return { key, date: d, count: (byDay.get(key) ?? []).length };
  });
  // When a strip day is picked, show only that day; otherwise the full upcoming agenda.
  const dayKeys = dayFilter ? [dayFilter] : allDayKeys;
  const sections = dayKeys.map(k => ({
    key: k,
    isToday: k === TODAY_KEY,
    title: new Date(k).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase(),
    data: (byDay.get(k) ?? []).sort((a,b)=> +new Date(a.startsAt) - +new Date(b.startsAt)),
  }));

  function openMenu() {
    Alert.alert('Calendar', undefined, [
      { text:'Refresh', onPress:()=>{ setRefreshing(true); load(true); } },
      { text:'New appointment', onPress:()=>nav.navigate('Book') },
      { text:'Close', style:'cancel' },
    ]);
  }

  const monthLabel = new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const staffOptions = Array.from(new Map(apts.map(a => [a.staff.id, a.staff.user.name])).entries());

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingHorizontal:16, paddingBottom:8 }}>
        {(['ALL','PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'] as const).map(status => (
          <TouchableOpacity key={status} onPress={()=>setStatusFilter(status)}
            style={[cal.filterChip, statusFilter===status && cal.filterChipOn]}>
            <Text style={[cal.filterText, statusFilter===status && cal.filterTextOn]}>{status.replace('_',' ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingHorizontal:16, paddingBottom:8 }}>
        <TouchableOpacity onPress={()=>setStaffFilter('ALL')} style={[cal.filterChip, staffFilter==='ALL' && cal.filterChipOn]}>
          <Text style={[cal.filterText, staffFilter==='ALL' && cal.filterTextOn]}>All staff</Text>
        </TouchableOpacity>
        {staffOptions.map(([id,name]) => (
          <TouchableOpacity key={id} onPress={()=>setStaffFilter(id)} style={[cal.filterChip, staffFilter===id && cal.filterChipOn]}>
            <Text style={[cal.filterText, staffFilter===id && cal.filterTextOn]}>{name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Calendar date strip — tap a day to focus it; dot = has appointments */}
      <View style={cal.stripWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingHorizontal:16 }}>
          <TouchableOpacity onPress={()=>setDayFilter(null)} style={[cal.allDay, dayFilter===null && cal.allDayOn]}>
            <Ionicons name="albums-outline" size={16} color={dayFilter===null ? '#fff' : GRAY_500}/>
            <Text style={[cal.allDayText, dayFilter===null && { color:'#fff' }]}>All</Text>
          </TouchableOpacity>
          {STRIP_DAYS.map(({ key, date, count }) => {
            const on = dayFilter === key;
            const isToday = key === TODAY_KEY;
            return (
              <TouchableOpacity key={key} onPress={()=>setDayFilter(on ? null : key)} style={[cal.dayCell, on && cal.dayCellOn]}>
                <Text style={[cal.dayDow, on && { color:'#fff' }, !on && isToday && { color:BRAND }]}>
                  {date.toLocaleDateString('en-US',{ weekday:'short' }).toUpperCase()}
                </Text>
                <Text style={[cal.dayNum, on && { color:'#fff' }, !on && isToday && { color:BRAND }]}>{date.getDate()}</Text>
                <View style={[cal.dayDot, count>0 && (on ? { backgroundColor:'#fff' } : { backgroundColor:BRAND })]}/>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
          ? <Text style={cal.emptyDay}>No appointments this day.</Text>
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
                <Text style={cal.aptTime}>{fmtTime(d)}</Text>
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
                {new Date(selected.startsAt).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} at {fmtTime(selected.startsAt)}
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
              <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>openEdit(selected)}><Text style={s.btnSecondaryText}>Edit details</Text></TouchableOpacity>
              {['PENDING','CONFIRMED'].includes(selected.status) && <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>openReschedule(selected)}><Text style={s.btnSecondaryText}>Reschedule</Text></TouchableOpacity>}
              {['PENDING','CONFIRMED'].includes(selected.status) && <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>syncCalendar(selected.id)}><Text style={s.btnSecondaryText}>Sync calendar</Text></TouchableOpacity>}
              {['PENDING','CONFIRMED'].includes(selected.status) && (
                <TouchableOpacity style={s.btnDanger} disabled={acting} onPress={()=>cancel(selected.id)}><Text style={s.btnDangerText}>Cancel</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnGhost} onPress={()=>setSelected(null)}><Text style={s.btnGhostText}>Close</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <Modal visible={!!reschedule} animationType="slide" onRequestClose={()=>setReschedule(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setReschedule(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Reschedule</Text>
          </View>
          {reschedule && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.stepLabel}>{reschedule.appointment.client.name}</Text>
              <Text style={s.sub}>{reschedule.appointment.service.name} with {reschedule.appointment.staff.user.name}</Text>
              <Text style={[s.fieldLabel,{ marginTop:16 }]}>Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingVertical:8 }}>
                {Array.from({ length:21 }, (_,i) => { const d = new Date(); d.setDate(d.getDate()+i); return d.toISOString().slice(0,10); }).map(d => (
                  <TouchableOpacity key={d} style={[s.datePill, reschedule.date===d && s.datePillActive]} onPress={()=>loadRescheduleSlots(reschedule.appointment, d)}>
                    <Text style={[s.datePillDay, reschedule.date===d && { color:'#fff' }]}>{new Date(d+'T00:00:00').toLocaleDateString('en-US',{ weekday:'short' })}</Text>
                    <Text style={[s.datePillNum, reschedule.date===d && { color:'#fff' }]}>{new Date(d+'T00:00:00').getDate()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {reschedule.loading ? <ActivityIndicator color={BRAND} style={{ marginTop:20 }}/> : (
                <View style={s.slotGrid}>
                  {reschedule.slots.map(sl => (
                    <TouchableOpacity key={sl.startsAt} style={s.slotBtn} disabled={acting} onPress={()=>saveReschedule(sl.startsAt)}>
                      <Text style={s.slotText}>{fmtTime(sl.startsAt)}</Text>
                    </TouchableOpacity>
                  ))}
                  {reschedule.slots.length===0 && <Text style={s.emptyText}>No available times for this date.</Text>}
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={!!editAppt} animationType="slide" onRequestClose={()=>setEditAppt(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setEditAppt(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Edit appointment</Text>
          </View>
          {editAppt && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.stepLabel}>{editAppt.appointment.service.name}</Text>
              <Text style={s.sub}>{new Date(editAppt.appointment.startsAt).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} at {fmtTime(editAppt.appointment.startsAt)}</Text>

              <Text style={[s.fieldLabel,{ marginTop:16 }]}>Client name</Text>
              <TextInput style={s.input} value={editAppt.name} onChangeText={name=>setEditAppt({...editAppt,name})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Client email</Text>
              <TextInput style={s.input} value={editAppt.email} autoCapitalize="none" keyboardType="email-address" onChangeText={email=>setEditAppt({...editAppt,email})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Client phone</Text>
              <TextInput style={s.input} value={editAppt.phone} keyboardType="phone-pad" onChangeText={phone=>setEditAppt({...editAppt,phone})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Notes</Text>
              <TextInput style={[s.input,{ minHeight:90, textAlignVertical:'top' }]} value={editAppt.notes} multiline onChangeText={notes=>setEditAppt({...editAppt,notes})}/>

              <View style={[s.switchRow,{ marginTop:16 }]}>
                <View style={{ flex:1 }}>
                  <Text style={s.switchTitle}>Notify client</Text>
                  <Text style={s.switchSub}>Send an email with the updated booking details.</Text>
                </View>
                <Switch value={editAppt.notifyClient} onValueChange={notifyClient=>setEditAppt({...editAppt,notifyClient})} trackColor={{ true: BRAND, false: GRAY_200 }} thumbColor="#fff"/>
              </View>

              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} disabled={acting} onPress={saveAppointmentEdit}>
                {acting ? <ActivityIndicator color="#fff"/> : <Text style={s.btnPrimaryText}>Save changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
              { l:'Time',   v: fmtTime(receipt.at) },
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
  const [slots, setSlots]             = useState<BookingSlot[]>([]);
  const [selectedSvcs, setSelectedSvcs] = useState<Service[]>([]);
  const [staff, setStaff]             = useState<Staff|null|'any'>(null);
  const [date, setDate]               = useState('');
  const [slot, setSlot]               = useState<BookingSlot|null>(null);
  const [showStaffStep, setShowStaffStep] = useState(false);
  const [customStartsAt, setCustomStartsAt] = useState('');
  const [overrideCalendar, setOverrideCalendar] = useState(false);
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
      const all = await api<Staff[]>(`/businesses/${bizId()}/staff`);
      const filtered = all.filter(st => st.staffServices.length === 0 || selectedSvcs.every(sv => st.staffServices.some(ss=>ss.serviceId === sv.id)));
      const hasAddedStaff = all.some(st => st.user.role !== 'OWNER');
      setStaffList(filtered);
      setShowStaffStep(hasAddedStaff);
      if (hasAddedStaff) {
        setStep('staff');
      } else {
        setStaff(filtered[0] ?? 'any');
        setStep('date');
      }
    } catch { Alert.alert('Error','Could not load staff'); }
  }

  async function pickDate(d: string) {
    setDate(d); setLoading(true); setSlots([]);
    try {
      const serviceId = selectedSvcs[0]?.id ?? '';
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const targets = staff && staff !== 'any' ? [staff] : staffList;
      if (targets.length === 0 || !serviceId) { Alert.alert('Provider required','No active provider is available for this service.'); return; }
      const rows = await Promise.all(targets.map(async st => {
        const data = await api<Slot[]>(`/availability/slots?staffId=${st.id}&serviceId=${serviceId}&startDate=${d}&endDate=${d}&timezone=${tz}`);
        return data.map(sl => ({...sl, staffId:st.id, staffName:st.user.name}));
      }));
      setSlots(rows.flat().sort((a,b)=>new Date(a.startsAt).getTime()-new Date(b.startsAt).getTime()));
      setStep('time');
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
      const customDate = customStartsAt.trim() ? new Date(customStartsAt.trim().replace(' ', 'T')) : null;
      if (customStartsAt && Number.isNaN(customDate?.getTime())) { Alert.alert('Check time','Use YYYY-MM-DD HH:mm for custom owner time.'); return; }
      const startsAt = customDate ? customDate.toISOString() : slot?.startsAt;
      const staffId = customDate
        ? (staff && staff !== 'any' ? staff.id : (staffList[0]?.id ?? ''))
        : (staff && staff !== 'any' ? staff.id : (slot?.staffId ?? staffList[0]?.id ?? ''));
      if (!staffId){ Alert.alert('Provider required','Choose a provider before booking.'); return; }
      if (!startsAt){ Alert.alert('Time required','Choose an available time or enter a custom owner time.'); return; }
      const client = await api<{id:string; matched?:boolean}>(`/businesses/${bizId()}/clients`, {
        method:'POST', body: JSON.stringify({name:form.name.trim(),email:form.email.trim(),phone:normalizedPhone}),
      });
      // Owner/staff booking from the app → confirmed immediately (the /manual
      // endpoint skips approval and sends the client their confirmation).
      const apt = await api<{id:string}>(`/businesses/${bizId()}/bookings/manual`, {
        method:'POST', body: JSON.stringify({
          staffId,
          serviceId:selectedSvcs[0].id,
          additionalServiceIds: selectedSvcs.slice(1).map(s => s.id),
          clientId:client.id,
          startsAt,
          allowOverride: overrideCalendar || !!customStartsAt,
        }),
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
    setStaffList([]); setShowStaffStep(false); setCustomStartsAt(''); setOverrideCalendar(false);
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
              activeOpacity={0.7} disabled={staffList.length===0} onPress={()=>{setStaff('any');setStep('date');}}>
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
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep(showStaffStep ? 'staff' : 'service')}><Text style={s.backText}>← Back</Text></TouchableOpacity>
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
            <View style={[s.policyBox,{ marginBottom:14 }]}>
              <Text style={s.policyTitle}>Custom owner time</Text>
              <Text style={s.policyText}>Enter YYYY-MM-DD HH:mm to book outside generated calendar slots. This uses the owner provider for solo businesses and can override calendar conflicts.</Text>
              <TextInput style={[s.input,{ marginTop:10 }]} placeholder="2026-06-05 14:00" placeholderTextColor={GRAY_400}
                value={customStartsAt} onChangeText={(v)=>{setCustomStartsAt(v); setOverrideCalendar(!!v); if(v) setSlot(null);}}/>
              <TouchableOpacity style={s.policyCheck} activeOpacity={0.7} onPress={()=>setOverrideCalendar(p=>!p)}>
                <View style={[s.checkbox, overrideCalendar&&s.checkboxActive]}>
                  {overrideCalendar&&<Ionicons name="checkmark" size={12} color="#fff"/>}
                </View>
                <Text style={s.policyCheckText}>Override availability and conflicts</Text>
              </TouchableOpacity>
              {customStartsAt && (
                <TouchableOpacity style={[s.btnSecondary,{ marginTop:10 }]} onPress={()=>setStep('details')}>
                  <Text style={s.btnSecondaryText}>Use custom time</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading&&<ActivityIndicator color={BRAND} style={{marginTop:20}}/>}
            {!loading&&slots.length===0&&<Text style={s.emptyText}>No availability on this date — try another</Text>}
            <View style={s.slotGrid}>
              {slots.map(sl=>(
                <TouchableOpacity key={`${sl.staffId ?? 'staff'}-${sl.startsAt}`} style={[s.slotBtn, slot?.startsAt===sl.startsAt&&slot?.staffId===sl.staffId&&s.slotBtnActive]}
                  onPress={()=>{setSlot(sl);setStep('details');}}>
                  <Text style={[s.slotText, slot?.startsAt===sl.startsAt&&slot?.staffId===sl.staffId&&s.slotTextActive]}>
                    {fmtTime(sl.startsAtLocal)}
                  </Text>
                  {showStaffStep && sl.staffName && <Text style={[s.sub,{fontSize:10,textAlign:'center',marginTop:2}]} numberOfLines={1}>{sl.staffName}</Text>}
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
                {staff&&staff!=='any'?(staff as Staff).user.name:(slot?.staffName ?? 'Owner provider')} · {customStartsAt ? customStartsAt : `${date.slice(5).replace('-','/')} at ${slot ? fmtTime(slot.startsAtLocal) : ''}`}
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
  const [plan, setPlan]         = useState<string>('FREE');
  const scrollRef = useRef<ScrollView>(null);

  const loadThreads = useCallback(async () => {
    try {
      const [threadData, bizData] = await Promise.all([
        api<any[]>(`/businesses/${bizId()}/messages`),
        api<any>(`/businesses/${bizId()}`).catch(() => ({ plan: 'FREE' }))
      ]);
      setThreads(threadData);
      setPlan(bizData.plan);
    }
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
    if (plan === 'FREE') {
      Alert.alert('Upgrade Required', 'Messaging is a paid feature. Please upgrade to BASIC or PRO to reply to clients.');
      return;
    }
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
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={Platform.OS==='ios'?88:0}>
        <ScrollView ref={scrollRef} contentContainerStyle={{padding:16}} showsVerticalScrollIndicator={false}>
          {msgs.length===0&&<Text style={[s.emptyText,{textAlign:'center',marginTop:40}]}>No messages yet</Text>}
          {msgs.map(m=>(
            <View key={m.id} style={[s.bubble, m.fromClient?s.bubbleLeft:s.bubbleRight]}>
              <Text style={[s.bubbleText, m.fromClient?s.bubbleTextLeft:s.bubbleTextRight]}>{m.content}</Text>
              <Text style={s.bubbleTime}>{fmtTime(m.createdAt)}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.composeRow}>
          {plan === 'FREE' ? (
            <View style={{flex:1, backgroundColor:GRAY_50, borderRadius:12, padding:12, alignItems:'center', borderStyle:'dashed', borderWidth:1, borderColor:GRAY_200}}>
              <Text style={{fontSize:12, color:GRAY_500, textAlign:'center'}}>
                🔒 Messaging is a paid feature. Upgrade to BASIC or PRO to reply to clients.
              </Text>
            </View>
          ) : (
            <>
              <TextInput style={s.composeInput} placeholder="Type a message…" placeholderTextColor={GRAY_400}
                value={reply} onChangeText={setReply} multiline returnKeyType="send" onSubmitEditing={send}/>
              <TouchableOpacity style={[s.sendBtn, (!reply.trim()||sending)&&{opacity:0.4}]}
                disabled={!reply.trim()||sending} onPress={send}>
                <Ionicons name="send" size={18} color="#fff"/>
              </TouchableOpacity>
            </>
          )}
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
              <Text style={s.msgTime}>{fmtTime(t.createdAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all'|'unread'>('all');

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try { setItems(await api<NotificationItem[]>('/notifications')); }
    catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load notifications'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function open(item: NotificationItem) {
    if (!item.read) {
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, read:true } : n));
      await api(`/notifications/${item.id}/read`, { method:'POST' }).catch(() => {});
    }
    if (item.linkUrl) Alert.alert(item.title, item.body || 'Open this item from the web dashboard for the linked detail.');
  }

  async function markAll() {
    setItems(prev => prev.map(n => ({ ...n, read:true })));
    await api('/notifications/read-all', { method:'POST' }).catch(() => {});
  }

  const unread = items.filter(n => !n.read).length;
  const visible = filter === 'unread' ? items.filter(n => !n.read) : items;
  const iconFor = (kind: NotificationItem['kind']) =>
    kind === 'PAYMENT' ? 'card-outline' :
    kind === 'SYSTEM' ? 'shield-checkmark-outline' :
    kind === 'BOOKING_NEW' ? 'calendar-outline' : 'chatbubble-ellipses-outline';

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={BRAND}/></View>;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Alerts</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAll}>
            <Text style={{ color:BRAND, fontSize:12, fontWeight:'700' }}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ flexDirection:'row', gap:8, paddingHorizontal:16, paddingTop:12 }}>
        {(['all','unread'] as const).map(k => (
          <TouchableOpacity key={k} onPress={()=>setFilter(k)}
            style={{ paddingHorizontal:14, paddingVertical:8, borderRadius:99, backgroundColor:filter===k?BRAND:GRAY_100 }}>
            <Text style={{ fontSize:12, fontWeight:'700', color:filter===k?'#fff':GRAY_700 }}>
              {k === 'all' ? `All (${items.length})` : `Unread (${unread})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={visible}
        keyExtractor={i=>i.id}
        contentContainerStyle={[s.listContent, visible.length===0 && { flexGrow:1, justifyContent:'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={BRAND}/>}
        ListEmptyComponent={<Text style={s.emptyText}>No alerts to show.</Text>}
        renderItem={({item})=>(
          <TouchableOpacity style={[s.card, !item.read && { borderColor:BRAND_LT, backgroundColor:'#FFFBF6' }]} onPress={()=>open(item)}>
            <View style={{ width:36, height:36, borderRadius:12, backgroundColor:item.read?GRAY_100:BRAND_LT, alignItems:'center', justifyContent:'center' }}>
              <Ionicons name={iconFor(item.kind) as any} size={18} color={item.read?GRAY_500:BRAND}/>
            </View>
            <View style={s.cardBody}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <Text style={[s.clientName, { flex:1 }]} numberOfLines={1}>{item.title}</Text>
                {!item.read && <View style={{ width:8, height:8, borderRadius:4, backgroundColor:BRAND }}/>}
              </View>
              {!!item.body && <Text style={s.sub} numberOfLines={2}>{item.body}</Text>}
              <Text style={s.dateText}>{new Date(item.createdAt).toLocaleDateString([], { month:'short', day:'numeric' })} {fmtTime(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

// ── Menu / Settings hub ──────────────────────────────────────────────────────
type MoreView = 'menu' | 'services' | 'staff' | 'offers' | 'waitlist' | 'reviews'
  | 'marketing' | 'giftcards' | 'packages' | 'settings'
  | 'booking' | 'notifications' | 'reports' | 'addons' | 'subscriptions' | 'transactions' | 'tasks' | 'followups' | 'soon';
function MenuScreen({ onLogout }: { onLogout:()=>void }) {
  const { user } = getAuth();
  const nav = useNavigation<any>();
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
  const [issuedPackages, setIssuedPackages] = useState<any[] | null>(null);
  const [tasks, setTasks]       = useState<TaskItem[] | null>(null);
  const [followups, setFollowups] = useState<ServiceDueItem[] | null>(null);
  const [appts, setAppts]       = useState<Appointment[] | null>(null); // for Reports
  const [payments, setPayments] = useState<any[] | null>(null);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[] | null>(null);
  const [biz, setBiz]           = useState<any | null>(null);
  const [loading, setLoading]   = useState(false);
  const [serviceEditor, setServiceEditor] = useState<{ id?:string; name:string; durationMinutes:string; price:string; active:boolean }|null>(null);
  const [offerEditor, setOfferEditor] = useState<{ id?:string; title:string; description:string; discount:string; expiresAt:string }|null>(null);
  const [giftMode, setGiftMode] = useState<null|'issue'|'redeem'>(null);
  const [giftIssue, setGiftIssue] = useState({ amount:'50', recipientName:'', recipientEmail:'', message:'' });
  const [giftRedeem, setGiftRedeem] = useState({ code:'', amount:'' });
  const [packageTab, setPackageTab] = useState<'products'|'issued'>('products');
  const [packageEditor, setPackageEditor] = useState<{ name:string; serviceId:string; credits:string; price:string }|null>(null);
  const [packageIssue, setPackageIssue] = useState<{ client:Client|null; search:string; packageId:string; results:Client[] }|null>(null);
  const [campaignEditor, setCampaignEditor] = useState<{ name:string; channel:'EMAIL'|'SMS'; audience:'ALL'|'RECENT'|'LAPSED'; subject:string; body:string; count:number|null }|null>(null);
  const [taskEditor, setTaskEditor] = useState<{ title:string; staffId:string; dueAt:string; notes:string }|null>(null);
  const [settingsEditor, setSettingsEditor] = useState<{ name:string; email:string; phone:string; address:string; minNoticeMinutes:string; maxAdvanceDays:string; cancellationWindowHours:string; requireDeposit:boolean; depositPercent:string }|null>(null);
  const [timeOffEditor, setTimeOffEditor] = useState<{ staffId:string; name:string; startsAt:string; endsAt:string; reason:string }|null>(null);
  const [staffServiceEditor, setStaffServiceEditor] = useState<{ staffId:string; name:string; serviceIds:string[] }|null>(null);
  const [followupBusy, setFollowupBusy] = useState<string|null>(null);
  const [followupSnoozing, setFollowupSnoozing] = useState<string|null>(null);
  const [availabilityEditor, setAvailabilityEditor] = useState<{
    staffId:string;
    name:string;
    days:Array<{ dayOfWeek:number; enabled:boolean; startTime:string; endTime:string }>;
  }|null>(null);
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
      const res = await api<{ recoveryCodes?: string[]; user?: User }>('/auth/2fa', { method:'POST', body: JSON.stringify({ enabled, method }) });
      if (res.user) {
        setAuth(getAuth().token, res.user, getAuth().refresh);
        await persistAuth();
        setTwoFA(!!res.user.twoFactorEnabled);
        setTwoFAMethod(res.user.twoFactorMethod ?? method);
      }
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

  async function saveService() {
    if (!serviceEditor?.name.trim()) return;
    const durationMinutes = Number.parseInt(serviceEditor.durationMinutes, 10);
    const priceCents = Math.round(Number.parseFloat(serviceEditor.price || '0') * 100);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(priceCents) || priceCents < 0) {
      Alert.alert('Check service', 'Enter a valid duration and price.');
      return;
    }
    try {
      const payload = {
        name: serviceEditor.name.trim(),
        durationMinutes,
        priceCents,
        color: BRAND,
        active: serviceEditor.active,
      };
      if (serviceEditor.id) await api(`/businesses/${bizId()}/services/${serviceEditor.id}`, { method:'PATCH', body: JSON.stringify(payload) });
      else await api(`/businesses/${bizId()}/services`, { method:'POST', body: JSON.stringify(payload) });
      setServices(await api<Service[]>(`/businesses/${bizId()}/services`));
      setServiceEditor(null);
    } catch(e) {
      Alert.alert('Could not save service', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  function openOfferEditor(of?: any) {
    setOfferEditor(of ? {
      id: of.id,
      title: of.title ?? '',
      description: of.description ?? '',
      discount: of.discount ?? '',
      expiresAt: of.expiresAt ? String(of.expiresAt).slice(0, 16).replace('T', ' ') : '',
    } : { title:'', description:'', discount:'', expiresAt:'' });
  }

  async function saveOffer() {
    if (!offerEditor?.title.trim() || !offerEditor.description.trim()) {
      Alert.alert('Check offer', 'Title and description are required.');
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        title: offerEditor.title.trim(),
        description: offerEditor.description.trim(),
        discount: offerEditor.discount.trim() || undefined,
        active: true,
      };
      if (offerEditor.expiresAt.trim()) {
        payload.expiresAt = new Date(offerEditor.expiresAt.trim().replace(' ', 'T')).toISOString();
      }
      if (offerEditor.id) {
        await api(`/businesses/${bizId()}/offers/${offerEditor.id}`, { method:'PATCH', body: JSON.stringify(payload) });
      } else {
        await api(`/businesses/${bizId()}/offers`, { method:'POST', body: JSON.stringify(payload) });
      }
      setOfferEditor(null);
      setOffers(await api<any[]>(`/businesses/${bizId()}/offers`));
    } catch(e) {
      Alert.alert('Could not save offer', e instanceof Error ? e.message : 'Use a valid expiry date like 2026-06-05 14:00.');
    }
  }

  async function removeOffer(of: any) {
    Alert.alert('Delete offer', `Remove "${of.title}"?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/offers/${of.id}`, { method:'DELETE' });
          setOffers(await api<any[]>(`/businesses/${bizId()}/offers`));
        } catch(e) {
          Alert.alert('Could not delete offer', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  async function issueGiftCard() {
    const dollars = Number.parseFloat(giftIssue.amount);
    if (!Number.isFinite(dollars) || dollars < 1) { Alert.alert('Check amount', 'Enter at least $1.'); return; }
    try {
      const card = await api<any>(`/businesses/${bizId()}/gift-cards`, {
        method:'POST',
        body: JSON.stringify({
          amountCents: Math.round(dollars * 100),
          recipientName: giftIssue.recipientName.trim() || undefined,
          recipientEmail: giftIssue.recipientEmail.trim() || undefined,
          message: giftIssue.message.trim() || undefined,
        }),
      });
      setGiftcards(await api<any[]>(`/businesses/${bizId()}/gift-cards`));
      setGiftMode(null);
      setGiftIssue({ amount:'50', recipientName:'', recipientEmail:'', message:'' });
      Alert.alert('Gift card issued', card?.code ? `Code: ${card.code}` : 'Gift card was created.');
    } catch(e) {
      Alert.alert('Could not issue gift card', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function redeemGiftCard() {
    const dollars = Number.parseFloat(giftRedeem.amount);
    if (!giftRedeem.code.trim()) { Alert.alert('Code required', 'Enter a gift card code.'); return; }
    if (!Number.isFinite(dollars) || dollars <= 0) { Alert.alert('Check amount', 'Enter an amount to redeem.'); return; }
    try {
      const r = await api<any>(`/businesses/${bizId()}/gift-cards/redeem`, {
        method:'POST',
        body: JSON.stringify({ code: giftRedeem.code.trim(), amountCents: Math.round(dollars * 100) }),
      });
      setGiftcards(await api<any[]>(`/businesses/${bizId()}/gift-cards`));
      setGiftMode(null);
      setGiftRedeem({ code:'', amount:'' });
      Alert.alert('Gift card redeemed', `$${((r?.redeemedCents ?? 0)/100).toFixed(2)} used. $${((r?.balanceCents ?? 0)/100).toFixed(2)} left.`);
    } catch(e) {
      Alert.alert('Could not redeem gift card', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function voidGiftCard(g: any) {
    Alert.alert('Void gift card', `Void ${g.code}? Remaining balance can no longer be used.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Void', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/gift-cards/${g.id}/void`, { method:'POST' });
          setGiftcards(await api<any[]>(`/businesses/${bizId()}/gift-cards`));
        } catch(e) {
          Alert.alert('Could not void gift card', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  async function loadPackages() {
    const [productRows, issuedRows, serviceRows] = await Promise.all([
      api<any[]>(`/businesses/${bizId()}/packages`),
      api<any[]>(`/businesses/${bizId()}/packages/issued/list`),
      api<Service[]>(`/businesses/${bizId()}/services`).catch(() => services ?? []),
    ]);
    setPackages(productRows);
    setIssuedPackages(issuedRows);
    setServices(serviceRows);
  }

  async function searchPackageClients(q: string) {
    if (!packageIssue) return;
    setPackageIssue({ ...packageIssue, search:q });
    if (q.trim().length < 2) {
      setPackageIssue({ ...packageIssue, search:q, results:[] });
      return;
    }
    try {
      const res = await api<{data:Client[]}>(`/businesses/${bizId()}/clients?search=${encodeURIComponent(q.trim())}&page=1&limit=8`);
      setPackageIssue({ ...packageIssue, search:q, results:res.data });
    } catch {
      setPackageIssue({ ...packageIssue, search:q, results:[] });
    }
  }

  async function issuePackageToClient() {
    if (!packageIssue?.client) { Alert.alert('Pick a client', 'Choose who receives the package.'); return; }
    if (!packageIssue.packageId) { Alert.alert('Pick a package', 'Choose a package product.'); return; }
    try {
      await api(`/businesses/${bizId()}/packages/issued`, {
        method:'POST',
        body: JSON.stringify({ clientId: packageIssue.client.id, packageId: packageIssue.packageId }),
      });
      setPackageIssue(null);
      setPackageTab('issued');
      await loadPackages();
    } catch(e) {
      Alert.alert('Could not issue package', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  function packageServiceName(serviceId?: string | null) {
    return (services ?? []).find(sv => sv.id === serviceId)?.name ?? 'Any service';
  }

  async function savePackageProduct() {
    if (!packageEditor?.name.trim()) { Alert.alert('Package name required', 'Name the package.'); return; }
    const credits = Number.parseInt(packageEditor.credits, 10);
    const priceCents = Math.round(Number.parseFloat(packageEditor.price || '0') * 100);
    if (!Number.isInteger(credits) || credits < 1) { Alert.alert('Check credits', 'Credits must be at least 1.'); return; }
    if (!Number.isFinite(priceCents) || priceCents < 0) { Alert.alert('Check price', 'Enter a valid price.'); return; }
    try {
      await api(`/businesses/${bizId()}/packages`, {
        method:'POST',
        body: JSON.stringify({
          name: packageEditor.name.trim(),
          serviceId: packageEditor.serviceId || undefined,
          credits,
          priceCents,
        }),
      });
      setPackageEditor(null);
      await loadPackages();
    } catch(e) {
      Alert.alert('Could not create package', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function removePackageProduct(p: any) {
    Alert.alert('Delete package', `Delete "${p.name}"? Already-issued packages are kept.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/packages/${p.id}`, { method:'DELETE' });
          await loadPackages();
        } catch(e) {
          Alert.alert('Could not delete package', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  async function redeemIssuedPackage(cp: any) {
    try {
      const r = await api<any>(`/businesses/${bizId()}/packages/issued/${cp.id}/redeem`, {
        method:'POST',
        body: JSON.stringify({}),
      });
      await loadPackages();
      Alert.alert('Credit used', `${r?.creditsRemaining ?? 0} credit${(r?.creditsRemaining ?? 0) === 1 ? '' : 's'} left.`);
    } catch(e) {
      Alert.alert('Could not redeem credit', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function voidIssuedPackage(cp: any) {
    Alert.alert('Void package', `Void ${cp.client?.name ?? 'client'}'s "${cp.name}"?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Void', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/packages/issued/${cp.id}/void`, { method:'POST' });
          await loadPackages();
        } catch(e) {
          Alert.alert('Could not void package', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  const campaignAudiences = [
    { value:'ALL' as const, label:'All' },
    { value:'RECENT' as const, label:'Recent' },
    { value:'LAPSED' as const, label:'Win-back' },
  ];

  async function openCampaignComposer() {
    const editor = { name:'', channel:'EMAIL' as const, audience:'ALL' as const, subject:'', body:'Hi {name}, ', count:null };
    setCampaignEditor(editor);
    try {
      const r = await api<{count:number}>(`/businesses/${bizId()}/campaigns/audience?channel=${editor.channel}&audience=${editor.audience}`);
      setCampaignEditor({ ...editor, count:r.count });
    } catch {}
  }

  async function updateCampaignAudience(next: Partial<NonNullable<typeof campaignEditor>>) {
    if (!campaignEditor) return;
    const updated = { ...campaignEditor, ...next, count:null };
    setCampaignEditor(updated);
    try {
      const r = await api<{count:number}>(`/businesses/${bizId()}/campaigns/audience?channel=${updated.channel}&audience=${updated.audience}`);
      setCampaignEditor({ ...updated, count:r.count });
    } catch {
      setCampaignEditor(updated);
    }
  }

  async function saveCampaign(thenSend: boolean) {
    if (!campaignEditor?.name.trim()) { Alert.alert('Campaign name required', 'Add an internal campaign name.'); return; }
    if (!campaignEditor.body.trim()) { Alert.alert('Message required', 'Write a message.'); return; }
    if (campaignEditor.channel === 'EMAIL' && !campaignEditor.subject.trim()) { Alert.alert('Subject required', 'Email campaigns need a subject.'); return; }
    try {
      const c = await api<any>(`/businesses/${bizId()}/campaigns`, {
        method:'POST',
        body: JSON.stringify({
          name: campaignEditor.name.trim(),
          channel: campaignEditor.channel,
          audience: campaignEditor.audience,
          subject: campaignEditor.channel === 'EMAIL' ? campaignEditor.subject.trim() : undefined,
          body: campaignEditor.body,
        }),
      });
      if (thenSend) {
        await api(`/businesses/${bizId()}/campaigns/${c.id}/send`, { method:'POST' });
      }
      setCampaignEditor(null);
      setCampaigns(await api<any[]>(`/businesses/${bizId()}/campaigns`));
    } catch(e) {
      Alert.alert('Could not save campaign', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function sendCampaign(c: any) {
    Alert.alert('Send campaign', `Send "${c.name}" now?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Send', onPress: async () => {
        try {
          const r = await api<any>(`/businesses/${bizId()}/campaigns/${c.id}/send`, { method:'POST' });
          setCampaigns(await api<any[]>(`/businesses/${bizId()}/campaigns`));
          Alert.alert('Sending', `Sending to ${r?.recipientCount ?? 0} client${(r?.recipientCount ?? 0) === 1 ? '' : 's'}.`);
        } catch(e) {
          Alert.alert('Could not send campaign', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  async function removeCampaign(c: any) {
    Alert.alert('Delete campaign', `Delete "${c.name}"?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/campaigns/${c.id}`, { method:'DELETE' });
          setCampaigns(await api<any[]>(`/businesses/${bizId()}/campaigns`));
        } catch(e) {
          Alert.alert('Could not delete campaign', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  async function loadTasks() {
    const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN';
    const [taskRows, staffRows] = await Promise.all([
      api<TaskItem[]>(`/businesses/${bizId()}/tasks`),
      isOwner ? api<Staff[]>(`/businesses/${bizId()}/staff/all`).catch(() => staff ?? []) : Promise.resolve(staff ?? []),
    ]);
    setTasks(taskRows);
    setStaff(staffRows.filter(st => st.active !== false));
  }

  async function saveTask() {
    if (!taskEditor?.title.trim()) { Alert.alert('Task title required', 'Add what needs to be done.'); return; }
    try {
      await api(`/businesses/${bizId()}/tasks`, {
        method:'POST',
        body: JSON.stringify({
          title: taskEditor.title.trim(),
          staffId: taskEditor.staffId || null,
          dueAt: taskEditor.dueAt.trim() ? new Date(taskEditor.dueAt.trim().replace(' ', 'T')).toISOString() : undefined,
          notes: taskEditor.notes.trim() || undefined,
        }),
      });
      setTaskEditor(null);
      await loadTasks();
    } catch(e) {
      Alert.alert('Could not save task', e instanceof Error ? e.message : 'Use a valid due date like 2026-06-05 14:00.');
    }
  }

  async function toggleTask(t: TaskItem) {
    try {
      await api(`/businesses/${bizId()}/tasks/${t.id}`, {
        method:'PATCH',
        body: JSON.stringify({ status: t.status === 'DONE' ? 'OPEN' : 'DONE' }),
      });
      await loadTasks();
    } catch(e) {
      Alert.alert('Could not update task', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function removeTask(t: TaskItem) {
    Alert.alert('Delete task', `Delete "${t.title}"?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/tasks/${t.id}`, { method:'DELETE' });
          await loadTasks();
        } catch(e) {
          Alert.alert('Could not delete task', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  const followupCadences = [
    { days:14, label:'2 weeks' },
    { days:30, label:'Monthly' },
    { days:42, label:'6 weeks' },
    { days:56, label:'8 weeks' },
  ];

  function cadenceLabel(days?: number | null) {
    if (!days) return 'One-off';
    return followupCadences.find(c => c.days === days)?.label ?? `Every ${days} days`;
  }

  async function loadFollowups() {
    setFollowups(await api<ServiceDueItem[]>(`/businesses/${bizId()}/service-due`));
  }

  async function approveFollowup(it: ServiceDueItem) {
    setFollowupBusy(it.id);
    try {
      await api(`/businesses/${bizId()}/service-due/${it.id}/approve`, { method:'POST' });
      await loadFollowups();
      Alert.alert('Invite sent', `${it.client.name} was invited to rebook.`);
    } catch(e) {
      Alert.alert('Could not send invite', e instanceof Error ? e.message : 'Please try again.');
    } finally { setFollowupBusy(null); }
  }

  async function snoozeFollowup(it: ServiceDueItem, cadenceDays: number) {
    setFollowupBusy(it.id);
    try {
      await api(`/businesses/${bizId()}/service-due/${it.id}/reschedule`, {
        method:'POST',
        body: JSON.stringify({ cadenceDays }),
      });
      setFollowupSnoozing(null);
      await loadFollowups();
    } catch(e) {
      Alert.alert('Could not reschedule', e instanceof Error ? e.message : 'Please try again.');
    } finally { setFollowupBusy(null); }
  }

  async function cancelFollowup(it: ServiceDueItem) {
    Alert.alert('Stop follow-up', `Stop reminders for ${it.client.name}?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Stop', style:'destructive', onPress: async () => {
        setFollowupBusy(it.id);
        try {
          await api(`/businesses/${bizId()}/service-due/${it.id}/cancel`, { method:'POST' });
          await loadFollowups();
        } catch(e) {
          Alert.alert('Could not stop follow-up', e instanceof Error ? e.message : 'Please try again.');
        } finally { setFollowupBusy(null); }
      }},
    ]);
  }

  async function saveSettings() {
    if (!settingsEditor) return;
    const plan = ((biz as any)?.plan ?? 'FREE') as 'FREE'|'BASIC'|'PRO';
    const depositPercent = Number.parseInt(settingsEditor.depositPercent, 10);
    if (settingsEditor.requireDeposit && plan === 'FREE') {
      Alert.alert(
        'Upgrade required',
        'Mandatory deposits are available on Basic and Pro.',
        [
          { text:'Cancel', style:'cancel' },
          { text:'View plans', onPress:()=>Linking.openURL(`${WEB_URL}/dashboard/settings?tab=billing`) },
        ],
      );
      return;
    }
    if (settingsEditor.requireDeposit && (!Number.isInteger(depositPercent) || depositPercent < 1 || depositPercent > 100)) {
      Alert.alert('Check deposit', 'Deposit percent must be between 1 and 100.');
      return;
    }
    try {
      const payload = {
        name: settingsEditor.name.trim(),
        email: settingsEditor.email.trim().toLowerCase(),
        phone: settingsEditor.phone.trim() || undefined,
        address: settingsEditor.address.trim() || undefined,
        minNoticeMinutes: Number.parseInt(settingsEditor.minNoticeMinutes, 10),
        maxAdvanceDays: Number.parseInt(settingsEditor.maxAdvanceDays, 10),
        cancellationWindowHours: Number.parseInt(settingsEditor.cancellationWindowHours, 10),
        requireDeposit: settingsEditor.requireDeposit,
        depositPercent,
      };
      if (!payload.name || !payload.email || !Number.isFinite(payload.minNoticeMinutes) || !Number.isFinite(payload.maxAdvanceDays)) {
        Alert.alert('Check settings', 'Business name, email, notice, and advance window are required.');
        return;
      }
      const updated = await api<any>(`/businesses/${bizId()}`, { method:'PATCH', body: JSON.stringify(payload) });
      setBiz(updated);
      setSettingsEditor(null);
      Alert.alert('Saved', 'Business settings were updated.');
    } catch(e) {
      Alert.alert('Could not save settings', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function saveTimeOff() {
    if (!timeOffEditor) return;
    try {
      await api(`/businesses/${bizId()}/staff/${timeOffEditor.staffId}/time-off`, {
        method:'POST',
        body: JSON.stringify({
          startsAt: new Date(timeOffEditor.startsAt).toISOString(),
          endsAt: new Date(timeOffEditor.endsAt).toISOString(),
          reason: timeOffEditor.reason.trim() || undefined,
        }),
      });
      setTimeOffEditor(null);
      Alert.alert('Saved', 'Time off was added.');
    } catch(e) {
      Alert.alert('Could not add time off', e instanceof Error ? e.message : 'Use a valid date/time, for example 2026-06-05 14:00.');
    }
  }

  function openAvailabilityEditor(st: Staff) {
    const rules = st.availabilityRules ?? [];
    const days = [0,1,2,3,4,5,6].map((dayOfWeek) => {
      const rule = rules.find((r) => r.dayOfWeek === dayOfWeek);
      return {
        dayOfWeek,
        enabled: !!rule,
        startTime: rule?.startTime ?? (dayOfWeek === 0 || dayOfWeek === 6 ? '10:00' : '09:00'),
        endTime: rule?.endTime ?? (dayOfWeek === 0 || dayOfWeek === 6 ? '16:00' : '17:00'),
      };
    });
    setAvailabilityEditor({ staffId: st.id, name: st.user.name, days });
  }

  async function saveAvailability() {
    if (!availabilityEditor) return;
    const validTime = /^\d{2}:\d{2}$/;
    const rules = availabilityEditor.days
      .filter((d) => d.enabled)
      .map((d) => ({ dayOfWeek: d.dayOfWeek, startTime: d.startTime.trim(), endTime: d.endTime.trim() }));
    const invalid = rules.some((r) =>
      !validTime.test(r.startTime) ||
      !validTime.test(r.endTime) ||
      r.startTime >= r.endTime
    );
    if (invalid) {
      Alert.alert('Check hours', 'Use 24-hour HH:mm times, and make sure each start time is before the end time.');
      return;
    }
    try {
      await api(`/businesses/${bizId()}/staff/${availabilityEditor.staffId}/availability`, {
        method:'POST',
        body: JSON.stringify(rules),
      });
      setStaff(await api<Staff[]>(`/businesses/${bizId()}/staff/all`));
      setAvailabilityEditor(null);
      Alert.alert('Saved', 'Recurring availability was updated.');
    } catch(e) {
      Alert.alert('Could not save availability', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  function openStaffServices(st: Staff) {
    if (!services) {
      Alert.alert('Services unavailable', 'Open Services once, then try again.');
      return;
    }
    setStaffServiceEditor({
      staffId: st.id,
      name: st.user.name,
      serviceIds: st.staffServices.map(ss => ss.serviceId),
    });
  }

  async function saveStaffServices() {
    if (!staffServiceEditor) return;
    try {
      await api(`/businesses/${bizId()}/staff/${staffServiceEditor.staffId}/services`, {
        method:'POST',
        body: JSON.stringify({ serviceIds: staffServiceEditor.serviceIds }),
      });
      setStaff(await api<Staff[]>(`/businesses/${bizId()}/staff/all`));
      setStaffServiceEditor(null);
      Alert.alert('Saved', 'Staff services were updated.');
    } catch(e) {
      Alert.alert('Could not save services', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function removeWaitlistEntry(id: string) {
    Alert.alert('Remove from waitlist', 'Remove this person from the active waitlist?', [
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/waitlist/${id}`, { method:'DELETE' });
          setWaitlist(await api<any[]>(`/businesses/${bizId()}/waitlist`));
        } catch(e) {
          Alert.alert('Could not remove', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  async function open(v: MoreView) {
    setView(v);
    try {
      if (v === 'services' && !services) { setLoading(true); setServices(await api<Service[]>(`/businesses/${bizId()}/services`)); }
      else if (v === 'staff' && (!staff || !services))  {
        setLoading(true);
        const [staffRows, serviceRows] = await Promise.all([
          api<Staff[]>(`/businesses/${bizId()}/staff/all`),
          api<Service[]>(`/businesses/${bizId()}/services`),
        ]);
        setStaff(staffRows);
        setServices(serviceRows);
      }
      else if (v === 'offers' && !offers){ setLoading(true); setOffers(await api<any[]>(`/businesses/${bizId()}/offers`)); }
      else if (v === 'waitlist' && !waitlist){ setLoading(true); setWaitlist(await api<any[]>(`/businesses/${bizId()}/waitlist`)); }
      else if (v === 'reviews' && !reviews){ setLoading(true); setReviews(await api<any>(`/businesses/${bizId()}/reviews`)); }
      else if (v === 'marketing' && !campaigns){ setLoading(true); setCampaigns(await api<any[]>(`/businesses/${bizId()}/campaigns`)); }
      else if (v === 'giftcards' && !giftcards){ setLoading(true); setGiftcards(await api<any[]>(`/businesses/${bizId()}/gift-cards`)); }
      else if (v === 'packages' && (!packages || !issuedPackages)){ setLoading(true); await loadPackages(); }
      else if (v === 'tasks' && !tasks){ setLoading(true); await loadTasks(); }
      else if (v === 'followups' && !followups){ setLoading(true); await loadFollowups(); }
      else if ((v === 'settings' || v === 'booking' || v === 'subscriptions' || v === 'notifications') && !biz) { setLoading(true); setBiz(await api<any>(`/businesses/${bizId()}`)); }
      else if (v === 'notifications' && !deliveries) { setLoading(true); setDeliveries(await api<NotificationDelivery[]>(`/notifications/deliveries?limit=50`)); }
      else if (v === 'reports' && !appts) {
        setLoading(true);
        const [bookingRows, paymentRows] = await Promise.all([
          api<{data:Appointment[]}>(`/businesses/${bizId()}/bookings`),
          api<any[]>(`/payments`).catch(() => []),
        ]);
        setAppts(bookingRows.data);
        setPayments(paymentRows);
      }
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
      <View style={s.header}>
        <TouchableOpacity onPress={()=>setView('menu')} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Services</Text>
        <TouchableOpacity onPress={()=>setServiceEditor({ name:'', durationMinutes:'30', price:'0.00', active:true })}>
          <Ionicons name="add" size={24} color={BRAND}/>
        </TouchableOpacity>
      </View>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(services ?? []).map(sv => (
            <TouchableOpacity key={sv.id} style={ms.row} onPress={()=>setServiceEditor({
              id: sv.id,
              name: sv.name,
              durationMinutes: String(sv.durationMinutes),
              price: (sv.priceCents / 100).toFixed(2),
              active: sv.active,
            })}>
              <View style={[ms.dot,{ backgroundColor: sv.color || BRAND }]}/>
              <View style={{ flex:1 }}>
                <Text style={ms.rowTitle}>{sv.name}</Text>
                <Text style={ms.rowMeta}>{sv.durationMinutes} min{sv.active ? '' : ' · inactive'}</Text>
              </View>
              <PriceTag cents={sv.priceCents}/>
            </TouchableOpacity>
          ))}
          {services && services.length===0 && <Text style={ms.empty}>No services yet.</Text>}
        </ScrollView>
      )}
      <Modal visible={!!serviceEditor} animationType="slide" onRequestClose={()=>setServiceEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setServiceEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>{serviceEditor?.id ? 'Edit service' : 'New service'}</Text>
          </View>
          {serviceEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.fieldLabel}>Name</Text>
              <TextInput style={s.input} value={serviceEditor.name} onChangeText={name=>setServiceEditor({...serviceEditor,name})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>How long it takes</Text>
              <View style={{ flexDirection:'row', gap:10 }}>
                <View style={{ flex:1 }}>
                  <TextInput style={s.input} keyboardType="number-pad" placeholder="0"
                    value={String(Math.floor((Number(serviceEditor.durationMinutes)||0)/60))}
                    onChangeText={h=>{ const hh=Math.max(0,Number.parseInt(h||'0',10)||0); const mm=(Number(serviceEditor.durationMinutes)||0)%60; setServiceEditor({...serviceEditor, durationMinutes:String(hh*60+mm)}); }}/>
                  <Text style={[ms.rowMeta,{ textAlign:'center', marginTop:4 }]}>hours</Text>
                </View>
                <View style={{ flex:1 }}>
                  <TextInput style={s.input} keyboardType="number-pad" placeholder="00"
                    value={String((Number(serviceEditor.durationMinutes)||0)%60).padStart(2,'0')}
                    onChangeText={m=>{ const mm=Math.min(59,Math.max(0,Number.parseInt(m||'0',10)||0)); const hh=Math.floor((Number(serviceEditor.durationMinutes)||0)/60); setServiceEditor({...serviceEditor, durationMinutes:String(hh*60+mm)}); }}/>
                  <Text style={[ms.rowMeta,{ textAlign:'center', marginTop:4 }]}>minutes</Text>
                </View>
              </View>
              <Text style={[ms.rowMeta,{ color:BRAND, marginTop:6 }]}>Total: {fmtDur(Number(serviceEditor.durationMinutes)||0)}</Text>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Price</Text>
              <TextInput style={s.input} value={serviceEditor.price} keyboardType="decimal-pad" onChangeText={price=>setServiceEditor({...serviceEditor,price})}/>
              <View style={[ms.card,{ marginTop:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}>
                <Text style={ms.rowTitle}>Active</Text>
                <Switch value={serviceEditor.active} onValueChange={active=>setServiceEditor({...serviceEditor,active})} trackColor={{ true: BRAND, false: GRAY_200 }} thumbColor="#fff"/>
              </View>
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:14 }]} onPress={saveService}><Text style={s.btnPrimaryText}>Save service</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
              <TouchableOpacity style={ms.smallAction} onPress={()=>setTimeOffEditor({
                staffId: st.id,
                name: st.user.name,
                startsAt: '',
                endsAt: '',
                reason: '',
              })}>
                <Text style={ms.smallActionText}>Time off</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ms.smallAction} onPress={()=>openAvailabilityEditor(st)}>
                <Text style={ms.smallActionText}>Hours</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ms.smallAction} onPress={()=>openStaffServices(st)}>
                <Text style={ms.smallActionText}>Services</Text>
              </TouchableOpacity>
            </View>
          ))}
          {staff && staff.length===0 && <Text style={ms.empty}>No team members yet.</Text>}
          <Text style={[ms.empty,{ marginTop:4 }]}>Use Hours for weekly recurring availability and Time off for one-off blocked time.</Text>
        </ScrollView>
      )}
      <Modal visible={!!timeOffEditor} animationType="slide" onRequestClose={()=>setTimeOffEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setTimeOffEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Add time off</Text>
          </View>
          {timeOffEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={ms.cardLabel}>{timeOffEditor.name}</Text>
              <Text style={[s.fieldLabel,{ marginTop:14 }]}>Starts</Text>
              <TextInput style={s.input} placeholder="2026-06-05 14:00" placeholderTextColor={GRAY_400}
                value={timeOffEditor.startsAt} onChangeText={startsAt=>setTimeOffEditor({...timeOffEditor,startsAt})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Ends</Text>
              <TextInput style={s.input} placeholder="2026-06-05 17:00" placeholderTextColor={GRAY_400}
                value={timeOffEditor.endsAt} onChangeText={endsAt=>setTimeOffEditor({...timeOffEditor,endsAt})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Reason</Text>
              <TextInput style={s.input} placeholder="Optional" placeholderTextColor={GRAY_400}
                value={timeOffEditor.reason} onChangeText={reason=>setTimeOffEditor({...timeOffEditor,reason})}/>
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={saveTimeOff}><Text style={s.btnPrimaryText}>Save time off</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={!!availabilityEditor} animationType="slide" onRequestClose={()=>setAvailabilityEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setAvailabilityEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Weekly hours</Text>
          </View>
          {availabilityEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={ms.cardLabel}>{availabilityEditor.name}</Text>
              {availabilityEditor.days.map((d) => {
                const label = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.dayOfWeek];
                return (
                  <View key={d.dayOfWeek} style={ms.card}>
                    <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                      <View>
                        <Text style={ms.rowTitle}>{label}</Text>
                        <Text style={ms.rowMeta}>{d.enabled ? `${d.startTime} to ${d.endTime}` : 'Closed'}</Text>
                      </View>
                      <Switch
                        value={d.enabled}
                        onValueChange={(enabled)=>setAvailabilityEditor({
                          ...availabilityEditor,
                          days: availabilityEditor.days.map(x => x.dayOfWeek === d.dayOfWeek ? { ...x, enabled } : x),
                        })}
                        trackColor={{ true: BRAND, false: GRAY_200 }}
                        thumbColor="#fff"
                      />
                    </View>
                    {d.enabled && (
                      <View style={{ flexDirection:'row', gap:10, marginTop:12 }}>
                        <View style={{ flex:1 }}>
                          <Text style={s.fieldLabel}>Start</Text>
                          <TextInput
                            style={s.input}
                            placeholder="09:00"
                            placeholderTextColor={GRAY_400}
                            value={d.startTime}
                            onChangeText={(startTime)=>setAvailabilityEditor({
                              ...availabilityEditor,
                              days: availabilityEditor.days.map(x => x.dayOfWeek === d.dayOfWeek ? { ...x, startTime } : x),
                            })}
                          />
                        </View>
                        <View style={{ flex:1 }}>
                          <Text style={s.fieldLabel}>End</Text>
                          <TextInput
                            style={s.input}
                            placeholder="17:00"
                            placeholderTextColor={GRAY_400}
                            value={d.endTime}
                            onChangeText={(endTime)=>setAvailabilityEditor({
                              ...availabilityEditor,
                              days: availabilityEditor.days.map(x => x.dayOfWeek === d.dayOfWeek ? { ...x, endTime } : x),
                            })}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:8 }]} onPress={saveAvailability}>
                <Text style={s.btnPrimaryText}>Save weekly hours</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={!!staffServiceEditor} animationType="slide" onRequestClose={()=>setStaffServiceEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setStaffServiceEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Staff services</Text>
          </View>
          {staffServiceEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={ms.cardLabel}>{staffServiceEditor.name}</Text>
              {(services ?? []).map(sv => {
                const selected = staffServiceEditor.serviceIds.includes(sv.id);
                return (
                  <TouchableOpacity key={sv.id} style={[ms.row, selected && { borderColor:BRAND, backgroundColor:BRAND_LT }]}
                    onPress={()=>setStaffServiceEditor({
                      ...staffServiceEditor,
                      serviceIds: selected
                        ? staffServiceEditor.serviceIds.filter(id => id !== sv.id)
                        : [...staffServiceEditor.serviceIds, sv.id],
                    })}>
                    <View style={[ms.dot,{ backgroundColor:sv.color || BRAND }]}/>
                    <View style={{ flex:1 }}>
                      <Text style={ms.rowTitle}>{sv.name}</Text>
                      <Text style={ms.rowMeta}>{sv.durationMinutes} min · ${(sv.priceCents/100).toFixed(2)}</Text>
                    </View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? BRAND : GRAY_400}/>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:8 }]} onPress={saveStaffServices}>
                <Text style={s.btnPrimaryText}>Save services</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'offers') return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>setView('menu')} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Offers</Text>
        <TouchableOpacity onPress={()=>openOfferEditor()}>
          <Ionicons name="add" size={24} color={BRAND}/>
        </TouchableOpacity>
      </View>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(offers ?? []).map(of => (
            <View key={of.id} style={[ms.card,{ borderLeftWidth:3, borderLeftColor:'#10B981' }]}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <View style={{ flex:1, paddingRight:10 }}>
                  <Text style={ms.rowTitle}>{of.title}</Text>
                  {!!of.discount && <View style={[ms.dealChip,{ alignSelf:'flex-start', marginTop:5 }]}><Text style={ms.dealChipText}>{of.discount}</Text></View>}
                </View>
                <View style={{ flexDirection:'row', gap:8 }}>
                  <TouchableOpacity style={ms.smallAction} onPress={()=>openOfferEditor(of)}><Ionicons name="create-outline" size={16} color={BRAND}/></TouchableOpacity>
                  <TouchableOpacity style={ms.smallAction} onPress={()=>removeOffer(of)}><Ionicons name="trash-outline" size={16} color="#DC2626"/></TouchableOpacity>
                </View>
              </View>
              {!!of.description && <Text style={ms.rowMeta}>{of.description}</Text>}
              {!!of.expiresAt && <Text style={[ms.rowMeta,{ color:GRAY_400 }]}>Expires {new Date(of.expiresAt).toLocaleDateString()}</Text>}
            </View>
          ))}
          {offers && offers.length===0 && <Text style={ms.empty}>No active offers.</Text>}
        </ScrollView>
      )}
      <Modal visible={!!offerEditor} animationType="slide" onRequestClose={()=>setOfferEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setOfferEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>{offerEditor?.id ? 'Edit offer' : 'New offer'}</Text>
          </View>
          {offerEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.fieldLabel}>Title</Text>
              <TextInput style={s.input} value={offerEditor.title} placeholder="Summer special" placeholderTextColor={GRAY_400} onChangeText={title=>setOfferEditor({...offerEditor,title})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Description</Text>
              <TextInput style={[s.input,{ minHeight:86, textAlignVertical:'top' }]} multiline value={offerEditor.description} placeholder="What's included?" placeholderTextColor={GRAY_400} onChangeText={description=>setOfferEditor({...offerEditor,description})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Discount label</Text>
              <TextInput style={s.input} value={offerEditor.discount} placeholder="20% off" placeholderTextColor={GRAY_400} onChangeText={discount=>setOfferEditor({...offerEditor,discount})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Expires</Text>
              <TextInput style={s.input} value={offerEditor.expiresAt} placeholder="2026-06-05 14:00" placeholderTextColor={GRAY_400} onChangeText={expiresAt=>setOfferEditor({...offerEditor,expiresAt})}/>
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={saveOffer}><Text style={s.btnPrimaryText}>Save offer</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'waitlist') return (
    <SafeAreaView style={s.screen}>
      <Head title="Waitlist"/>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(waitlist ?? []).map(w => (
            <View key={w.id} style={[ms.card,{ gap:10 }]}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
              <View style={s.avatar}><Text style={{ color:BRAND, fontWeight:'700' }}>{String(w.name||'?').split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}</Text></View>
              <View style={{ flex:1 }}>
                <Text style={ms.rowTitle}>{w.name}</Text>
                <Text style={ms.rowMeta} numberOfLines={1}>{w.email}{w.phone ? ` · ${w.phone}` : ''}</Text>
                {!!w.notes && <Text style={ms.rowMeta} numberOfLines={2}>{w.notes}</Text>}
              </View>
              </View>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
                {!!w.phone && <TouchableOpacity style={ms.smallAction} onPress={()=>Linking.openURL(`tel:${w.phone}`)}><Text style={ms.smallActionText}>Call</Text></TouchableOpacity>}
                {!!w.email && <TouchableOpacity style={ms.smallAction} onPress={()=>Linking.openURL(`mailto:${w.email}`)}><Text style={ms.smallActionText}>Email</Text></TouchableOpacity>}
                <TouchableOpacity style={ms.smallAction} onPress={()=>Linking.openURL(`mailto:${w.email}?subject=${encodeURIComponent('A spot is available')}`)}><Text style={ms.smallActionText}>Notify</Text></TouchableOpacity>
                <TouchableOpacity style={ms.smallAction} onPress={()=>{ setView('menu'); nav.navigate('Book'); }}><Text style={ms.smallActionText}>Book</Text></TouchableOpacity>
                <TouchableOpacity style={ms.smallAction} onPress={()=>removeWaitlistEntry(w.id)}><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Remove</Text></TouchableOpacity>
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
      <View style={s.header}>
        <TouchableOpacity onPress={()=>setView('menu')} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Marketing</Text>
        <TouchableOpacity onPress={openCampaignComposer}>
          <Ionicons name="add" size={24} color={BRAND}/>
        </TouchableOpacity>
      </View>
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
              {c.status === 'DRAFT' && (
                <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                  <TouchableOpacity style={ms.smallAction} onPress={()=>sendCampaign(c)}><Text style={ms.smallActionText}>Send</Text></TouchableOpacity>
                  <TouchableOpacity style={ms.smallAction} onPress={()=>removeCampaign(c)}><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Delete</Text></TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          {campaigns && campaigns.length===0 && <Text style={ms.empty}>No campaigns yet.</Text>}
        </ScrollView>
      )}
      <Modal visible={!!campaignEditor} animationType="slide" onRequestClose={()=>setCampaignEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setCampaignEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>New campaign</Text>
          </View>
          {campaignEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.fieldLabel}>Campaign name</Text>
              <TextInput style={s.input} value={campaignEditor.name} placeholder="June promo" placeholderTextColor={GRAY_400} onChangeText={name=>setCampaignEditor({...campaignEditor,name})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Channel</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                {(['EMAIL','SMS'] as const).map(ch => (
                  <TouchableOpacity key={ch} style={[ms.methodChip, campaignEditor.channel === ch && ms.methodChipOn]} onPress={()=>updateCampaignAudience({ channel:ch })}>
                    <Text style={[ms.methodChipText, campaignEditor.channel === ch && { color:BRAND }]}>{ch === 'EMAIL' ? 'Email' : 'Text'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Audience</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                {campaignAudiences.map(a => (
                  <TouchableOpacity key={a.value} style={[ms.methodChip, campaignEditor.audience === a.value && ms.methodChipOn]} onPress={()=>updateCampaignAudience({ audience:a.value })}>
                    <Text style={[ms.methodChipText, campaignEditor.audience === a.value && { color:BRAND }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[ms.rowMeta,{ marginTop:8 }]}>{campaignEditor.count === null ? 'Counting recipients...' : `${campaignEditor.count} recipient${campaignEditor.count === 1 ? '' : 's'}`}</Text>
              {campaignEditor.channel === 'EMAIL' && (
                <>
                  <Text style={[s.fieldLabel,{ marginTop:12 }]}>Subject</Text>
                  <TextInput style={s.input} value={campaignEditor.subject} placeholder="A special offer for you" placeholderTextColor={GRAY_400} onChangeText={subject=>setCampaignEditor({...campaignEditor,subject})}/>
                </>
              )}
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Message</Text>
              <TextInput style={[s.input,{ minHeight:130, textAlignVertical:'top' }]} multiline value={campaignEditor.body} placeholder="Hi {name}, ..." placeholderTextColor={GRAY_400} onChangeText={body=>setCampaignEditor({...campaignEditor,body})}/>
              <Text style={s.fieldHint}>Use {'{name}'} and {'{business}'} as merge tags.</Text>
              <View style={{ flexDirection:'row', gap:10, marginTop:18 }}>
                <TouchableOpacity style={[s.btnSecondary,{ flex:1 }]} onPress={()=>saveCampaign(false)}><Text style={s.btnSecondaryText}>Save draft</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btnPrimary,{ flex:1 }]} onPress={()=>saveCampaign(true)} disabled={campaignEditor.count === 0}><Text style={s.btnPrimaryText}>Send now</Text></TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'giftcards') return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>setView('menu')} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Gift cards</Text>
        <View style={{ flexDirection:'row', gap:12 }}>
          <TouchableOpacity onPress={()=>setGiftMode('redeem')}><Ionicons name="ticket-outline" size={23} color={BRAND}/></TouchableOpacity>
          <TouchableOpacity onPress={()=>setGiftMode('issue')}><Ionicons name="add" size={24} color={BRAND}/></TouchableOpacity>
        </View>
      </View>
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
              {g.status === 'ACTIVE' && (
                <TouchableOpacity style={[ms.smallAction,{ alignSelf:'flex-start', marginTop:10 }]} onPress={()=>voidGiftCard(g)}>
                  <Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Void</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {giftcards && giftcards.length===0 && <Text style={ms.empty}>No gift cards issued yet.</Text>}
        </ScrollView>
      )}
      <Modal visible={giftMode === 'issue'} animationType="slide" onRequestClose={()=>setGiftMode(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setGiftMode(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Issue gift card</Text>
          </View>
          <ScrollView contentContainerStyle={s.listContent}>
            <Text style={s.fieldLabel}>Amount</Text>
            <TextInput style={s.input} value={giftIssue.amount} keyboardType="decimal-pad" onChangeText={amount=>setGiftIssue({...giftIssue,amount})}/>
            <Text style={[s.fieldLabel,{ marginTop:12 }]}>Recipient name</Text>
            <TextInput style={s.input} value={giftIssue.recipientName} placeholder="Optional" placeholderTextColor={GRAY_400} onChangeText={recipientName=>setGiftIssue({...giftIssue,recipientName})}/>
            <Text style={[s.fieldLabel,{ marginTop:12 }]}>Recipient email</Text>
            <TextInput style={s.input} value={giftIssue.recipientEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Optional" placeholderTextColor={GRAY_400} onChangeText={recipientEmail=>setGiftIssue({...giftIssue,recipientEmail})}/>
            <Text style={[s.fieldLabel,{ marginTop:12 }]}>Message</Text>
            <TextInput style={[s.input,{ minHeight:86, textAlignVertical:'top' }]} multiline value={giftIssue.message} placeholder="Optional" placeholderTextColor={GRAY_400} onChangeText={message=>setGiftIssue({...giftIssue,message})}/>
            <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={issueGiftCard}><Text style={s.btnPrimaryText}>Issue gift card</Text></TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={giftMode === 'redeem'} animationType="slide" onRequestClose={()=>setGiftMode(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setGiftMode(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Redeem gift card</Text>
          </View>
          <ScrollView contentContainerStyle={s.listContent}>
            <Text style={s.fieldLabel}>Code</Text>
            <TextInput style={s.input} value={giftRedeem.code} autoCapitalize="characters" placeholder="GIFT-XXXX" placeholderTextColor={GRAY_400} onChangeText={code=>setGiftRedeem({...giftRedeem,code:code.toUpperCase()})}/>
            <Text style={[s.fieldLabel,{ marginTop:12 }]}>Amount</Text>
            <TextInput style={s.input} value={giftRedeem.amount} keyboardType="decimal-pad" onChangeText={amount=>setGiftRedeem({...giftRedeem,amount})}/>
            <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={redeemGiftCard}><Text style={s.btnPrimaryText}>Redeem</Text></TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'packages') return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>setView('menu')} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Packages</Text>
        {packageTab === 'products' ? (
          <TouchableOpacity onPress={()=>setPackageEditor({ name:'', serviceId:'', credits:'5', price:'' })}>
            <Ionicons name="add" size={24} color={BRAND}/>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={()=>setPackageIssue({ client:null, search:'', packageId:'', results:[] })}>
            <Ionicons name="add" size={24} color={BRAND}/>
          </TouchableOpacity>
        )}
      </View>
      {loading ? <Loader/> : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          <View style={[ms.card,{ flexDirection:'row', gap:8 }]}>
            {(['products','issued'] as const).map(tab => (
              <TouchableOpacity key={tab} style={[ms.methodChip, packageTab === tab && ms.methodChipOn]} onPress={()=>setPackageTab(tab)}>
                <Text style={[ms.methodChipText, packageTab === tab && { color:BRAND }]}>{tab === 'products' ? 'Products' : 'Issued'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {packageTab === 'products' ? (
            <>
              {(packages ?? []).map(p => (
                <View key={p.id} style={ms.row}>
                  <View style={[ms.dot,{ backgroundColor: p.active ? BRAND : GRAY_200 }]}/>
                  <View style={{ flex:1 }}>
                    <Text style={ms.rowTitle}>{p.name}</Text>
                    <Text style={ms.rowMeta}>{p.credits} credit{p.credits===1?'':'s'} · {packageServiceName(p.serviceId)}{p.active ? '' : ' · inactive'}</Text>
                  </View>
                  <View style={{ alignItems:'flex-end' }}>
                    <PriceTag cents={p.priceCents}/>
                    <TouchableOpacity style={{ marginTop:6 }} onPress={()=>removePackageProduct(p)}>
                      <Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {packages && packages.length===0 && <Text style={ms.empty}>No packages yet.</Text>}
            </>
          ) : (
            <>
              {(issuedPackages ?? []).map(cp => (
                <View key={cp.id} style={[ms.card,{ borderLeftWidth:3, borderLeftColor: cp.status === 'ACTIVE' ? '#10B981' : GRAY_200 }]}>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                    <View style={{ flex:1 }}>
                      <Text style={ms.rowTitle}>{cp.client?.name ?? 'Client'}</Text>
                      <Text style={ms.rowMeta}>{cp.name} · {packageServiceName(cp.serviceId)}</Text>
                      <Text style={[ms.rowMeta,{ color:GRAY_400 }]}>{cp.status} · {cp.creditsRemaining}/{cp.creditsTotal} credits left</Text>
                    </View>
                    <Text style={{ fontSize:22, fontWeight:'800', color:GRAY_900 }}>{cp.creditsRemaining}</Text>
                  </View>
                  {cp.status === 'ACTIVE' && (
                    <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                      <TouchableOpacity style={ms.smallAction} onPress={()=>redeemIssuedPackage(cp)}><Text style={ms.smallActionText}>Use credit</Text></TouchableOpacity>
                      <TouchableOpacity style={ms.smallAction} onPress={()=>voidIssuedPackage(cp)}><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Void</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
              {issuedPackages && issuedPackages.length===0 && <Text style={ms.empty}>No issued packages yet.</Text>}
            </>
          )}
        </ScrollView>
      )}
      <Modal visible={!!packageEditor} animationType="slide" onRequestClose={()=>setPackageEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setPackageEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>New package</Text>
          </View>
          {packageEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.fieldLabel}>Name</Text>
              <TextInput style={s.input} value={packageEditor.name} placeholder="5x Haircut" placeholderTextColor={GRAY_400} onChangeText={name=>setPackageEditor({...packageEditor,name})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Credits</Text>
              <TextInput style={s.input} value={packageEditor.credits} keyboardType="number-pad" onChangeText={credits=>setPackageEditor({...packageEditor,credits})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Price</Text>
              <TextInput style={s.input} value={packageEditor.price} keyboardType="decimal-pad" placeholder="200.00" placeholderTextColor={GRAY_400} onChangeText={price=>setPackageEditor({...packageEditor,price})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Service</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }}>
                <TouchableOpacity style={[dst.chip, !packageEditor.serviceId && dst.chipOn, { marginRight:8 }]} onPress={()=>setPackageEditor({...packageEditor,serviceId:''})}>
                  <Text style={[dst.chipDow, !packageEditor.serviceId && dst.chipTextOn]}>Any</Text>
                </TouchableOpacity>
                {(services ?? []).map(sv => {
                  const selected = packageEditor.serviceId === sv.id;
                  return (
                    <TouchableOpacity key={sv.id} style={[dst.chip, selected && dst.chipOn, { marginRight:8 }]} onPress={()=>setPackageEditor({...packageEditor,serviceId:sv.id})}>
                      <Text style={[dst.chipDow, selected && dst.chipTextOn]}>{sv.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={savePackageProduct}><Text style={s.btnPrimaryText}>Create package</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={!!packageIssue} animationType="slide" onRequestClose={()=>setPackageIssue(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setPackageIssue(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Issue package</Text>
          </View>
          {packageIssue && (
            <ScrollView contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Client</Text>
              {packageIssue.client ? (
                <View style={[ms.card,{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}>
                  <View>
                    <Text style={ms.rowTitle}>{packageIssue.client.name}</Text>
                    <Text style={ms.rowMeta}>{packageIssue.client.email}</Text>
                  </View>
                  <TouchableOpacity onPress={()=>setPackageIssue({...packageIssue,client:null,search:'',results:[]})}><Text style={[ms.smallActionText,{ color:BRAND }]}>Change</Text></TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput style={s.input} value={packageIssue.search} placeholder="Search name or email" placeholderTextColor={GRAY_400} onChangeText={searchPackageClients}/>
                  {packageIssue.results.map(c => (
                    <TouchableOpacity key={c.id} style={ms.row} onPress={()=>setPackageIssue({...packageIssue,client:c,search:c.name,results:[]})}>
                      <View style={s.avatar}><Text style={s.avatarText}>{c.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</Text></View>
                      <View style={{ flex:1 }}>
                        <Text style={ms.rowTitle}>{c.name}</Text>
                        <Text style={ms.rowMeta}>{c.email}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Package</Text>
              {(packages ?? []).filter(p => p.active !== false).map(p => {
                const selected = packageIssue.packageId === p.id;
                return (
                  <TouchableOpacity key={p.id} style={[ms.row, selected && { borderColor:BRAND, backgroundColor:BRAND_LT }]} onPress={()=>setPackageIssue({...packageIssue,packageId:p.id})}>
                    <View style={[ms.dot,{ backgroundColor:BRAND }]}/>
                    <View style={{ flex:1 }}>
                      <Text style={ms.rowTitle}>{p.name}</Text>
                      <Text style={ms.rowMeta}>{p.credits} credits · {packageServiceName(p.serviceId)} · ${(p.priceCents/100).toFixed(2)}</Text>
                    </View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? BRAND : GRAY_400}/>
                  </TouchableOpacity>
                );
              })}
              {packages && packages.length===0 && <Text style={ms.empty}>Create a package product first.</Text>}
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={issuePackageToClient}><Text style={s.btnPrimaryText}>Issue package</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'tasks') {
    const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN';
    const openTasks = (tasks ?? []).filter(t => t.status !== 'DONE');
    const doneTasks = (tasks ?? []).filter(t => t.status === 'DONE');
    const renderTask = (t: TaskItem) => {
      const due = t.dueAt ? new Date(t.dueAt) : null;
      const overdue = !!due && t.status !== 'DONE' && due.getTime() < Date.now();
      return (
        <View key={t.id} style={ms.row}>
          <TouchableOpacity onPress={()=>toggleTask(t)} style={[ms.checkCircle, t.status === 'DONE' && ms.checkCircleOn]}>
            {t.status === 'DONE' && <Ionicons name="checkmark" size={14} color="#fff"/>}
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={[ms.rowTitle, t.status === 'DONE' && { color:GRAY_400, textDecorationLine:'line-through' }]}>{t.title}</Text>
            <Text style={[ms.rowMeta, overdue && { color:'#DC2626', fontWeight:'700' }]} numberOfLines={2}>
              {t.staff?.user?.name ? `${t.staff.user.name} · ` : ''}{due ? `${due.toLocaleDateString()} ${fmtTime(due.toISOString())}` : 'No due date'}{t.notes ? ` · ${t.notes}` : ''}
            </Text>
          </View>
          {isOwner && (
            <TouchableOpacity style={ms.iconAction} onPress={()=>removeTask(t)}>
              <Ionicons name="trash-outline" size={18} color="#DC2626"/>
            </TouchableOpacity>
          )}
        </View>
      );
    };
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <TouchableOpacity onPress={()=>setView('menu')} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
          <Text style={s.headerTitle}>Tasks</Text>
          {isOwner && (
            <TouchableOpacity onPress={()=>setTaskEditor({ title:'', staffId:'', dueAt:'', notes:'' })}>
              <Ionicons name="add" size={24} color={BRAND}/>
            </TouchableOpacity>
          )}
        </View>
        {loading ? <Loader/> : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            {openTasks.map(renderTask)}
            {openTasks.length === 0 && <Text style={ms.empty}>No open tasks.</Text>}
            {doneTasks.length > 0 && <Text style={[ms.cardLabel,{ marginTop:12, marginBottom:8, marginLeft:2 }]}>DONE</Text>}
            {doneTasks.map(renderTask)}
          </ScrollView>
        )}
        <Modal visible={!!taskEditor} animationType="slide" onRequestClose={()=>setTaskEditor(null)}>
          <SafeAreaView style={s.screen}>
            <View style={s.header}>
              <TouchableOpacity onPress={()=>setTaskEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
              <Text style={s.headerTitle}>New task</Text>
            </View>
            {taskEditor && (
              <ScrollView contentContainerStyle={s.listContent}>
                <Text style={s.fieldLabel}>Task</Text>
                <TextInput style={s.input} value={taskEditor.title} placeholder="Restock products, call client..." placeholderTextColor={GRAY_400} onChangeText={title=>setTaskEditor({...taskEditor,title})}/>
                <Text style={[s.fieldLabel,{ marginTop:12 }]}>Assign to</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }}>
                  <TouchableOpacity style={[dst.chip, !taskEditor.staffId && dst.chipOn, { marginRight:8 }]} onPress={()=>setTaskEditor({...taskEditor,staffId:''})}>
                    <Text style={[dst.chipDow, !taskEditor.staffId && dst.chipTextOn]}>Any</Text>
                  </TouchableOpacity>
                  {(staff ?? []).map(st => {
                    const selected = taskEditor.staffId === st.id;
                    return (
                      <TouchableOpacity key={st.id} style={[dst.chip, selected && dst.chipOn, { marginRight:8 }]} onPress={()=>setTaskEditor({...taskEditor,staffId:st.id})}>
                        <Text style={[dst.chipDow, selected && dst.chipTextOn]}>{st.user.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={[s.fieldLabel,{ marginTop:12 }]}>Due date</Text>
                <TextInput style={s.input} value={taskEditor.dueAt} placeholder="2026-06-05 14:00" placeholderTextColor={GRAY_400} onChangeText={dueAt=>setTaskEditor({...taskEditor,dueAt})}/>
                <Text style={[s.fieldLabel,{ marginTop:12 }]}>Notes</Text>
                <TextInput style={[s.input,{ minHeight:86, textAlignVertical:'top' }]} multiline value={taskEditor.notes} placeholder="Optional details" placeholderTextColor={GRAY_400} onChangeText={notes=>setTaskEditor({...taskEditor,notes})}/>
                <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={saveTask}><Text style={s.btnPrimaryText}>Add task</Text></TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  if (view === 'followups') {
    const due = (followups ?? []).filter(it => it.status === 'DUE');
    const scheduled = (followups ?? []).filter(it => it.status === 'SCHEDULED');
    const renderFollowup = (it: ServiceDueItem, isDue: boolean) => (
      <View key={it.id} style={[ms.card, isDue && { borderColor:'#FCD34D', backgroundColor:'#FFFBEB' }]}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
          <View style={[s.avatar,{ backgroundColor:isDue ? '#FEF3C7' : BRAND_LT }]}><Ionicons name={isDue ? 'mail-unread-outline' : 'time-outline'} size={18} color={isDue ? '#B45309' : BRAND}/></View>
          <View style={{ flex:1 }}>
            <Text style={ms.rowTitle}>{it.client.name}</Text>
            <Text style={ms.rowMeta}>{it.service?.name ? `${it.service.name} · ` : ''}{cadenceLabel(it.cadenceDays)} · {isDue ? 'due now' : `next ${new Date(it.dueAt).toLocaleDateString()}`}</Text>
          </View>
        </View>
        {isDue && followupSnoozing !== it.id && (
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 }}>
            <TouchableOpacity disabled={followupBusy===it.id} style={ms.smallAction} onPress={()=>approveFollowup(it)}><Text style={ms.smallActionText}>Approve</Text></TouchableOpacity>
            <TouchableOpacity disabled={followupBusy===it.id} style={ms.smallAction} onPress={()=>setFollowupSnoozing(it.id)}><Text style={ms.smallActionText}>Reschedule</Text></TouchableOpacity>
            <TouchableOpacity disabled={followupBusy===it.id} style={ms.smallAction} onPress={()=>cancelFollowup(it)}><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Stop</Text></TouchableOpacity>
          </View>
        )}
        {followupSnoozing === it.id && (
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 }}>
            {followupCadences.map(c => (
              <TouchableOpacity key={c.days} disabled={followupBusy===it.id} style={ms.smallAction} onPress={()=>snoozeFollowup(it, c.days)}>
                <Text style={ms.smallActionText}>{c.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={ms.smallAction} onPress={()=>setFollowupSnoozing(null)}><Text style={ms.smallActionText}>Cancel</Text></TouchableOpacity>
          </View>
        )}
        {!isDue && (
          <TouchableOpacity disabled={followupBusy===it.id} style={[ms.smallAction,{ alignSelf:'flex-start', marginTop:12 }]} onPress={()=>cancelFollowup(it)}>
            <Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    );
    return (
      <SafeAreaView style={s.screen}>
        <Head title="Follow-ups"/>
        {loading ? <Loader/> : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            {due.length > 0 && <Text style={[ms.cardLabel,{ marginBottom:8, marginLeft:2, color:'#B45309' }]}>DUE NOW</Text>}
            {due.map(it => renderFollowup(it, true))}
            {scheduled.length > 0 && <Text style={[ms.cardLabel,{ marginTop:12, marginBottom:8, marginLeft:2 }]}>SCHEDULED</Text>}
            {scheduled.map(it => renderFollowup(it, false))}
            {followups && followups.length === 0 && <Text style={ms.empty}>No follow-ups yet. Set a client&apos;s next-visit cadence from their profile on web.</Text>}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

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
          <Text style={[ms.cardLabel,{ marginTop:18, marginBottom:6, marginLeft:2 }]}>RECENT DELIVERY LOGS</Text>
          <View style={ms.card}>
            {(deliveries ?? []).slice(0, 12).map((d,i,arr)=>(
              <View key={d.id} style={[ms.notifRow, i<arr.length-1&&ms.notifRowBorder]}>
                <View style={{ flex:1, paddingRight:10 }}>
                  <Text style={ms.rowTitle}>{d.channel} · {d.type}</Text>
                  <Text style={ms.rowMeta} numberOfLines={1}>{d.recipient}</Text>
                  {!!d.error && <Text style={[ms.rowMeta,{ color:'#DC2626' }]} numberOfLines={2}>{d.error}</Text>}
                </View>
                <View style={[ms.dealChip,{ backgroundColor:d.status==='FAILED'?'#FEE2E2':d.status==='SENT'?'#D1FAE5':GRAY_100 }]}>
                  <Text style={[ms.dealChipText,{ color:d.status==='FAILED'?'#991B1B':d.status==='SENT'?'#065F46':GRAY_700 }]}>{d.status}</Text>
                </View>
              </View>
            ))}
            {deliveries && deliveries.length===0 && <Text style={ms.empty}>No delivery attempts logged yet.</Text>}
          </View>
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
    const paymentRows = payments ?? [];
    const revenueCents = paymentRows
      .filter(p => p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED')
      .reduce((sum,p)=> sum + (p.amountCents ?? 0) - (p.refundedCents ?? 0), 0);
    const failedPayments = paymentRows.filter(p => p.status === 'FAILED').length;
    const noShows = list.filter(a => a.status==='NO_SHOW').length;
    const cancelled = list.filter(a => a.status==='CANCELLED').length;
    const byService = completed.reduce((map,a)=>{
      const key = a.service?.name ?? 'Unknown';
      map[key] = (map[key] ?? 0) + 1;
      return map;
    }, {} as Record<string,number>);
    const topService = Object.entries(byService).sort((a,b)=>b[1]-a[1])[0];
    const stats = [
      { label:"Today's appointments", value:String(todayCount) },
      { label:'Upcoming', value:String(upcoming) },
      { label:'Completed (all time)', value:String(completed.length) },
      { label:'Collected revenue', value:`$${(revenueCents/100).toFixed(2)}` },
      { label:'Cancelled / no-show', value:`${cancelled} / ${noShows}` },
      { label:'Failed payments', value:String(failedPayments) },
      { label:'Top service', value:topService ? `${topService[0]} (${topService[1]})` : '—' },
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
                  <Text style={[ms.rowMeta,{ color:GRAY_400, marginTop:2 }]}>{new Date(p.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} · {fmtTime(p.createdAt)}</Text>
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
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <Text style={ms.cardValue}>{biz?.name ?? '—'}</Text>
              {(biz as any)?.verificationStatus === 'VERIFIED' && <VerifiedPill/>}
            </View>
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
          <TouchableOpacity style={[s.btnPrimary,{ marginBottom:14 }]} onPress={()=>setSettingsEditor({
            name: biz?.name ?? '',
            email: biz?.email ?? '',
            phone: biz?.phone ?? '',
            address: biz?.address ?? '',
            minNoticeMinutes: String(biz?.minNoticeMinutes ?? 120),
            maxAdvanceDays: String(biz?.maxAdvanceDays ?? 60),
            cancellationWindowHours: String(biz?.cancellationWindowHours ?? 24),
            requireDeposit: !!biz?.requireDeposit,
            depositPercent: String(biz?.depositPercent ?? 25),
          })}>
            <Text style={s.btnPrimaryText}>Edit business settings</Text>
          </TouchableOpacity>

          <Text style={[ms.cardLabel,{ marginTop:14, marginBottom:6, marginLeft:2 }]}>WEB DASHBOARD</Text>
          <View style={ms.card}>
            <TouchableOpacity style={[ms.notifRow, ms.notifRowBorder]} onPress={()=>Linking.openURL(`${WEB_URL}/dashboard/settings`)}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                <Ionicons name="storefront-outline" size={20} color={BRAND}/>
                <Text style={ms.rowTitle}>Business settings</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={GRAY_400}/>
            </TouchableOpacity>
            <TouchableOpacity style={[ms.notifRow, ms.notifRowBorder]} onPress={()=>Linking.openURL(`${WEB_URL}/dashboard/settings?tab=billing`)}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                <Ionicons name="card-outline" size={20} color={BRAND}/>
                <Text style={ms.rowTitle}>Billing and plan</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={GRAY_400}/>
            </TouchableOpacity>
            <TouchableOpacity style={ms.notifRow} onPress={()=>Linking.openURL(`${WEB_URL}/dashboard/notifications`)}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                <Ionicons name="notifications-outline" size={20} color={BRAND}/>
                <Text style={ms.rowTitle}>Delivery logs</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={GRAY_400}/>
            </TouchableOpacity>
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

          <Text style={[ms.empty,{ marginTop:8 }]}>Advanced business settings, billing, and delivery-log controls are available on the web dashboard.</Text>
        </ScrollView>
      )}
      <Modal visible={!!settingsEditor} animationType="slide" onRequestClose={()=>setSettingsEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setSettingsEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Business settings</Text>
          </View>
          {settingsEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.fieldLabel}>Business name</Text>
              <TextInput style={s.input} value={settingsEditor.name} onChangeText={name=>setSettingsEditor({...settingsEditor,name})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Email</Text>
              <TextInput style={s.input} value={settingsEditor.email} autoCapitalize="none" keyboardType="email-address" onChangeText={email=>setSettingsEditor({...settingsEditor,email})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Phone</Text>
              <TextInput style={s.input} value={settingsEditor.phone} keyboardType="phone-pad" onChangeText={phone=>setSettingsEditor({...settingsEditor,phone})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Address</Text>
              <TextInput style={s.input} value={settingsEditor.address} onChangeText={address=>setSettingsEditor({...settingsEditor,address})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Minimum notice minutes</Text>
              <TextInput style={s.input} value={settingsEditor.minNoticeMinutes} keyboardType="number-pad" onChangeText={minNoticeMinutes=>setSettingsEditor({...settingsEditor,minNoticeMinutes})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Maximum advance days</Text>
              <TextInput style={s.input} value={settingsEditor.maxAdvanceDays} keyboardType="number-pad" onChangeText={maxAdvanceDays=>setSettingsEditor({...settingsEditor,maxAdvanceDays})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Cancellation window hours</Text>
              <TextInput style={s.input} value={settingsEditor.cancellationWindowHours} keyboardType="number-pad" onChangeText={cancellationWindowHours=>setSettingsEditor({...settingsEditor,cancellationWindowHours})}/>
              <View style={[ms.card,{ marginTop:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}>
                <Text style={ms.rowTitle}>Require deposit</Text>
                <Switch value={settingsEditor.requireDeposit} onValueChange={requireDeposit=>setSettingsEditor({...settingsEditor,requireDeposit})} trackColor={{ true: BRAND, false: GRAY_200 }} thumbColor="#fff"/>
              </View>
              {settingsEditor.requireDeposit && (
                <>
                  <Text style={s.fieldLabel}>Deposit percent</Text>
                  <TextInput style={s.input} value={settingsEditor.depositPercent} keyboardType="number-pad" onChangeText={depositPercent=>setSettingsEditor({...settingsEditor,depositPercent})}/>
                </>
              )}
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={saveSettings}><Text style={s.btnPrimaryText}>Save settings</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  // ── default menu (exact spec order) ──
  const MENU: Array<{ label:string; icon:any; onPress:()=>void }> = [
    { label:'Items & Services', icon:'pricetags-outline',       onPress:()=>open('services') },
    { label:'Online Booking',   icon:'globe-outline',           onPress:()=>open('booking') },
    { label:'Waitlist',         icon:'hourglass-outline',       onPress:()=>open('waitlist') },
    { label:'Tasks',            icon:'checkbox-outline',        onPress:()=>open('tasks') },
    { label:'Follow-ups',       icon:'repeat-outline',          onPress:()=>open('followups') },
    { label:'Notifications',    icon:'notifications-outline',   onPress:()=>open('notifications') },
    { label:'Transactions',     icon:'swap-horizontal-outline', onPress:()=>open('transactions') },
    { label:'Reports',          icon:'bar-chart-outline',       onPress:()=>open('reports') },
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
  filterChip:    { borderWidth:1, borderColor:GRAY_200, borderRadius:999, paddingHorizontal:12, paddingVertical:7, backgroundColor:'#fff' },
  filterChipOn:  { borderColor:BRAND, backgroundColor:BRAND },
  filterText:    { fontSize:12, fontWeight:'700', color:GRAY_500 },
  filterTextOn:  { color:'#fff' },
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
  stripWrap:     { paddingVertical:10, borderBottomWidth:1, borderBottomColor:GRAY_100, backgroundColor:'#fff' },
  allDay:        { width:52, borderRadius:14, borderWidth:1, borderColor:GRAY_200, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', paddingVertical:8, gap:2 },
  allDayOn:      { backgroundColor:BRAND, borderColor:BRAND },
  allDayText:    { fontSize:11, fontWeight:'700', color:GRAY_500 },
  dayCell:       { width:52, borderRadius:14, borderWidth:1, borderColor:GRAY_200, backgroundColor:'#fff', alignItems:'center', paddingVertical:8 },
  dayCellOn:     { backgroundColor:BRAND, borderColor:BRAND },
  dayDow:        { fontSize:10, fontWeight:'700', color:GRAY_400, letterSpacing:0.4 },
  dayNum:        { fontSize:18, fontWeight:'700', color:GRAY_900, marginTop:2 },
  dayDot:        { width:5, height:5, borderRadius:3, marginTop:4, backgroundColor:'transparent' },
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
  smallAction: { borderWidth:1, borderColor:GRAY_200, borderRadius:10, paddingHorizontal:10, paddingVertical:7 },
  smallActionText:{ fontSize:12, fontWeight:'700', color:GRAY_700 },
  iconAction:  { width:34, height:34, borderRadius:10, alignItems:'center', justifyContent:'center', backgroundColor:'#FEF2F2' },
  checkCircle: { width:26, height:26, borderRadius:13, borderWidth:2, borderColor:GRAY_200, alignItems:'center', justifyContent:'center' },
  checkCircleOn:{ borderColor:'#10B981', backgroundColor:'#10B981' },
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
          name: name.trim(), email: email.trim().toLowerCase(), password, role:'OWNER',
          businessName: businessName.trim(),
          privacyConsentAccepted: true,
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

// ── Client portal: bookings, messages, and offers for CLIENT users ───────────
function ClientPortalScreen({ onLogout }: { onLogout:()=>void }) {
  const { user } = getAuth();
  const [tab, setTab] = useState<'bookings'|'messages'|'offers'>('bookings');
  const [appointments, setAppointments] = useState<ClientPortalAppointment[]>([]);
  const [threads, setThreads] = useState<ClientPortalMessageThread[]>([]);
  const [offers, setOffers] = useState<ClientPortalOffer[]>([]);
  const [selectedThread, setSelectedThread] = useState<ClientPortalMessageThread|null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<ClientPortalAppointment|null>(null);
  const [clientReschedule, setClientReschedule] = useState<{ appointment:ClientPortalAppointment; date:string; slots:Slot[]; loading:boolean }|null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emailBlocked, setEmailBlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    setEmailBlocked(false);
    try {
      const [apts, msgs, activeOffers] = await Promise.all([
        api<ClientPortalAppointment[]>('/my/appointments'),
        api<ClientPortalMessageThread[]>('/my/messages'),
        api<ClientPortalOffer[]>('/my/offers'),
      ]);
      setAppointments(apts);
      setThreads(msgs);
      setOffers(activeOffers);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('EMAIL_NOT_VERIFIED') || msg.toLowerCase().includes('verify')) setEmailBlocked(true);
      else Alert.alert('Could not load account', msg || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resendVerification() {
    try {
      await api('/auth/resend-verification', { method:'POST' });
      Alert.alert('Verification sent', 'Check your email for a new verification link.');
    } catch (e) {
      Alert.alert('Could not send email', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function sendClientMessage() {
    if (!reply.trim() || !selectedThread) return;
    setSending(true);
    try {
      await api(`/businesses/${selectedThread.businessId}/clients/${selectedThread.clientId}/messages`, {
        method:'POST',
        body: JSON.stringify({ content: reply.trim() }),
      });
      setReply('');
      const messages = await api<Message[]>(`/businesses/${selectedThread.businessId}/clients/${selectedThread.clientId}/messages`);
      const updated = { ...selectedThread, messages };
      setSelectedThread(updated);
      setThreads(prev => prev.map(t => t.businessId === updated.businessId && t.clientId === updated.clientId ? updated : t));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated:true }), 50);
    } catch (e) {
      Alert.alert('Could not send message', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  function manageUrl(a: ClientPortalAppointment) {
    return a.manageToken ? `${WEB_URL}/appointments/${a.id}/manage?token=${encodeURIComponent(a.manageToken)}` : null;
  }

  async function cancelClientAppointment(a: ClientPortalAppointment) {
    if (!a.manageToken) {
      Alert.alert('Manage link unavailable', 'Open this appointment from your confirmation email to cancel it.');
      return;
    }
    Alert.alert('Cancel appointment', 'Cancel this booking?', [
      { text:'No', style:'cancel' },
      { text:'Cancel booking', style:'destructive', onPress: async () => {
        try {
          await api(`/bookings/${a.id}/status?token=${encodeURIComponent(a.manageToken!)}`, {
            method:'PATCH',
            body: JSON.stringify({ status:'CANCELLED', cancelReason:'Cancelled by client from mobile app' }),
          });
          setSelectedAppointment(null);
          load(true);
          Alert.alert('Cancelled', 'Your appointment was cancelled.');
        } catch (e) {
          Alert.alert('Could not cancel', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  function openManage(a: ClientPortalAppointment) {
    const url = manageUrl(a);
    if (url) Linking.openURL(url);
    else Alert.alert('Manage link unavailable', 'Open this appointment from your confirmation email.');
  }

  async function rescheduleClientAppointment(a: ClientPortalAppointment) {
    if (!a.manageToken) {
      Alert.alert('Manage link unavailable', 'Open this appointment from your confirmation email to reschedule it.');
      return;
    }
    const today = new Date().toISOString().slice(0,10);
    setSelectedAppointment(null);
    setClientReschedule({ appointment:a, date:today, slots:[], loading:true });
    await loadClientRescheduleSlots(a, today);
  }

  async function loadClientRescheduleSlots(a: ClientPortalAppointment, d: string) {
    setClientReschedule(prev => prev ? { ...prev, date:d, slots:[], loading:true } : prev);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await api<Slot[]>(`/availability/slots?staffId=${a.staff.id}&serviceId=${a.service.id}&startDate=${d}&endDate=${d}&timezone=${tz}`);
      setClientReschedule(prev => prev ? { ...prev, date:d, slots:data, loading:false } : prev);
    } catch(e) {
      setClientReschedule(prev => prev ? { ...prev, loading:false } : prev);
      Alert.alert('Could not load times', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function saveClientReschedule(startsAt: string) {
    if (!clientReschedule?.appointment.manageToken) return;
    try {
      await api(`/bookings/${clientReschedule.appointment.id}/reschedule?token=${encodeURIComponent(clientReschedule.appointment.manageToken)}`, {
        method:'PATCH',
        body: JSON.stringify({ startsAt }),
      });
      setClientReschedule(null);
      load(true);
      Alert.alert('Rescheduled', 'Your appointment was moved. The business will confirm if approval is required.');
    } catch(e) {
      Alert.alert('Could not reschedule', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  function rebook(a: ClientPortalAppointment) {
    const slug = a.business.slug;
    if (slug) Linking.openURL(`${WEB_URL}/book/${slug}`);
    else Alert.alert('Booking page unavailable', 'Contact the business to book again.');
  }

  function review(a: ClientPortalAppointment) {
    if (['COMPLETED','NO_SHOW'].includes(a.status)) Linking.openURL(`${WEB_URL}/review/${a.id}`);
    else Alert.alert('Review after your visit', 'Reviews open after the appointment is completed.');
  }

  if (emailBlocked) return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Verify email</Text>
        <TouchableOpacity onPress={onLogout}><Text style={s.authSwitchLink}>Sign out</Text></TouchableOpacity>
      </View>
      <View style={[s.center,{ padding:28 }]}>
        <Ionicons name="mail-unread-outline" size={44} color={BRAND}/>
        <Text style={[s.loginTitle,{ fontSize:22, textAlign:'center', marginTop:14 }]}>Check your email</Text>
        <Text style={[s.loginSub,{ textAlign:'center', marginBottom:0 }]}>
          {user?.email ? `Verify ${user.email} to see your bookings and messages.` : 'Verify your email to see your bookings and messages.'}
        </Text>
        <TouchableOpacity style={[s.btnPrimary,{ marginTop:22, alignSelf:'stretch' }]} onPress={resendVerification}>
          <Text style={s.btnPrimaryText}>Resend verification</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  if (selectedThread) return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>setSelectedThread(null)} style={{ marginRight:12 }}>
          <Ionicons name="arrow-back" size={22} color={GRAY_700}/>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{selectedThread.businessName}</Text>
      </View>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={Platform.OS==='ios'?88:0}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}
          onContentSizeChange={()=>scrollRef.current?.scrollToEnd({ animated:false })}>
          {selectedThread.messages.length === 0 && <Text style={s.emptyText}>No messages yet</Text>}
          {selectedThread.messages.map(m => (
            <View key={m.id} style={[s.bubble, m.fromClient ? s.bubbleRight : s.bubbleLeft]}>
              <Text style={[s.bubbleText, m.fromClient ? s.bubbleTextRight : s.bubbleTextLeft]}>{m.content}</Text>
              <Text style={s.bubbleTime}>{fmtTime(m.createdAt)}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.composeRow}>
          <TextInput style={s.composeInput} placeholder="Type a message..." placeholderTextColor={GRAY_400}
            value={reply} onChangeText={setReply} multiline returnKeyType="send" onSubmitEditing={sendClientMessage}/>
          <TouchableOpacity style={[s.sendBtn, (!reply.trim() || sending) && { opacity:0.4 }]}
            disabled={!reply.trim() || sending} onPress={sendClientMessage}>
            <Ionicons name="send" size={18} color="#fff"/>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (selectedAppointment) {
    const a = selectedAppointment;
    const upcoming = ['PENDING','CONFIRMED'].includes(a.status) && +new Date(a.startsAt) > Date.now();
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <TouchableOpacity onPress={()=>setSelectedAppointment(null)} style={{ marginRight:12 }}>
            <Ionicons name="arrow-back" size={22} color={GRAY_700}/>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Booking</Text>
        </View>
        <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
          <View style={[ms.card,{ borderLeftWidth:3, borderLeftColor:STATUS_COLOR[a.status] ?? BRAND }]}>
            <Text style={ms.cardLabel}>{a.business.name}</Text>
            <Text style={ms.cardValue}>{a.service.name}</Text>
            <Text style={ms.rowMeta}>{new Date(a.startsAt).toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric', year:'numeric' })}</Text>
            <Text style={ms.rowMeta}>{fmtTime(a.startsAt)} with {a.staff.user.name}</Text>
            <View style={{ marginTop:10, alignSelf:'flex-start' }}>
              <Pill label={a.status.replace('_',' ')} color={STATUS_COLOR[a.status] ?? GRAY_500}/>
            </View>
          </View>
          <View style={ms.card}>
            <TouchableOpacity style={[ms.notifRow, ms.notifRowBorder]} onPress={()=>openManage(a)}>
              <Text style={ms.rowTitle}>Open manage link</Text><Ionicons name="open-outline" size={16} color={GRAY_400}/>
            </TouchableOpacity>
            {upcoming && (
              <TouchableOpacity style={[ms.notifRow, ms.notifRowBorder]} onPress={()=>rescheduleClientAppointment(a)}>
                <Text style={ms.rowTitle}>Reschedule</Text><Ionicons name="calendar-outline" size={16} color={GRAY_400}/>
              </TouchableOpacity>
            )}
            {upcoming && (
              <TouchableOpacity style={[ms.notifRow, ms.notifRowBorder]} onPress={()=>cancelClientAppointment(a)}>
                <Text style={[ms.rowTitle,{ color:'#DC2626' }]}>Cancel appointment</Text><Ionicons name="close-circle-outline" size={16} color="#DC2626"/>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[ms.notifRow, ms.notifRowBorder]} onPress={()=>rebook(a)}>
              <Text style={ms.rowTitle}>Book again</Text><Ionicons name="repeat-outline" size={16} color={GRAY_400}/>
            </TouchableOpacity>
            <TouchableOpacity style={ms.notifRow} onPress={()=>review(a)}>
              <Text style={ms.rowTitle}>Leave a review</Text><Ionicons name="star-outline" size={16} color={GRAY_400}/>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (clientReschedule) {
    const a = clientReschedule.appointment;
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <TouchableOpacity onPress={()=>setClientReschedule(null)} style={{ marginRight:12 }}>
            <Ionicons name="arrow-back" size={22} color={GRAY_700}/>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Reschedule</Text>
        </View>
        <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
          <Text style={s.stepLabel}>{a.service.name}</Text>
          <Text style={s.sub}>{a.business.name} with {a.staff.user.name}</Text>
          <Text style={[s.fieldLabel,{ marginTop:16 }]}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingVertical:8 }}>
            {Array.from({ length:21 }, (_,i) => { const d = new Date(); d.setDate(d.getDate()+i); return d.toISOString().slice(0,10); }).map(d => (
              <TouchableOpacity key={d} style={[s.datePill, clientReschedule.date===d && s.datePillActive]} onPress={()=>loadClientRescheduleSlots(a, d)}>
                <Text style={[s.datePillDay, clientReschedule.date===d && { color:'#fff' }]}>{new Date(d+'T00:00:00').toLocaleDateString('en-US',{ weekday:'short' })}</Text>
                <Text style={[s.datePillNum, clientReschedule.date===d && { color:'#fff' }]}>{new Date(d+'T00:00:00').getDate()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {clientReschedule.loading ? <ActivityIndicator color={BRAND} style={{ marginTop:20 }}/> : (
            <View style={s.slotGrid}>
              {clientReschedule.slots.map(sl => (
                <TouchableOpacity key={sl.startsAt} style={s.slotBtn} onPress={()=>saveClientReschedule(sl.startsAt)}>
                  <Text style={s.slotText}>{fmtTime(sl.startsAt)}</Text>
                </TouchableOpacity>
              ))}
              {clientReschedule.slots.length===0 && <Text style={s.emptyText}>No available times for this date.</Text>}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const tabs = [
    { id:'bookings' as const, label:'Bookings', icon:'calendar-outline' as const },
    { id:'messages' as const, label:'Messages', icon:'chatbubbles-outline' as const },
    { id:'offers' as const, label:'Offers', icon:'pricetag-outline' as const },
  ];

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My account</Text>
        <TouchableOpacity onPress={onLogout}><Ionicons name="log-out-outline" size={22} color="#EF4444"/></TouchableOpacity>
      </View>
      <View style={{ flexDirection:'row', gap:8, paddingHorizontal:16, paddingTop:12 }}>
        {tabs.map(t => (
          <TouchableOpacity key={t.id} onPress={()=>setTab(t.id)}
            style={[ms.methodChip, tab===t.id && ms.methodChipOn, { flex:1, flexDirection:'row', gap:6, justifyContent:'center' }]}>
            <Ionicons name={t.icon} size={16} color={tab===t.id ? BRAND : GRAY_500}/>
            <Text style={[ms.methodChipText, tab===t.id && { color:BRAND }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={BRAND} style={{ marginTop:40 }}/> : (
        <ScrollView
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{ setRefreshing(true); load(true); }} tintColor={BRAND}/>}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'bookings' && (
            <>
              {appointments.map(a => (
                <TouchableOpacity key={a.id} style={s.card} onPress={()=>setSelectedAppointment(a)}>
                  <View style={[s.dot,{ backgroundColor: STATUS_COLOR[a.status] ?? GRAY_400 }]}/>
                  <View style={s.cardBody}>
                    <Text style={s.clientName}>{a.service.name}</Text>
                    <Text style={s.sub}>{a.business.name} · {a.staff.user.name}</Text>
                    <Text style={s.dateText}>{new Date(a.startsAt).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' })} at {fmtTime(a.startsAt)}</Text>
                  </View>
                  <Pill label={a.status.replace('_',' ')} color={STATUS_COLOR[a.status] ?? GRAY_500}/>
                </TouchableOpacity>
              ))}
              {appointments.length === 0 && <Text style={s.emptyText}>No bookings yet</Text>}
            </>
          )}

          {tab === 'messages' && (
            <>
              {threads.map(t => {
                const last = t.messages[t.messages.length - 1];
                return (
                  <TouchableOpacity key={`${t.businessId}:${t.clientId}`} style={s.card} onPress={()=>setSelectedThread(t)}>
                    <View style={s.avatar}><Text style={s.avatarText}>{t.businessName.slice(0,2).toUpperCase()}</Text></View>
                    <View style={s.cardBody}>
                      <Text style={s.clientName}>{t.businessName}</Text>
                      <Text style={s.sub} numberOfLines={1}>{last?.content ?? 'Start a conversation'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={GRAY_400}/>
                  </TouchableOpacity>
                );
              })}
              {threads.length === 0 && <Text style={s.emptyText}>No message threads yet</Text>}
            </>
          )}

          {tab === 'offers' && (
            <>
              {offers.map(o => (
                <View key={o.id} style={[ms.card,{ borderLeftWidth:3, borderLeftColor:BRAND }]}>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                    <Text style={ms.rowTitle}>{o.title}</Text>
                    {!!o.discount && <View style={ms.dealChip}><Text style={ms.dealChipText}>{o.discount}</Text></View>}
                  </View>
                  <Text style={ms.rowMeta}>{o.business.name}</Text>
                  {!!o.description && <Text style={[ms.rowMeta,{ marginTop:4 }]}>{o.description}</Text>}
                  {!!o.expiresAt && <Text style={[ms.rowMeta,{ color:GRAY_400, marginTop:4 }]}>Expires {new Date(o.expiresAt).toLocaleDateString()}</Text>}
                </View>
              ))}
              {offers.length === 0 && <Text style={s.emptyText}>No active offers</Text>}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Tab navigator ────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

// The tab bar lives inside the SafeAreaProvider so it can read the bottom inset.
// Without this the bar sat flush at height:64 and its targets overlapped the home
// indicator — "extreme down, hard to reach". We lift it above the inset and give
// the row more height + breathing room so every tab is an easy tap.
function MainTabs({ msgClient, setMsgClient, onLogout }: {
  msgClient: Client|null;
  setMsgClient: (c:Client|null)=>void;
  onLogout: ()=>void;
}) {
  const insets = useSafeAreaInsets();
  const barHeight = 60 + Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: GRAY_900,
        tabBarInactiveTintColor: GRAY_400,
        // Active tab = rounded grey pill behind the icon + label.
        tabBarActiveBackgroundColor: GRAY_100,
        tabBarStyle: {
          backgroundColor:'#fff', borderTopColor:GRAY_100,
          height: barHeight,
          paddingTop:8, paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal:6,
        },
        tabBarItemStyle: { borderRadius:16, marginHorizontal:4, marginTop:6, marginBottom:6, paddingVertical:2 },
        tabBarLabelStyle: { fontSize:11, fontWeight:'600' },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string,[string,string]> = {
            Calendar:['calendar','calendar-outline'], Checkout:['card','card-outline'],
            Customers:['people','people-outline'], Messages:['chatbubbles','chatbubbles-outline'],
            Alerts:['notifications','notifications-outline'], Menu:['menu','menu-outline'],
          };
          const pair = icons[route.name] ?? ['ellipse','ellipse-outline'];
          return <Ionicons name={(focused ? pair[0] : pair[1]) as any} size={24} color={color}/>;
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
      <Tab.Screen name="Alerts" component={NotificationsScreen}/>
      <Tab.Screen name="Menu">
        {()=><MenuScreen onLogout={onLogout}/>}
      </Tab.Screen>
      {/* Hidden route — opened from the Calendar "+" to add an appointment. */}
      <Tab.Screen name="Book" component={BookScreen} options={{ tabBarButton: () => null }}/>
    </Tab.Navigator>
  );
}

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
    registerPushNotifications();
  })(); },[]);

  function handleLogin(t:string, r:string, u:User) { setAuth(t,u,r); setToken(t); setUser(u); persistAuth(); registerPushNotifications(); }
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

  if (user?.role === 'CLIENT') return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#fff"/>
        <ClientPortalScreen onLogout={handleLogout}/>
      </SafeAreaProvider>
    </ErrorBoundary>
  );

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff"/>
      <NavigationContainer>
        <MainTabs msgClient={msgClient} setMsgClient={setMsgClient} onLogout={handleLogout}/>
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
  verifiedPill:    { flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'#6D5BD0', borderRadius:99, paddingHorizontal:7, paddingVertical:2 },
  verifiedPillText:{ fontSize:10, fontWeight:'700', color:'#fff' },
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
  switchRow:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:12, padding:14, borderRadius:12, borderWidth:1, borderColor:GRAY_200, backgroundColor:GRAY_50 },
  switchTitle:     { fontSize:14, fontWeight:'700', color:GRAY_900 },
  switchSub:       { fontSize:12, color:GRAY_500, marginTop:2, lineHeight:17 },
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
