// Extracted from App.tsx (Phase 0b). Behavior unchanged.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, SectionList,
  ActivityIndicator, Alert, SafeAreaView, Platform, Modal, StatusBar,
  KeyboardAvoidingView, RefreshControl, BackHandler, Linking, Switch, Share,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { WEB_URL, API_BASE, BIZ_ID, uploadUri } from '../config';
import { BRAND, BRAND_LT, GRAY_50, GRAY_100, GRAY_200, GRAY_400, GRAY_500, GRAY_700, GRAY_900, STATUS_COLOR } from '../theme';
import type { User, Appointment, ServiceCategory, Service, AvailabilityRule, Staff, Slot, BookingSlot, Client, Message, NotificationItem, NotificationDelivery, TaskItem, ServiceDueItem, ClientPortalAppointment, ClientPortalMessageThread, ClientPortalOffer } from '../types';
import { fmtTime, fmtDur, normalizePhoneClient, formatPhoneDisplay } from '../format';
import { setAuth, getAuth, bizId, listeners, persistAuth, loadPersistedAuth, refreshSession } from '../auth';
import { api, registerPushNotifications } from '../api';
import { s, cal, co, ms, dst } from '../styles';
import { Pill, PriceTag, VerifiedPill } from '../components';
import { useHaptics } from '../hooks/useHaptics';

const STATUS_LABEL: Record<string, string> = {
  ALL: 'All', PENDING: 'Pending', CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'No-show',
};

import { io, Socket } from 'socket.io-client';

