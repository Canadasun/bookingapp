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

function CheckoutScreen() {
  type Phase = 'amount'|'tap'|'done';
  const [phase, setPhase]     = useState<Phase>('amount');
  const [digits, setDigits]   = useState('');   // raw cents, e.g. "1234" = $12.34
  const [note, setNote]       = useState('');
  const [tipPct, setTipPct]   = useState(0);     // 0/15/18/20% of the entered amount
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<{ amountCents:number; ref:string; at:Date }|null>(null);

  const cents     = parseInt(digits || '0', 10);
  const tipCents  = Math.round(cents * tipPct / 100);
  const totalCents = cents + tipCents;
  const display   = (cents/100).toFixed(2);

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
        method:'POST', body: JSON.stringify({ amountCents: totalCents, tipCents: tipCents || undefined, description: note.trim() || undefined }),
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

  function reset(){ setPhase('amount'); setDigits(''); setNote(''); setTipPct(0); setReceipt(null); }

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

      {/* Tip presets — added on top of the entered amount */}
      {cents >= 50 && (
        <View style={co.tipRow}>
          <Text style={co.tipLabel}>Tip</Text>
          {[0,15,18,20].map(p => (
            <TouchableOpacity key={p} onPress={()=>setTipPct(p)}
              style={[co.tipChip, tipPct===p && co.tipChipOn]}>
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
        activeOpacity={0.85}>
        {loading
          ? <ActivityIndicator color="#fff"/>
          : <Text style={co.chargeBtnText}>Charge ${(totalCents/100).toFixed(2)}</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

export { CheckoutScreen };
