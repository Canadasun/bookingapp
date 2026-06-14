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
import { useStripe } from '@stripe/stripe-react-native';

function CheckoutScreen() {
  type Phase = 'amount'|'done';
  const [phase, setPhase]     = useState<Phase>('amount');
  const [digits, setDigits]   = useState('');   // raw cents, e.g. "1234" = $12.34
  const [note, setNote]       = useState('');
  const [tipPct, setTipPct]   = useState(0);     // 0/15/18/20% of the entered amount
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<{ amountCents:number; ref:string; at:Date }|null>(null);
  const chargeKey = useRef<string|null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteModalText, setNoteModalText] = useState('');

  const cents     = parseInt(digits || '0', 10);
  const tipCents  = Math.round(cents * tipPct / 100);
  const totalCents = cents + tipCents;
  const display   = (cents/100).toFixed(2);

  // Hardware back steps the flow back instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase==='done') { reset(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [phase]);

  function pressDigit(d:string){ chargeKey.current = null; setDigits(p => (p + d).replace(/^0+/, '').slice(0, 7)); } // up to $99,999.99
  function back(){ chargeKey.current = null; setDigits(p => p.slice(0, -1)); }

  async function charge() {
    if (cents < 50) { Alert.alert('Amount too low', 'Enter at least $0.50.'); return; }
    chargeKey.current ??= `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLoading(true);
    try {
      const payment = await api<{ paymentIntentId:string; clientSecret:string; amountCents:number; publishableKey:string }>(`/payments/charge`, {
        method:'POST',
        body: JSON.stringify({
          amountCents: totalCents,
          tipCents: tipCents || undefined,
          description: note.trim() || undefined,
          idempotencyKey: chargeKey.current,
        }),
      });
      if (!payment.clientSecret) throw new Error('Stripe did not return a payment session.');
      const initialized = await initPaymentSheet({
        merchantDisplayName: 'Pulse',
        paymentIntentClientSecret: payment.clientSecret,
        returnURL: 'pulseappointments://stripe-redirect',
        allowsDelayedPaymentMethods: false,
      });
      if (initialized.error) throw new Error(initialized.error.message);
      const presented = await presentPaymentSheet();
      if (presented.error) {
        if (presented.error.code === 'Canceled') { chargeKey.current = null; return; }
        throw new Error(presented.error.message);
      }
      setReceipt({ amountCents: payment.amountCents, ref: payment.paymentIntentId, at: new Date() });
      chargeKey.current = null;
      setPhase('done');
    } catch(e){ Alert.alert('Checkout failed', e instanceof Error ? e.message : 'Please try again'); }
    finally { setLoading(false); }
  }

  function reset(){ setPhase('amount'); setDigits(''); setNote(''); setTipPct(0); setReceipt(null); chargeKey.current = null; }

  // ── Receipt ──
  if (phase === 'done' && receipt) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={co.receiptWrap}>
          <View style={co.receiptCheck}><Ionicons name="checkmark" size={40} color="#fff"/></View>
          <Text style={co.receiptAmount}>${(receipt.amountCents/100).toFixed(2)}</Text>
          <Text style={co.receiptPaid} accessibilityLiveRegion="polite">Payment received</Text>

          <View style={co.receiptCard}>
            {[
              { l:'Method', v:'Stripe card payment' },
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

          <TouchableOpacity style={[s.btnPrimary,{ marginTop:24, alignSelf:'stretch' }]} onPress={reset}
            accessibilityRole="button" accessibilityLabel="New sale">
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
            <TouchableOpacity key={k} style={co.key} accessibilityRole="button" accessibilityLabel="Add a note" onPress={()=>{
              if (Platform.OS === 'ios') {
                Alert.prompt?.('Add a note', 'What is this charge for?', (t)=>{ chargeKey.current = null; setNote((t||'').slice(0,80)); }, 'plain-text', note);
              } else {
                setNoteModalText(note);
                setShowNoteModal(true);
              }
            }}>
              <Ionicons name="create-outline" size={22} color={GRAY_500}/>
            </TouchableOpacity>
          );
          if (k==='back') return (
            <TouchableOpacity key={k} style={co.key} onPress={back} onLongPress={()=>setDigits('')}
              accessibilityRole="button" accessibilityLabel="Delete last digit">
              <Ionicons name="backspace-outline" size={24} color={GRAY_700}/>
            </TouchableOpacity>
          );
          return (
            <TouchableOpacity key={k} style={co.key} onPress={()=>pressDigit(k)} activeOpacity={0.6}
              accessibilityRole="button" accessibilityLabel={`${k}`}>
              <Text style={co.keyText}>{k}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tip presets — added on top of the entered amount */}
      {cents >= 50 && (
        <View style={co.tipRow}>
          <Text style={co.tipLabel}>Tip</Text>
          {[0,15,18,20].map(p => (
            <TouchableOpacity key={p} onPress={()=>{ chargeKey.current = null; setTipPct(p); }}
              style={[co.tipChip, tipPct===p && co.tipChipOn]}
              accessibilityRole="button"
              accessibilityLabel={p===0?'No tip':`${p}% tip`}
              accessibilityState={{ selected: tipPct===p }}>
              <Text style={[co.tipChipText, tipPct===p && { color:'#fff' }]}>{p===0?'None':`${p}%`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {tipPct>0 && cents>=50 && (
        <Text style={co.tipSummary}>Tip ${(tipCents/100).toFixed(2)} · Total ${(totalCents/100).toFixed(2)}</Text>
      )}

      <TouchableOpacity
        style={[co.chargeBtn, (cents<50||loading) && { opacity:0.4 }]}
        disabled={cents<50||loading}
        onPress={charge}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Charge payment">
        {loading
          ? <ActivityIndicator color="#fff"/>
          : <Text style={co.chargeBtnText}>Charge ${(totalCents/100).toFixed(2)}</Text>}
      </TouchableOpacity>
      {/* Android note input — Alert.prompt is iOS-only */}
      <Modal visible={showNoteModal} transparent animationType="fade" onRequestClose={() => setShowNoteModal(false)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:20 }}>
            <Text style={{ fontSize:16, fontWeight:'600', color:GRAY_900, marginBottom:8 }}>Add a note</Text>
            <Text style={{ fontSize:13, color:GRAY_500, marginBottom:12 }}>What is this charge for?</Text>
            <TextInput
              autoFocus style={{ borderWidth:1, borderColor:GRAY_200, borderRadius:8, padding:10, fontSize:14, color:GRAY_900 }}
              value={noteModalText} onChangeText={t => setNoteModalText(t.slice(0,80))}
              placeholder="e.g. Extra styling time" placeholderTextColor={GRAY_400} multiline={false} returnKeyType="done"
            />
            <View style={{ flexDirection:'row', gap:10, marginTop:16 }}>
              <TouchableOpacity style={{ flex:1, padding:12, borderRadius:8, borderWidth:1, borderColor:GRAY_200, alignItems:'center' }} onPress={() => setShowNoteModal(false)}>
                <Text style={{ color:GRAY_700 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex:1, padding:12, borderRadius:8, backgroundColor:BRAND, alignItems:'center' }} onPress={() => { setNote(noteModalText); setShowNoteModal(false); }}>
                <Text style={{ color:'#fff', fontWeight:'600' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export { CheckoutScreen };