function CalendarScreen() {
  const { user } = getAuth();
  const nav = useNavigation<any>();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<{ appointment: Appointment; date: string; slots: Slot[]; loading: boolean } | null>(null);
  const [editAppt, setEditAppt] = useState<{ appointment: Appointment; name: string; email: string; phone: string; notes: string; notifyClient: boolean } | null>(null);
  const [acting, setActing] = useState(false);

  const { data: apts = [], isLoading: loadingApts, isFetching: refreshingApts, refetch: refetchApts } = useQuery({
    queryKey: ['bookings', bizId()],
    queryFn: () => api<{ data: Appointment[] }>(`/businesses/${bizId()}/bookings`).then(res => {
      const all = res.data;
      return (user?.role === 'STAFF' && user?.staffId
        ? all.filter(a => a.staff.id === user.staffId)
        : all
      ).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }),
    refetchInterval: 60_000,
  });

  const { data: biz, isLoading: loadingBiz } = useQuery({
    queryKey: ['business', bizId()],
    queryFn: () => api<any>(`/businesses/${bizId()}`),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api(`/businesses/${bizId()}/bookings/${id}/confirm`, { method: 'PATCH' }),
    onSuccess: () => {
      haptics.notification();
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSelected(null);
      Alert.alert('Done', 'Appointment confirmed');
    },
    onSettled: () => setActing(false)
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => api(`/businesses/${bizId()}/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      haptics.notification();
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSelected(null);
    },
    onSettled: () => setActing(false)
  });

  // Real-time sync via sockets
  useEffect(() => {
    const bId = bizId();
    if (!bId) return;

    let socket: Socket | null = null;
    const apiUrl = API_BASE.replace(/\/api$/, '');

    api<{ ticket: string }>('/events/ws-ticket').then(({ ticket }) => {
      socket = io(apiUrl, { transports: ['websocket'], auth: { ticket } });
      socket.on('connect', () => socket?.emit('joinBusiness', bId));
      socket.on('bookingUpdated', () => queryClient.invalidateQueries({ queryKey: ['bookings'] }));
      socket.on('appointmentUpdated', () => queryClient.invalidateQueries({ queryKey: ['bookings'] }));
    }).catch(() => { });

    return () => { socket?.disconnect(); };
  }, [queryClient]);

  // Hardware back (Android) closes the open appointment detail instead of leaving
  // the app; the overlay also has an on-screen close for iOS.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) { setSelected(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [selected]);

  async function confirm(id: string) {
    setActing(true);
    confirmMutation.mutate(id);
  }
  async function cancel(id: string) {
    Alert.alert('Cancel appointment', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel it', style: 'destructive', onPress: async () => {
          setActing(true);
          updateStatusMutation.mutate({ id, status: 'CANCELLED' });
        }
      },
    ]);
  }
  async function complete(id: string) {
    setActing(true);
    updateStatusMutation.mutate({ id, status: 'COMPLETED' });
  }
  async function syncCalendar(id: string) {
    setActing(true);
    try {
      const res = await api<{ success: boolean; googleSynced: boolean }>(`/calendar-sync/${id}`, { method: 'POST' });
      haptics.notification();
      if (res.googleSynced) {
        Alert.alert('Synced to Google Calendar', 'This appointment has been added to your Google Calendar.');
      } else {
        Alert.alert('Google Calendar not connected', "This appointment was saved, but Google Calendar isn't connected. Go to Settings → Calendar to link your account, or use the iCal feed to subscribe.");
      }
    } catch (e) {
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
    haptics.impact();
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
        method: 'PATCH',
        body: JSON.stringify({ startsAt }),
      });
      haptics.notification();
      setReschedule(null);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      Alert.alert('Rescheduled', 'The appointment was moved and the client was notified.');
    } catch (e) {
      Alert.alert('Could not reschedule', e instanceof Error ? e.message : 'Please try again.');
    } finally { setActing(false); }
  }

  function openEdit(a: Appointment) {
    setSelected(null);
    setEditAppt({
      appointment: a,
      name: a.client.name,
      email: a.client.email,
      phone: formatPhoneDisplay(a.client.phone),
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
        method: 'PATCH',
        body: JSON.stringify({
          clientName: editAppt.name.trim(),
          clientEmail: editAppt.email.trim().toLowerCase(),
          clientPhone: editAppt.phone.trim() || undefined,
          notes: editAppt.notes.trim(),
          notifyClient: editAppt.notifyClient,
        }),
      });
      haptics.notification();
      setEditAppt(null);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      Alert.alert('Saved', editAppt.notifyClient ? 'The client was notified.' : 'Saved without notifying the client.');
    } catch (e) {

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
          const r = await api<{ charged: boolean; feeCents: number; message?: string }>(`/payments/no-show/${id}`, { method: 'POST' });
          haptics.notification();
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          setSelected(null);
          Alert.alert(
            r.charged ? 'No-show fee charged' : 'Marked no-show',
            r.charged ? `Charged $${(r.feeCents / 100).toFixed(2)} to the card on file.` : (r.message || 'No saved card — collect the fee manually.'),
          );
        } catch (e) {
 Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
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
  // A 60-day horizontal strip starting today, so the screen reads as a calendar.
  const STRIP_DAYS = Array.from({ length: 60 }, (_, i) => {
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
      { text: 'Refresh', onPress: () => refetchApts() },
      { text: 'New appointment', onPress: () => nav.navigate('Book') },
      { text: 'Close', style: 'cancel' },
    ]);
  }

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const staffOptions = Array.from(new Map(apts.map(a => [a.staff.id, a.staff.user.name])).entries());
  const multiProvider = staffOptions.length > 1;

  if (loadingApts) return <View style={s.center}><ActivityIndicator size="large" color={BRAND} /></View>;

  return (
    <SafeAreaView style={s.screen}>
      {/* Top bar: ⋯ (left) · Month ▾ (center) · + (right) */}
      <View style={cal.topbar}>
        <TouchableOpacity style={cal.topBtn} onPress={()=>nav.navigate('Menu')} hitSlop={{top:8,bottom:8,left:8,right:8}}
          accessibilityRole="button" accessibilityLabel="Open menu">
          {biz?.logoUrl ? (
            <Image source={{ uri: uploadUri(biz.logoUrl)! }} style={{ width:28, height:28, borderRadius:8 }} contentFit="cover"
              accessible={true} accessibilityLabel="Business logo"/>
          ) : (
            <Ionicons name="person-circle-outline" size={28} color={GRAY_700}/>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={cal.monthWrap} activeOpacity={0.7} onPress={() => refetchApts()}
          accessibilityRole="button" accessibilityLabel="Refresh calendar">
          <Text style={cal.monthText}>{monthLabel}</Text>
          <Ionicons name="chevron-down" size={16} color={GRAY_700} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        <TouchableOpacity style={cal.topBtn} onPress={()=>nav.navigate('Book')} hitSlop={{top:8,bottom:8,left:8,right:8}}
          accessibilityRole="button" accessibilityLabel="Add new appointment">
          <Ionicons name="add" size={26} color={BRAND}/>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingHorizontal:16, paddingBottom:8 }}>
        {(['ALL','PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'] as const).map(status => (
          <TouchableOpacity key={status} onPress={()=>setStatusFilter(status)}
            style={[cal.filterChip, statusFilter===status && cal.filterChipOn]}
            accessibilityRole="button"
            accessibilityLabel={STATUS_LABEL[status] ?? status}
            accessibilityState={{ selected: statusFilter===status }}>
            <Text style={[cal.filterText, statusFilter===status && cal.filterTextOn]}>{STATUS_LABEL[status] ?? status}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {multiProvider && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingHorizontal:16, paddingBottom:8 }}>
          <TouchableOpacity onPress={()=>setStaffFilter('ALL')} style={[cal.filterChip, staffFilter==='ALL' && cal.filterChipOn]}
            accessibilityRole="button" accessibilityLabel="Everyone" accessibilityState={{ selected: staffFilter==='ALL' }}>
            <Text style={[cal.filterText, staffFilter==='ALL' && cal.filterTextOn]}>Everyone</Text>
          </TouchableOpacity>
          {staffOptions.map(([id,name]) => (
            <TouchableOpacity key={id} onPress={()=>setStaffFilter(id)} style={[cal.filterChip, staffFilter===id && cal.filterChipOn]}
              accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected: staffFilter===id }}>
              <Text style={[cal.filterText, staffFilter===id && cal.filterTextOn]}>{name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Calendar date strip — tap a day to focus it; dot = has appointments */}
      <View style={cal.stripWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingHorizontal:16 }}>
          <TouchableOpacity onPress={()=>setDayFilter(null)} style={[cal.allDay, dayFilter===null && cal.allDayOn]}
            accessibilityRole="button" accessibilityLabel="All days" accessibilityState={{ selected: dayFilter===null }}>
            <Ionicons name="albums-outline" size={16} color={dayFilter===null ? '#fff' : GRAY_500}/>
            <Text style={[cal.allDayText, dayFilter===null && { color:'#fff' }]}>All</Text>
          </TouchableOpacity>
          {STRIP_DAYS.map(({ key, date, count }) => {
            const on = dayFilter === key;
            const isToday = key === TODAY_KEY;
            return (
              <TouchableOpacity key={key} onPress={()=>setDayFilter(on ? null : key)} style={[cal.dayCell, on && cal.dayCellOn]}
                accessibilityRole="button"
                accessibilityLabel={`${date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}, ${count} appointment${count===1?'':'s'}`}
                accessibilityState={{ selected: on }}>
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
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshingApts} onRefresh={refetchApts} tintColor={BRAND} />}
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
          const color = STATUS_COLOR[a.status] ?? GRAY_200;
          return (
            <TouchableOpacity
              style={[cal.aptRow, {
                backgroundColor: '#fff',
                borderLeftWidth: 4,
                borderLeftColor: color,
                marginHorizontal: 10,
                marginVertical: 2,
                borderRadius: 10,
                shadowColor: '#000',
                shadowOpacity: 0.04,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
                borderBottomWidth: 0,
                paddingVertical: 6, // super compact
              }]}
              activeOpacity={0.6}
              onPress={()=>setSelected(a)}
              accessibilityRole="button"
              accessibilityLabel={`${a.client.name}, ${a.service.name} at ${fmtTime(d)}`}
            >
              <View style={{flex:1}}>
                <Text style={cal.aptClient}>{a.client.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  <Text style={cal.aptService}>{a.service.name}</Text>
                  {a.location && <Ionicons name="location-outline" size={10} color={GRAY_400} />}
                </View>
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
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={()=>setSelected(null)}
          accessibilityRole="button" accessibilityLabel="Close appointment details">
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={()=>{}}>
            <View style={s.sheetHandle}/>
            <Text style={s.sheetTitle}>Appointment</Text>

            <View style={[s.aptBlock, {borderLeftColor: STATUS_COLOR[selected.status]??GRAY_200}]}>
              <Text style={s.aptBlockDate}>
                {new Date(selected.startsAt).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} at {fmtTime(selected.startsAt)}
              </Text>
              <Text style={s.aptBlockSub}>{selected.service.name}{multiProvider ? ` · ${selected.staff.user.name}` : ''}</Text>
            </View>

            {[
              {l:'Client', v:selected.client.name},
              {l:'Email',  v:selected.client.email},
              {l:'Phone',  v:selected.client.phone ? formatPhoneDisplay(selected.client.phone) : '—'},
              {l:'Status', v:selected.status},
              {l:'Price',  v:`$${(selected.service.priceCents/100).toFixed(2)}`},
              {l:'Location', v:selected.location?.name || biz?.address || '—'},
            ].map(({l,v})=>(
              <View key={l} style={s.detailRow}>
                <Text style={s.detailLabel}>{l}</Text>
                <View style={{flex:1, alignItems:'flex-end'}}>
                  <Text style={s.detailValue}>{v}</Text>
                  {l==='Location' && v!=='—' && (
                    <TouchableOpacity onPress={()=>Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`)}
                      accessibilityRole="button" accessibilityLabel="Open location in Maps">
                      <Text style={{fontSize:11, color:BRAND, fontWeight:'600', marginTop:2}}>Open in Maps</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            {selected.notes && (
              <View style={s.notesBox}>
                <Text style={s.notesText}>{selected.notes}</Text>
              </View>
            )}

            <View style={s.sheetActions}>
              {selected.status==='PENDING' && <TouchableOpacity style={s.btnPrimary} disabled={acting} onPress={()=>confirm(selected.id)} accessibilityRole="button" accessibilityLabel="Confirm appointment"><Text style={s.btnPrimaryText}>Confirm</Text></TouchableOpacity>}
              {selected.status==='CONFIRMED' && <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>complete(selected.id)} accessibilityRole="button" accessibilityLabel="Mark completed"><Text style={s.btnSecondaryText}>Mark completed</Text></TouchableOpacity>}
              {selected.status==='CONFIRMED' && <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>noShow(selected.id)} accessibilityRole="button" accessibilityLabel="No-show and charge fee"><Text style={s.btnSecondaryText}>No-show & charge fee</Text></TouchableOpacity>}
              <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>openEdit(selected)} accessibilityRole="button" accessibilityLabel="Edit details"><Text style={s.btnSecondaryText}>Edit details</Text></TouchableOpacity>
              {['PENDING','CONFIRMED'].includes(selected.status) && <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>openReschedule(selected)} accessibilityRole="button" accessibilityLabel="Reschedule appointment"><Text style={s.btnSecondaryText}>Reschedule</Text></TouchableOpacity>}
              {['PENDING','CONFIRMED'].includes(selected.status) && user?.role === 'OWNER' && <TouchableOpacity style={s.btnSecondary} disabled={acting} onPress={()=>syncCalendar(selected.id)} accessibilityRole="button" accessibilityLabel="Sync calendar"><Text style={s.btnSecondaryText}>Sync calendar</Text></TouchableOpacity>}
              {['PENDING','CONFIRMED'].includes(selected.status) && (
                <TouchableOpacity style={s.btnDanger} disabled={acting} onPress={()=>cancel(selected.id)} accessibilityRole="button" accessibilityLabel="Cancel appointment"><Text style={s.btnDangerText}>Cancel</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnGhost} onPress={()=>setSelected(null)} accessibilityRole="button" accessibilityLabel="Close"><Text style={s.btnGhostText}>Close</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <Modal visible={!!reschedule} animationType="slide" onRequestClose={()=>setReschedule(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setReschedule(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Reschedule</Text>
          </View>
          {reschedule && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.stepLabel}>{reschedule.appointment.client.name}</Text>
              <Text style={s.sub}>{reschedule.appointment.service.name} with {reschedule.appointment.staff.user.name}</Text>
              <Text style={[s.fieldLabel,{ marginTop:16 }]}>Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingVertical:8 }}>
                {Array.from({ length:21 }, (_,i) => { const d = new Date(); d.setDate(d.getDate()+i); return d.toISOString().slice(0,10); }).map(d => (
                  <TouchableOpacity key={d} style={[s.datePill, reschedule.date===d && s.datePillActive]} onPress={()=>loadRescheduleSlots(reschedule.appointment, d)}
                    accessibilityRole="button"
                    accessibilityLabel={new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
                    accessibilityState={{ selected: reschedule.date===d }}>
                    <Text style={[s.datePillDay, reschedule.date===d && { color:'#fff' }]}>{new Date(d+'T00:00:00').toLocaleDateString('en-US',{ weekday:'short' })}</Text>
                    <Text style={[s.datePillNum, reschedule.date===d && { color:'#fff' }]}>{new Date(d+'T00:00:00').getDate()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {reschedule.loading ? <ActivityIndicator color={BRAND} style={{ marginTop:20 }}/> : (
                <View style={s.slotGrid}>
                  {reschedule.slots.map(sl => (
                    <TouchableOpacity key={sl.startsAt} style={s.slotBtn} disabled={acting} onPress={()=>saveReschedule(sl.startsAt)}
                      accessibilityRole="button" accessibilityLabel={fmtTime(sl.startsAt)}>
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
            <TouchableOpacity onPress={()=>setEditAppt(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
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

              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} disabled={acting} onPress={saveAppointmentEdit}
                accessibilityRole="button" accessibilityLabel="Save changes">
                {acting ? <ActivityIndicator color="#fff"/> : <Text style={s.btnPrimaryText}>Save changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export { CalendarScreen };
