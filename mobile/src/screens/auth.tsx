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
        method:'POST', body:JSON.stringify({email,password,platform:'mobile'}),
      });
      if (res.twoFactorRequired && res.challengeId) {
        setChallenge({ id: res.challengeId, method: res.method ?? 'EMAIL' });
        return;
      }
      onLogin(res.accessToken!, res.refreshToken!, res.user!);
    } catch(err) {
      const msg = err instanceof Error ? err.message : '';
      Alert.alert('Sign in failed', msg || 'Check your email and password and try again.');
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
          consentVersion: '2026-06-08',
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
          <TextInput style={s.input} placeholder="+1 (416) 555-0123" placeholderTextColor={GRAY_400}
            keyboardType="phone-pad" value={phone} onChangeText={text=>setPhone(formatPhoneInput(text))}
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

export { LoginScreen, ForgotPasswordScreen, RegisterScreen, ChangePasswordScreen, ClientPortalScreen };
