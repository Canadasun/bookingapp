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
import { fmtTime, fmtDur, normalizePhoneClient } from '../format';
import { setAuth, getAuth, bizId, listeners, persistAuth, loadPersistedAuth, refreshSession } from '../auth';
import { api, registerPushNotifications } from '../api';
import { s, cal, co, ms, dst } from '../styles';
import { Pill, PriceTag, VerifiedPill } from '../components';

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

export { BookScreen };
