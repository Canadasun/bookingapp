// Extracted from App.tsx (Phase 0b). Behavior unchanged.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, SectionList,
  ActivityIndicator, Alert, SafeAreaView, Platform, Modal, StatusBar,
  KeyboardAvoidingView, RefreshControl, BackHandler, Linking, Switch, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { WEB_URL, API_BASE, BIZ_ID, uploadUri } from '../config';
import { BRAND, BRAND_LT, GRAY_50, GRAY_100, GRAY_200, GRAY_400, GRAY_500, GRAY_700, GRAY_900, STATUS_COLOR } from '../theme';
import type { User, Appointment, ServiceCategory, Service, AvailabilityRule, Staff, Slot, BookingSlot, Client, Message, NotificationItem, NotificationDelivery, TaskItem, ServiceDueItem, ClientPortalAppointment, ClientPortalMessageThread, ClientPortalOffer } from '../types';
import { fmtTime, fmtDur, normalizePhoneClient, formatPhoneInput } from '../format';
import { setAuth, getAuth, bizId, listeners, persistAuth, loadPersistedAuth, refreshSession } from '../auth';
import { api, registerPushNotifications } from '../api';
import { s, cal, co, ms, dst } from '../styles';
import { Pill, PriceTag, VerifiedPill } from '../components';
import { useHaptics } from '../hooks/useHaptics';

function BookScreen() {
  const nav = useNavigation<any>();
  const haptics = useHaptics();
  type Step = 'service'|'staff'|'date'|'time'|'details'|'done';
  const [step, setStep]               = useState<Step>('service');
  const [services, setServices]       = useState<Service[]>([]);
  const [staffList, setStaffList]     = useState<Staff[]>([]);
  // Unfiltered active providers (always includes the owner — the business itself).
  // Used as the fallback provider so a booking never fails for lack of a match,
  // mirroring the web checkout (sole-proprietor model: owner = the business).
  const [allStaffList, setAllStaffList] = useState<Staff[]>([]);
  const [slots, setSlots]             = useState<BookingSlot[]>([]);
  const [selectedSvcs, setSelectedSvcs] = useState<Service[]>([]);
  const [staff, setStaff]             = useState<Staff|null|'any'>(null);
  const [date, setDate]               = useState('');
  const [slot, setSlot]               = useState<BookingSlot|null>(null);
  const [showStaffStep, setShowStaffStep] = useState(false);
  const [customStartsAt, setCustomStartsAt] = useState('');
  // Manual time picker (no native module needed) — composes customStartsAt for the
  // already-selected `date`, so owners can book any time, overriding the calendar.
  const [manualHour, setManualHour] = useState(9);          // 1–12
  const [manualMin, setManualMin]   = useState(0);          // 0,5,…,55
  const [manualMeridiem, setManualMeridiem] = useState<'AM'|'PM'>('AM');
  const [repeat, setRepeat] = useState<{ frequency:'WEEKLY'|'BIWEEKLY'|'THREE_WEEKS'|'EIGHT_WEEKS'|'MONTHLY'; count:number }|null>(null);
  const [overrideCalendar, setOverrideCalendar] = useState(false);
  const [form, setForm]               = useState({name:'',email:'',phone:''});
  const [referralSource, setReferralSource] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [bookedId, setBookedId]       = useState('');
  const [wlPrompt, setWlPrompt]       = useState(false);
  const [wlSaving, setWlSaving]       = useState(false);
  const [cancellationPolicy, setCancellationPolicy] = useState<string|null>(null);

  // Build a 90-day date strip from today
  const dateStrip = Array.from({length: 90}, (_, i) => {
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

  // Compose "YYYY-MM-DD HH:mm" (24h) from the picked date + manual time controls.
  function manualStartsAt() {
    let h = manualHour % 12;
    if (manualMeridiem === 'PM') h += 12;
    return `${date} ${String(h).padStart(2,'0')}:${String(manualMin).padStart(2,'0')}`;
  }
  const manualLabel = `${String(manualHour).padStart(2,'0')}:${String(manualMin).padStart(2,'0')} ${manualMeridiem}`;

  useEffect(()=>{
    api<Service[]>(`/businesses/${bizId()}/services`).then(s=>setServices(s.filter(x=>x.active))).catch(()=>{});
    api<{cancellationPolicy?:string|null}>(`/businesses/${bizId()}`).then(b=>{ if (b.cancellationPolicy) setCancellationPolicy(b.cancellationPolicy); }).catch(()=>{});
  },[]);

  function toggleSvc(sv: Service) {
    haptics.selection();
    setSelectedSvcs(p => p.find(s=>s.id===sv.id) ? p.filter(s=>s.id!==sv.id) : [...p, sv]);
  }

  async function goToStaff() {
    if (selectedSvcs.length === 0) return;
    try {
      const all = await api<Staff[]>(`/businesses/${bizId()}/staff`);
      const activeAll = all.filter(st => st.active !== false);
      const filtered = activeAll.filter(st => st.staffServices.length === 0 || selectedSvcs.every(sv => st.staffServices.some(ss=>ss.serviceId === sv.id)));
      const hasAddedStaff = activeAll.some(st => st.user.role !== 'OWNER');
      setAllStaffList(activeAll);
      setStaffList(filtered);
      setShowStaffStep(hasAddedStaff);
      if (hasAddedStaff) {
        setStep('staff');
      } else {
        // Solo business → book as the owner (the business). Fall back to the
        // unfiltered owner record if the service filter excluded it.
        setStaff(filtered[0] ?? activeAll[0] ?? 'any');
        setStep('date');
      }
    } catch { Alert.alert('Error','Could not load staff'); }
  }

  async function pickDate(d: string) {
    haptics.impact();
    setDate(d); setLoading(true); setSlots([]);
    try {
      const serviceId = selectedSvcs[0]?.id ?? '';
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Fall back to the unfiltered list (the owner/business) so we always have a
      // provider to pull availability for — never block the booking outright.
      const targets = staff && staff !== 'any' ? [staff] : (staffList.length ? staffList : allStaffList);
      if (targets.length === 0 || !serviceId) { Alert.alert('Provider required','No active provider is available for this service.'); return; }
      const additionalServiceIds = selectedSvcs.slice(1).map(s => s.id);
      const addonQuery = additionalServiceIds.length ? `&additionalServiceIds=${encodeURIComponent(additionalServiceIds.join(','))}` : '';
      const rows = await Promise.all(targets.map(async st => {
        // enforceNotice=false: owner-created bookings aren't bound by the public
        // minimum-notice window (matches web), so today's times still show.
        const data = await api<Slot[]>(`/availability/slots?staffId=${st.id}&serviceId=${serviceId}${addonQuery}&startDate=${d}&endDate=${d}&timezone=${tz}&enforceNotice=false`);
        return data.map(sl => ({...sl, staffId:st.id, staffName:st.user.name}));
      }));
      setSlots(rows.flat().sort((a,b)=>new Date(a.startsAt).getTime()-new Date(b.startsAt).getTime()));
      setStep('time');
    } catch { Alert.alert('Error','Could not load times'); }
    finally { setLoading(false); }
  }

  async function book() {
    if (form.name.trim().length < 2){ Alert.alert('Name required',"Enter the client's full name."); return; }
    if (!form.email.trim() && !form.phone.trim()){ Alert.alert('Contact required','Enter an email address or phone number.'); return; }
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email.trim())) { Alert.alert('Check email','Enter a valid email address or leave it blank.'); return; }
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
      // Resolve the provider, always falling back to the owner (the business)
      // so a solo business never hits "Choose a provider" (mirrors web checkout).
      const ownerFallback = staffList[0]?.id ?? allStaffList[0]?.id ?? '';
      const staffId = customDate
        ? (staff && staff !== 'any' ? staff.id : ownerFallback)
        : (staff && staff !== 'any' ? staff.id : (slot?.staffId ?? ownerFallback));
      if (!staffId){ Alert.alert('Provider required','Choose a provider before booking.'); return; }
      if (!startsAt){ Alert.alert('Time required','Choose an available time or enter a custom owner time.'); return; }
      const client = await api<{id:string; matched?:boolean}>(`/businesses/${bizId()}/clients`, {
        method:'POST', body: JSON.stringify({name:form.name.trim(),email:form.email.trim() || undefined,phone:normalizedPhone}),
      });
      // Owner/staff booking from the app → confirmed immediately (the /manual
      // endpoint skips approval and sends the client their confirmation).
      const basePayload = {
        staffId,
        serviceId:selectedSvcs[0].id,
        additionalServiceIds: selectedSvcs.slice(1).map(s => s.id),
        clientId:client.id,
        startsAt,
        allowOverride: overrideCalendar || !!customStartsAt,
        referralSource: referralSource || undefined,
      };
      if (repeat) {
        // Recurring series: first occurrence must succeed; later conflicts are skipped.
        const res = await api<{ groupId:string; created:{id:string}[]; skipped:string[] }>(`/businesses/${bizId()}/bookings/recurring`, {
          method:'POST', body: JSON.stringify({ ...basePayload, frequency: repeat.frequency, count: repeat.count }),
        });
        haptics.notification();
        setBookedId(res.created[0]?.id ?? '');
        setStep('done');
        Alert.alert(
          'Series booked',
          `${res.created.length} appointment${res.created.length===1?'':'s'} booked${res.skipped.length?`; ${res.skipped.length} skipped (conflicts)`:''}.${client.matched?'\nMatched an existing client.':''}`,
        );
      } else {
        const apt = await api<{id:string}>(`/businesses/${bizId()}/bookings/manual`, {
          method:'POST', body: JSON.stringify(basePayload),
        });
        haptics.notification();
        if (client.matched) {
          Alert.alert('Existing client', 'We matched this booking to an existing client profile and synced their details.');
        }
        setBookedId(apt.id); setStep('done');
      }
    } catch(e){
      const msg = e instanceof Error ? e.message : '';
      if (msg && (msg.toLowerCase().includes('conflict') || msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('no longer available'))) {
        setWlPrompt(true);
      }
      Alert.alert('Booking failed', msg || 'Please try again');
    }
    finally { setLoading(false); }
  }

  function reset() {
    setStep('service'); setSelectedSvcs([]); setStaff(null); setDate(''); setSlot(null);
    setStaffList([]); setAllStaffList([]); setShowStaffStep(false); setCustomStartsAt(''); setOverrideCalendar(false);
    setManualHour(9); setManualMin(0); setManualMeridiem('AM');
    setForm({name:'',email:'',phone:''}); setReferralSource(''); setPolicyAccepted(false); setBookedId(''); setRepeat(null);
    setWlPrompt(false); setWlSaving(false);
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>nav.goBack()} style={{marginRight:6}} hitSlop={{top:8,bottom:8,left:8,right:8}} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={GRAY_700}/>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Book appointment</Text>
      </View>
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
                        onPress={()=>toggleSvc(sv)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${sv.name}, ${totalPrice([sv])}`}
                        accessibilityState={{ selected: sel }}>
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
            <TouchableOpacity style={[s.btnPrimary,{marginTop:16,opacity:selectedSvcs.length===0?0.4:1}]} disabled={selectedSvcs.length===0} onPress={goToStaff} accessibilityRole="button" accessibilityLabel="Continue">
              <Text style={s.btnPrimaryText}>Continue</Text>
            </TouchableOpacity>
          </>}

          {/* ── Staff ──────────────────────────────────────────────── */}
          {step==='staff' && <>
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep('service')} accessibilityRole="button" accessibilityLabel="Go back"><Text style={s.backText}>← Back</Text></TouchableOpacity>
            <Text style={s.stepLabel}>Choose a provider</Text>
            <TouchableOpacity style={[s.card, staff==='any'&&{borderColor:BRAND,backgroundColor:BRAND_LT}]}
              activeOpacity={0.7} disabled={staffList.length===0} onPress={()=>{setStaff('any');setStep('date');}}
              accessibilityRole="button" accessibilityLabel="Select Any available" accessibilityState={{ selected: staff==='any' }}>
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
                activeOpacity={0.7} onPress={()=>{setStaff(st);setStep('date');}}
                accessibilityRole="button"
                accessibilityLabel={`Select ${st.user.name}`}
                accessibilityState={{ selected: !!(staff&&staff!=='any'&&(staff as Staff).id===st.id) }}>
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
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep(showStaffStep ? 'staff' : 'service')} accessibilityRole="button" accessibilityLabel="Go back"><Text style={s.backText}>← Back</Text></TouchableOpacity>
            <Text style={s.stepLabel}>Pick a date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}}>
              {dateStrip.map(d=>{
                const {day,num} = fmtStripDate(d);
                const sel = date===d;
                return (
                  <TouchableOpacity key={d} activeOpacity={0.7}
                    style={[s.datePill, sel&&s.datePillActive]}
                    onPress={()=>pickDate(d)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select date ${d}`}
                    accessibilityState={{ selected: sel }}>
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
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep('date')} accessibilityRole="button" accessibilityLabel="Go back"><Text style={s.backText}>← Back</Text></TouchableOpacity>
            <Text style={s.stepLabel}>Available times</Text>
            <Text style={[s.sub,{marginBottom:12}]}>{new Date(date+'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</Text>
            <View style={[s.policyBox,{ marginBottom:14 }]}>
              <Text style={s.policyTitle}>Set time manually</Text>
              <Text style={s.policyText}>Pick any time on {new Date(date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} to book outside the generated slots — great for walk-ins or custom hours. This overrides calendar conflicts.</Text>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, marginTop:14, marginBottom:4 }}>
                {/* Hour */}
                <View style={{ alignItems:'center' }}>
                  <TouchableOpacity onPress={()=>setManualHour(h=>h===12?1:h+1)} hitSlop={{top:6,bottom:6,left:10,right:10}} accessibilityRole="button" accessibilityLabel="Increase time" accessibilityHint="Double tap to change time"><Ionicons name="chevron-up" size={20} color={GRAY_500}/></TouchableOpacity>
                  <Text style={{ fontSize:28, fontWeight:'800', color:GRAY_900, marginVertical:2, minWidth:46, textAlign:'center' }}>{String(manualHour).padStart(2,'0')}</Text>
                  <TouchableOpacity onPress={()=>setManualHour(h=>h===1?12:h-1)} hitSlop={{top:6,bottom:6,left:10,right:10}} accessibilityRole="button" accessibilityLabel="Decrease time" accessibilityHint="Double tap to change time"><Ionicons name="chevron-down" size={20} color={GRAY_500}/></TouchableOpacity>
                </View>
                <Text style={{ fontSize:28, fontWeight:'800', color:GRAY_400 }}>:</Text>
                {/* Minute (5-min steps) */}
                <View style={{ alignItems:'center' }}>
                  <TouchableOpacity onPress={()=>setManualMin(m=>(m+5)%60)} hitSlop={{top:6,bottom:6,left:10,right:10}} accessibilityRole="button" accessibilityLabel="Increase time" accessibilityHint="Double tap to change time"><Ionicons name="chevron-up" size={20} color={GRAY_500}/></TouchableOpacity>
                  <Text style={{ fontSize:28, fontWeight:'800', color:GRAY_900, marginVertical:2, minWidth:46, textAlign:'center' }}>{String(manualMin).padStart(2,'0')}</Text>
                  <TouchableOpacity onPress={()=>setManualMin(m=>(m+55)%60)} hitSlop={{top:6,bottom:6,left:10,right:10}} accessibilityRole="button" accessibilityLabel="Decrease time" accessibilityHint="Double tap to change time"><Ionicons name="chevron-down" size={20} color={GRAY_500}/></TouchableOpacity>
                </View>
                {/* AM / PM */}
                <View style={{ gap:6, marginLeft:8 }}>
                  {(['AM','PM'] as const).map(mer => (
                    <TouchableOpacity key={mer} onPress={()=>setManualMeridiem(mer)}
                      style={[s.slotBtn, manualMeridiem===mer && s.slotBtnActive, { paddingVertical:6, paddingHorizontal:14 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`${mer} frequency`}
                      accessibilityState={{ selected: manualMeridiem===mer }}>
                      <Text style={[s.slotText, manualMeridiem===mer && s.slotTextActive]}>{mer}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={[s.btnSecondary,{ marginTop:12 }]} onPress={()=>{ setCustomStartsAt(manualStartsAt()); setOverrideCalendar(true); setSlot(null); setStep('details'); }} accessibilityRole="button" accessibilityLabel={`Use ${manualLabel}`}>
                <Text style={s.btnSecondaryText}>Use {manualLabel}</Text>
              </TouchableOpacity>
            </View>
            {loading&&<ActivityIndicator color={BRAND} style={{marginTop:20}}/>}
            {slots.length === 0 && !loading && date ? (
              <View style={[ms.card, { alignItems:'center', paddingVertical:24 }]}>
                <Ionicons name="time-outline" size={28} color={GRAY_400}/>
                <Text style={[ms.rowTitle,{ marginTop:8, textAlign:'center' }]}>Fully booked on this day</Text>
                <Text style={[ms.empty,{ textAlign:'center', marginTop:4 }]}>Join the waitlist and we&apos;ll contact you when a spot opens.</Text>
                <TouchableOpacity style={[s.btnPrimary,{ marginTop:12, paddingHorizontal:24 }]} onPress={()=>setWlPrompt(true)} accessibilityRole="button" accessibilityLabel="Join Waitlist">
                  <Text style={s.btnPrimaryText}>Join Waitlist</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.slotGrid}>
                {slots.map(sl=>{
                  const slotSelected = slot?.startsAt===sl.startsAt&&slot?.staffId===sl.staffId;
                  return (
                    <TouchableOpacity key={`${sl.staffId ?? 'staff'}-${sl.startsAt}`} style={[s.slotBtn, slotSelected&&s.slotBtnActive]}
                      onPress={()=>{setSlot(sl);setStep('details');}}
                      accessibilityRole="button"
                      accessibilityLabel={`Select time ${fmtTime(sl.startsAtLocal)}`}
                      accessibilityState={{ selected: slotSelected }}>
                      <Text style={[s.slotText, slotSelected&&s.slotTextActive]}>
                        {fmtTime(sl.startsAtLocal)}
                      </Text>
                      {showStaffStep && sl.staffName && <Text style={[s.sub,{fontSize:10,textAlign:'center',marginTop:2}]} numberOfLines={1}>{sl.staffName}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>}

          {/* ── Details + Policy ───────────────────────────────────── */}
          {step==='details' && <>
            <TouchableOpacity style={s.backBtn} onPress={()=>setStep('time')} accessibilityRole="button" accessibilityLabel="Go back"><Text style={s.backText}>← Back</Text></TouchableOpacity>
            <View style={s.summaryBox}>
              <Text style={s.summaryTitle}>{selectedSvcs.map(s=>s.name).join(' + ')}</Text>
              <Text style={s.summarySub}>
                {staff&&staff!=='any'?(staff as Staff).user.name:(slot?.staffName ?? 'Owner provider')} · {customStartsAt ? `${new Date(date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} at ${manualLabel}` : `${date.slice(5).replace('-','/')} at ${slot ? fmtTime(slot.startsAtLocal) : ''}`}
              </Text>
              <Text style={[s.summarySub,{marginTop:4}]}>{totalDuration(selectedSvcs)} · {totalPrice(selectedSvcs)}</Text>
            </View>
            {[
              {k:'name',   label:'Full name *',    type:'default' as const,       ph:'Jane Doe',            a11yLabel:'Full name'},
              {k:'email',  label:'Email',            type:'email-address' as const, ph:'you@example.com',     a11yLabel:'Email address'},
              {k:'phone',  label:'Phone',            type:'phone-pad' as const,     ph:'+1 (416) 555-0123',   a11yLabel:'Phone number'},
            ].map(({k,label,type,ph,a11yLabel})=>(
              <View key={k} style={{marginBottom:12}}>
                <Text style={s.fieldLabel}>{label}</Text>
                <TextInput style={s.input} placeholder={ph} placeholderTextColor={GRAY_400}
                  keyboardType={type} autoCapitalize={k==='name'?'words':'none'}
                  accessibilityLabel={a11yLabel}
                  value={form[k as keyof typeof form]}
                  onChangeText={k==='phone' ? (text=>setForm(p=>({...p,phone:formatPhoneInput(text)}))) : (v=>setForm(p=>({...p,[k]:v})))}
                  onBlur={k==='phone'?()=>{ const np=normalizePhoneClient(form.phone); if(np) setForm(p=>({...p,phone:np})); }:undefined}/>
                {k==='phone' && <Text style={s.fieldHint}>Enter an email address, a phone number, or both.</Text>}
              </View>
            ))}
            {/* Repeat (recurring series) */}
            <Text style={s.fieldLabel}>Repeat</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom: repeat?8:14 }}>
              {([['Once',null],['Weekly','WEEKLY'],['2 weeks','BIWEEKLY'],['3 weeks','THREE_WEEKS'],['8 weeks','EIGHT_WEEKS'],['Monthly','MONTHLY']] as const).map(([label,freq])=>{
                const on = (freq===null && !repeat) || (repeat?.frequency===freq);
                return (
                  <TouchableOpacity key={label} onPress={()=>setRepeat(freq===null ? null : { frequency:freq, count: repeat?.count ?? 4 })}
                    style={[s.slotBtn, on && s.slotBtnActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} frequency`}
                    accessibilityState={{ selected: on }}>
                    <Text style={[s.slotText, on && s.slotTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {repeat && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:14 }}>
                <Text style={[s.fieldLabel,{ marginBottom:0 }]}>Times</Text>
                <TouchableOpacity onPress={()=>setRepeat(r=>r?{...r,count:Math.max(1,r.count-1)}:r)} style={[s.slotBtn,{ paddingHorizontal:16 }]} accessibilityRole="button" accessibilityLabel="Decrease time"><Text style={s.slotText}>−</Text></TouchableOpacity>
                <Text style={{ fontSize:18, fontWeight:'800', color:GRAY_900, minWidth:28, textAlign:'center' }}>{repeat.count}</Text>
                <TouchableOpacity onPress={()=>setRepeat(r=>r?{...r,count:Math.min(12,r.count+1)}:r)} style={[s.slotBtn,{ paddingHorizontal:16 }]} accessibilityRole="button" accessibilityLabel="Increase time"><Text style={s.slotText}>+</Text></TouchableOpacity>
              </View>
            )}
            {/* How did you hear about us */}
            <Text style={s.fieldLabel}>How did you hear about us? (optional)</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:14 }}>
              {(['Instagram','TikTok','Google','Facebook','Referral','Walk-in','Returning','Other'] as const).map(src=>(
                <TouchableOpacity key={src} onPress={()=>setReferralSource(s=>s===src?'':src)}
                  style={[s.slotBtn, referralSource===src&&s.slotBtnActive]}
                  accessibilityRole="button"
                  accessibilityLabel={src}
                  accessibilityState={{ selected: referralSource===src }}>
                  <Text style={[s.slotText, referralSource===src&&s.slotTextActive]}>{src}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Cancellation policy */}
            <View style={s.policyBox}>
              <Text style={s.policyTitle}>Cancellation Policy</Text>
              <Text style={s.policyText}>{cancellationPolicy ?? 'Appointments cancelled within 24 hours may be subject to a cancellation fee. No-shows may be charged a fee. Please contact us at least 24 hours in advance if you need to cancel or reschedule.'}</Text>
              <TouchableOpacity style={s.policyCheck} activeOpacity={0.7} onPress={()=>setPolicyAccepted(p=>!p)}
                accessibilityRole="checkbox"
                accessibilityLabel="Accept booking policy"
                accessibilityState={{ checked: policyAccepted }}
                accessibilityHint="Required to complete booking">
                <View style={[s.checkbox, policyAccepted&&s.checkboxActive]}>
                  {policyAccepted&&<Ionicons name="checkmark" size={12} color="#fff"/>}
                </View>
                <Text style={s.policyCheckText}>I agree to the cancellation policy</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.btnPrimary,{opacity:loading||!policyAccepted?0.5:1}]} disabled={loading||!policyAccepted} onPress={book} accessibilityRole="button" accessibilityLabel="Book appointment">
              <Text style={s.btnPrimaryText}>{loading?'Booking…':(repeat?`Confirm ${repeat.count}-visit series`:'Confirm booking')}</Text>
            </TouchableOpacity>
          </>}

          {/* ── Done ───────────────────────────────────────────────── */}
          {step==='done' && (
            <View style={s.doneBox}>
              <View style={s.doneIcon}><Ionicons name="checkmark" size={36} color="#fff"/></View>
              <Text style={s.doneTitle}>You&apos;re booked!</Text>
              <Text style={s.doneSub}>Confirmation sent to {form.email || form.phone}</Text>
              <Text style={s.doneRef}>Ref #{bookedId.slice(-8).toUpperCase()}</Text>
              <TouchableOpacity style={[s.btnPrimary,{marginTop:24}]} onPress={reset} accessibilityRole="button" accessibilityLabel="Book another appointment">
                <Text style={s.btnPrimaryText}>Book another</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnGhost,{marginTop:4}]} onPress={()=>nav.goBack()} accessibilityRole="button" accessibilityLabel="Back to calendar">
                <Text style={s.btnGhostText}>Back to calendar</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={wlPrompt} animationType="slide" onRequestClose={()=>setWlPrompt(false)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setWlPrompt(false)} style={{marginRight:6}} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={GRAY_700}/>
            </TouchableOpacity>
            <Text style={s.headerTitle}>Join Waitlist</Text>
          </View>
          <ScrollView contentContainerStyle={s.listContent}>
            <Text style={ms.empty}>We&apos;ll notify you the moment a spot opens up.</Text>
            <TouchableOpacity style={[s.btnPrimary,{marginTop:16}]} disabled={wlSaving} accessibilityRole="button" accessibilityLabel="Notify me when a spot opens" onPress={async()=>{
              setWlSaving(true);
              try {
                await api(`/businesses/${bizId()}/waitlist`, { method:'POST', body: JSON.stringify({
                  name: form.name, email: form.email, phone: form.phone||undefined,
                  serviceId: selectedSvcs[0]?.id,
                  staffId: staff && staff !== 'any' ? staff.id : slot?.staffId,
                  desiredDate: slot?.startsAt ?? (date ? new Date(date + 'T00:00:00').toISOString() : undefined),
                  notes: slot?.startsAt ? `Preferred slot: ${slot.startsAt}` : undefined,
                })});
                setWlPrompt(false);
                Alert.alert("You're on the waitlist!", "We'll contact you when a spot opens.");
              } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not join.'); }
              finally { setWlSaving(false); }
            }}>
              <Text style={s.btnPrimaryText}>{wlSaving ? 'Joining…' : 'Notify me'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export { BookScreen };
