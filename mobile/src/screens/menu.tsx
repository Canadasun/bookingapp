// Extracted from App.tsx (Phase 0b). Behavior unchanged.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, SectionList,
  ActivityIndicator, Alert, SafeAreaView, Platform, Modal, StatusBar,
  KeyboardAvoidingView, RefreshControl, BackHandler, Linking, Switch, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as SecureStore from 'expo-secure-store';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WEB_URL, API_BASE, BIZ_ID, uploadUri } from '../config';
import { BRAND, BRAND_LT, GRAY_50, GRAY_100, GRAY_200, GRAY_400, GRAY_500, GRAY_700, GRAY_900, STATUS_COLOR } from '../theme';
import type { User, Appointment, ServiceCategory, Service, AvailabilityRule, Staff, Slot, BookingSlot, Client, Message, NotificationItem, NotificationDelivery, TaskItem, ServiceDueItem, ClientPortalAppointment, ClientPortalMessageThread, ClientPortalOffer, Resource, Location } from '../types';
import { fmtTime, fmtDur, normalizePhoneClient, formatPhoneInput, formatPhoneDisplay } from '../format';
import { setAuth, getAuth, bizId, listeners, persistAuth, loadPersistedAuth, refreshSession, isBiometricEnabled, setBiometricEnabled, biometricCapability, authenticateBiometric } from '../auth';
import { api, registerPushNotifications } from '../api';
import { s, cal, co, ms, dst } from '../styles';
import { Pill, PriceTag, VerifiedPill, SwipeToDelete } from '../components';

type ConnectStatus = { onboarded: boolean; chargesEnabled: boolean; accountId: string | null; available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] };
type MoreView = 'menu' | 'services' | 'staff' | 'offers' | 'waitlist' | 'reviews' | 'invoices'
  | 'marketing' | 'giftcards' | 'packages' | 'settings'
  | 'booking' | 'notifications' | 'reports' | 'addons' | 'subscriptions' | 'transactions' | 'tasks' | 'followups' | 'resources' | 'locations'
  | 'promo-codes' | 'memberships' | 'hours' | 'payouts' | 'soon';

// Plan tiers mirror the web billing page.
const PLANS = [
  { id:'FREE',      name:'Free',      price:'$0',  period:'/mo', features:['Unlimited bookings','Client management','Email confirmations','Public booking page','Up to 5 staff members','1 location'] },
  { id:'BASIC',     name:'Basic',     price:'$10', period:'/mo', features:['Everything in Free','Receive & reply to client SMS','Email reminders (24h)','Deposit collection','Cancellation policies','Manual charges','Up to 10 staff members'] },
  { id:'PRO',       name:'Pro',       price:'$20', period:'/mo', features:['Everything in Basic','Initiate SMS to clients','SMS confirmations & 2h reminders','Automatic no-show fees','Late-cancellation fees','Analytics & reports','Up to 10 staff members'] },
  { id:'UNLIMITED', name:'Unlimited', price:'$80', period:'/mo', features:['Everything in Pro','Unlimited locations','Full SMS across all locations','Remove Pulse branding','Unlimited staff accounts','Dedicated support','Early access to new features'] },
] as const;

import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import QRCode from 'react-native-qrcode-svg';

function MenuScreen({ onLogout }: { onLogout:()=>void }) {
  const [renderedAt] = useState(() => Date.now());
  const { user } = getAuth();
  const nav = useNavigation<any>();
  // Which drill-in this screen shows is driven by the navigation route param, so
  // each one is a real pushed screen (native transition + swipe-back). The tab's
  // root screen (MenuHome) has no param → the menu list.
  const route = useRoute<any>();
  const view: MoreView = route.params?.view ?? 'menu';
  const soonLabel: string = route.params?.soonLabel ?? '';
  const [services, setServices] = useState<Service[] | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[] | null>(null);
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
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [invoiceEditor, setInvoiceEditor] = useState<{ items:Array<{description:string;quantity:string;unit:string}>; notes:string }|null>(null);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[] | null>(null);
  const [biz, setBiz]           = useState<any | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  // Pick and upload business logo
  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLogoBusy(true);
      try {
        const uri = result.assets[0].uri;
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'logo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;

        formData.append('file', { uri, name: filename, type } as any);
        formData.append('kind', 'LOGO');

        const upload = await api<{ url: string }>('/uploads', {
          method: 'POST',
          body: formData,
        });

        const updated = await api<any>(`/businesses/${bizId()}`, {
          method: 'PATCH',
          body: JSON.stringify({ logoUrl: upload.url }),
        });
        setBiz(updated);
        Alert.alert('Logo updated', 'Your business logo has been updated.');
      } catch (e) {
        Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload logo.');
      } finally {
        setLogoBusy(false);
      }
    }
  }
  const [serviceEditor, setServiceEditor] = useState<{ id?:string; name:string; durationMinutes:string; price:string; active:boolean; capacity:string; priceType:'FLAT'|'PER_HOUR'|'STARTING_AT' }|null>(null);
  const [preferredPriceType, setPreferredPriceType] = useState<'FLAT'|'PER_HOUR'|'STARTING_AT'>('FLAT');
  const [offerEditor, setOfferEditor] = useState<{ id?:string; title:string; description:string; discount:string; expiresAt:string }|null>(null);
  const [giftMode, setGiftMode] = useState<null|'issue'|'redeem'>(null);
  const [giftIssue, setGiftIssue] = useState({ amount:'50', recipientName:'', recipientEmail:'', message:'' });
  const [giftRedeem, setGiftRedeem] = useState({ code:'', amount:'' });
  const [packageTab, setPackageTab] = useState<'products'|'issued'>('products');
  const [packageEditor, setPackageEditor] = useState<{ name:string; serviceId:string; credits:string; price:string }|null>(null);
  const [packageIssue, setPackageIssue] = useState<{ client:Client|null; search:string; packageId:string; results:Client[] }|null>(null);
  const [campaignEditor, setCampaignEditor] = useState<{ name:string; channel:'EMAIL'|'SMS'; audience:'ALL'|'RECENT'|'LAPSED'; subject:string; body:string; count:number|null }|null>(null);
  const [taskEditor, setTaskEditor] = useState<{ title:string; staffId:string; dueAt:string; notes:string }|null>(null);
  const [settingsEditor, setSettingsEditor] = useState<{ name:string; email:string; phone:string; address:string; minNoticeMinutes:string; maxAdvanceDays:string; cancellationWindowHours:string; requireDeposit:boolean; depositPercent:string; cancellationPolicy:string }|null>(null);
  const [timeOffEditor, setTimeOffEditor] = useState<{ staffId:string; name:string; startsAt:string; endsAt:string; reason:string }|null>(null);
  const [staffServiceEditor, setStaffServiceEditor] = useState<{ staffId:string; name:string; serviceIds:string[] }|null>(null);
  const [staffLocationEditor, setStaffLocationEditor] = useState<{ staffId:string; name:string; locationId:string }>();
  const [followupBusy, setFollowupBusy] = useState<string|null>(null);
  const [followupSnoozing, setFollowupSnoozing] = useState<string|null>(null);
  const [resources, setResources] = useState<Resource[]|null>(null);
  const [resourceEditor, setResourceEditor] = useState<{ id?:string; name:string }|null>(null);
  const [resourceSaving, setResourceSaving] = useState(false);
  const [locations, setLocations] = useState<Location[]|null>(null);
  const [locationEditor, setLocationEditor] = useState<{ id?:string; name:string; address:string; phone:string; timezone:string; active:boolean }|null>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [promoCodes, setPromoCodes] = useState<any[]|null>(null);
  const [promoEditor, setPromoEditor] = useState<{ id?:string; code:string; discountType:'PERCENT'|'FLAT'; discountValue:string; maxUsages:string; expiresAt:string }|null>(null);
  const [membershipPlans, setMembershipPlans] = useState<any[]|null>(null);
  const [membershipMembers, setMembershipMembers] = useState<any[]|null>(null);
  const [membershipPlanEditor, setMembershipPlanEditor] = useState<{ id?:string; name:string; priceMonthly:string; description:string }|null>(null);
  const [membershipPlanSaving, setMembershipPlanSaving] = useState(false);
  const [staffInviteEditor, setStaffInviteEditor] = useState<{ name:string; email:string }|null>(null);
  const [staffInviteSaving, setStaffInviteSaving] = useState(false);
  const [staffInviteResult, setStaffInviteResult] = useState<{ email:string; tempPassword:string }|null>(null);
  const [changePwEditor, setChangePwEditor] = useState<{ current:string; next:string; confirm:string }|null>(null);
  const [changePwSaving, setChangePwSaving] = useState(false);
  const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const [hourRules, setHourRules] = useState<Array<{ dayOfWeek:number; startTime:string; endTime:string; enabled:boolean }>>(
    [0,1,2,3,4,5,6].map(d=>({ dayOfWeek:d, startTime:'09:00', endTime:'17:00', enabled: d>=1&&d<=5 }))
  );
  const [closures, setClosures] = useState<Array<{ id:string; startsAt:string; endsAt:string; reason?:string }>>([]);
  const [hoursLoaded, setHoursLoaded] = useState(false);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [closureForm, setClosureForm] = useState({ startsAt:'', endsAt:'', reason:'' });
  const [closureSaving, setClosureSaving] = useState(false);
  const [availabilityEditor, setAvailabilityEditor] = useState<{
    staffId:string;
    name:string;
    days:Array<{ dayOfWeek:number; enabled:boolean; startTime:string; endTime:string }>;
  }|null>(null);
  // Two-factor sign-in (seeded from the session, updated optimistically).
  const [twoFA, setTwoFA]       = useState<boolean>(getAuth().user?.twoFactorEnabled ?? false);
  const [twoFAMethod, setTwoFAMethod] = useState<'EMAIL'|'SMS'>(getAuth().user?.twoFactorMethod ?? 'EMAIL');
  const [twoFASaving, setTwoFASaving] = useState(false);
  // Biometric app-lock (Face ID / Touch ID) — only surfaced when the device supports it.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Face ID');
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioSaving, setBioSaving] = useState(false);
  useEffect(() => { (async () => {
    const cap = await biometricCapability();
    setBioAvailable(cap.available); setBioLabel(cap.label);
    setBioEnabled(await isBiometricEnabled());
  })(); }, []);

  // Toggle the biometric lock. Turning it on requires passing the prompt once, so
  // we never enable a lock the user can't actually clear.
  async function toggleBiometric(next: boolean) {
    setBioSaving(true);
    try {
      if (next) {
        const ok = await authenticateBiometric(`Enable ${bioLabel} unlock`);
        if (!ok) { Alert.alert(`${bioLabel} not enabled`, 'Authentication was cancelled or failed.'); return; }
      }
      await setBiometricEnabled(next);
      setBioEnabled(next);
    } finally { setBioSaving(false); }
  }
  const [recoveryCodes, setRecoveryCodes] = useState<string[]|null>(null); // shown once on enable
  const [twoFaPwModal, setTwoFaPwModal] = useState<{enabled:boolean;method:'EMAIL'|'SMS'}|null>(null);
  const [twoFaPwText, setTwoFaPwText] = useState('');
  const [acctBusy, setAcctBusy] = useState(false);
  // Google Calendar sync status (loaded when settings view opens)
  const [calSyncStatus, setCalSyncStatus] = useState<{connected:boolean;email:string|null;since:string|null}|null>(null);
  const [calSyncBusy, setCalSyncBusy] = useState(false);
  // User profile editor
  const [profileEditor, setProfileEditor] = useState<{name:string;phone:string}|null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  // Verification submission
  const [verifStatus, setVerifStatus] = useState<string|null>(null);
  const [verifEditor, setVerifEditor] = useState<{legalName:string;address:string;phone:string;govIdUrl:string;regDocUrl:string}|null>(null);
  const [verifSaving, setVerifSaving] = useState(false);
  // Reports date-range filter
  const [reportRange, setReportRange] = useState<'week'|'month'|'all'>('all');

  useEffect(() => {
    if (view === 'settings') {
      api<{connected:boolean;email:string|null;since:string|null}>('/calendar-sync/google/status').then(setCalSyncStatus).catch(()=>{});
      api<{verificationStatus:string}>(`/businesses/${bizId()}/verification`).then(v=>setVerifStatus(v.verificationStatus)).catch(()=>{});
    }
  }, [view]);

  useEffect(() => {
    SecureStore.getItemAsync('bookingapp.preferred-price-type.v1')
      .then((value) => {
        if (value === 'FLAT' || value === 'PER_HOUR' || value === 'STARTING_AT') setPreferredPriceType(value);
      })
      .catch(() => {});
  }, []);

  async function saveTwoFA(enabled: boolean, method: 'EMAIL'|'SMS', currentPassword: string) {
    setTwoFASaving(true);
    const prev = { enabled: twoFA, method: twoFAMethod };
    setTwoFA(enabled); setTwoFAMethod(method);
    try {
      const res = await api<{ recoveryCodes?: string[]; user?: User }>('/auth/2fa', { method:'POST', body: JSON.stringify({ enabled, method, currentPassword }) });
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

  async function saveProfile() {
    if (!profileEditor) return;
    setProfileSaving(true);
    try {
      const updated = await api<User>('/users/me', { method:'PATCH', body: JSON.stringify({ name: profileEditor.name.trim(), phone: profileEditor.phone.trim() || undefined }) });
      setAuth(getAuth().token, updated, getAuth().refresh);
      await persistAuth();
      setProfileEditor(null);
    } catch(e) { Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setProfileSaving(false); }
  }

  async function pickVerifDoc(field: 'govIdUrl'|'regDocUrl') {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      try {
        const { uri } = result.assets[0];
        const filename = uri.split('/').pop() || 'doc.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image';
        const formData = new FormData();
        formData.append('file', { uri, name: filename, type } as any);
        formData.append('kind', 'OTHER');
        const upload = await api<{url:string}>('/uploads', { method:'POST', body: formData });
        setVerifEditor(prev => prev ? { ...prev, [field]: upload.url } : prev);
      } catch(e) { Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload.'); }
    }
  }

  async function submitVerification() {
    if (!verifEditor) return;
    const { legalName, address, phone, govIdUrl, regDocUrl } = verifEditor;
    if (!legalName.trim() || !address.trim() || !phone.trim()) { Alert.alert('Missing fields', 'Please fill in all required fields.'); return; }
    if (!govIdUrl || !regDocUrl) { Alert.alert('Documents required', 'Please upload both required documents.'); return; }
    setVerifSaving(true);
    try {
      await api(`/businesses/${bizId()}/verification`, { method:'POST', body: JSON.stringify({ legalName: legalName.trim(), address: address.trim(), phone: phone.trim(), governmentIdUrl: govIdUrl, registrationDocUrl: regDocUrl }) });
      setVerifStatus('PENDING');
      setVerifEditor(null);
      Alert.alert('Submitted', 'Your verification request has been submitted and will be reviewed within 1–2 business days.');
    } catch(e) { Alert.alert('Submission failed', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setVerifSaving(false); }
  }

  function requestTwoFA(enabled: boolean, method: 'EMAIL'|'SMS') {
    if (Platform.OS === 'ios') {
      Alert.prompt?.(
        enabled ? 'Enable two-factor sign-in' : 'Disable two-factor sign-in',
        'Enter your current password to confirm.',
        (pw) => { if (pw?.trim()) saveTwoFA(enabled, method, pw.trim()); },
        'secure-text',
      );
    } else {
      setTwoFaPwText('');
      setTwoFaPwModal({ enabled, method });
    }
  }

  // Account lifecycle (owner): pause/reactivate (reversible) + permanent delete.
  async function toggleActive() {
    if (!biz) return;
    setAcctBusy(true);
    try {
      const path = biz.suspended ? 'reactivate' : 'deactivate';
      const updated = await api<any>(`/businesses/${bizId()}/${path}`, { method:'POST' });
      setBiz(updated);
      Alert.alert(
        updated.suspended ? 'Business paused' : 'Business reactivated',
        updated.suspended ? 'Your booking page is hidden — reactivate any time.' : 'Your business is live again.',
      );
    } catch (e) { Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setAcctBusy(false); }
  }
  function confirmDelete() {
    if (!biz) return;
    Alert.alert(
      'Delete this business?',
      `This permanently erases ${biz.name} and ALL its data — clients, bookings, staff, services, payments and your login. This cannot be undone.`,
      [
        { text:'Cancel', style:'cancel' },
        { text:'Delete forever', style:'destructive', onPress: async () => {
          setAcctBusy(true);
          try {
            await api(`/businesses/${bizId()}`, { method:'DELETE', body: JSON.stringify({ confirmation: biz.name }) });
            onLogout();
          } catch (e) { setAcctBusy(false); Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.'); }
        }},
      ],
    );
  }

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
        capacity: Math.max(1, Number.parseInt(serviceEditor.capacity || '1', 10) || 1),
        priceType: serviceEditor.priceType,
      };
      if (serviceEditor.id) await api(`/businesses/${bizId()}/services/${serviceEditor.id}`, { method:'PATCH', body: JSON.stringify(payload) });
      else await api(`/businesses/${bizId()}/services`, { method:'POST', body: JSON.stringify(payload) });
      setPreferredPriceType(serviceEditor.priceType);
      await SecureStore.setItemAsync('bookingapp.preferred-price-type.v1', serviceEditor.priceType).catch(() => {});
      setServices(await api<Service[]>(`/businesses/${bizId()}/services`));
      setServiceEditor(null);
    } catch(e) {
      Alert.alert('Could not save service', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function setNotificationPreference(key: string, enabled: boolean) {
    if (!biz) return;
    const previous = biz.notificationSettings ?? {};
    const notificationSettings = { ...previous, [key]: enabled };
    setBiz({ ...biz, notificationSettings });
    try {
      const updated = await api<any>(`/businesses/${bizId()}`, {
        method:'PATCH',
        body: JSON.stringify({ notificationSettings }),
      });
      setBiz(updated);
    } catch (e) {
      setBiz({ ...biz, notificationSettings: previous });
      Alert.alert('Could not update notifications', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  // Swipe-to-delete a service. The API refuses to delete a service with booking
  // history (to keep records intact) — surface that and suggest deactivating.
  function deleteService(sv: Service) {
    Alert.alert('Delete service?', `Delete "${sv.name}"? This can't be undone.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/services/${sv.id}`, { method:'DELETE' });
          setServices(prev => (prev ?? []).filter(x => x.id !== sv.id));
        } catch(e) {
          Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  // Swipe-to-delete a category. The API keeps its services and just clears their
  // category (categoryId → null), so nothing breaks and they stay bookable.
  function deleteCategory(cat: ServiceCategory) {
    Alert.alert('Delete category?', `Delete "${cat.name}"? Its services are kept and become uncategorized.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/service-categories/${cat.id}`, { method:'DELETE' });
          setCategories(prev => (prev ?? []).filter(x => x.id !== cat.id));
          setServices(prev => (prev ?? []).map(x => x.categoryId === cat.id ? { ...x, categoryId:null, category:null } : x));
        } catch(e) {
          Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  async function saveInvoice() {
    if (!invoiceEditor) return;
    const lineItems = invoiceEditor.items
      .map(it => ({ description: it.description.trim(), quantity: Math.max(1, Number.parseInt(it.quantity || '1', 10) || 1), unitCents: Math.round((Number.parseFloat(it.unit || '0') || 0) * 100) }))
      .filter(it => it.description && it.unitCents >= 0);
    if (!lineItems.length) { Alert.alert('Add a line item', 'An invoice needs at least one line with a description and amount.'); return; }
    try {
      await api(`/businesses/${bizId()}/invoices`, { method:'POST', body: JSON.stringify({ lineItems, notes: invoiceEditor.notes.trim() || undefined }) });
      setInvoices(await api<any[]>(`/businesses/${bizId()}/invoices`));
      setInvoiceEditor(null);
    } catch(e) { Alert.alert('Could not create invoice', e instanceof Error ? e.message : 'Please try again.'); }
  }
  async function setInvoiceStatus(id:string, status:string) {
    try {
      await api(`/businesses/${bizId()}/invoices/${id}/status`, { method:'PATCH', body: JSON.stringify({ status }) });
      setInvoices(await api<any[]>(`/businesses/${bizId()}/invoices`));
    } catch(e){ Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again.'); }
  }
  function deleteInvoice(id:string) {
    Alert.alert('Delete invoice?', 'This permanently removes the invoice.', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try { await api(`/businesses/${bizId()}/invoices/${id}`, { method:'DELETE' }); setInvoices(await api<any[]>(`/businesses/${bizId()}/invoices`)); }
        catch(e){ Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.'); }
      }},
    ]);
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
        cancellationPolicy: settingsEditor.cancellationPolicy.trim() || undefined,
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

  async function saveStaffLocation() {
    if (!staffLocationEditor) return;
    try {
      await api(`/businesses/${bizId()}/staff/${staffLocationEditor.staffId}`, {
        method:'PATCH',
        body: JSON.stringify({ locationId: staffLocationEditor.locationId || null }),
      });
      setStaff(await api<Staff[]>(`/businesses/${bizId()}/staff/all`));
      setStaffLocationEditor(undefined);
      Alert.alert('Saved', 'Location was updated.');
    } catch(e) {
      Alert.alert('Could not save location', e instanceof Error ? e.message : 'Please try again.');
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

  // Open a drill-in by pushing a new MenuDetail screen (works from the menu list
  // AND from nested drill-ins like Add-ons → Gift cards, so back pops one level).
  function open(v: MoreView) { nav.push('MenuDetail', { view: v }); }

  // Load the data this drill-in needs, once, when its screen mounts.
  async function loadView(v: MoreView) {
    try {
      if (v === 'services' && !services) {
        setLoading(true);
        const [svc, cats] = await Promise.all([
          api<Service[]>(`/businesses/${bizId()}/services`),
          api<ServiceCategory[]>(`/businesses/${bizId()}/service-categories`).catch(() => [] as ServiceCategory[]),
        ]);
        setServices(svc);
        setCategories(cats);
      }
      else if (v === 'staff' && (!staff || !services))  {
        setLoading(true);
        const [staffRows, serviceRows, locationRows] = await Promise.all([
          api<Staff[]>(`/businesses/${bizId()}/staff/all`),
          api<Service[]>(`/businesses/${bizId()}/services`),
          api<Location[]>(`/businesses/${bizId()}/locations`).catch(() => [] as Location[]),
        ]);
        setStaff(staffRows);
        setServices(serviceRows);
        setLocations(locationRows);
      }
      else if (v === 'offers' && !offers){ setLoading(true); setOffers(await api<any[]>(`/businesses/${bizId()}/offers`)); }
      else if (v === 'waitlist' && !waitlist){ setLoading(true); setWaitlist(await api<any[]>(`/businesses/${bizId()}/waitlist`)); }
      else if (v === 'reviews'){ setLoading(true); setReviews(await api<any[]>(`/businesses/${bizId()}/reviews/all`)); }
      else if (v === 'marketing' && !campaigns){ setLoading(true); setCampaigns(await api<any[]>(`/businesses/${bizId()}/campaigns`)); }
      else if (v === 'giftcards' && !giftcards){ setLoading(true); setGiftcards(await api<any[]>(`/businesses/${bizId()}/gift-cards`)); }
      else if (v === 'packages' && (!packages || !issuedPackages)){ setLoading(true); await loadPackages(); }
      else if (v === 'tasks' && !tasks){ setLoading(true); await loadTasks(); }
      else if (v === 'followups' && !followups){ setLoading(true); await loadFollowups(); }
      else if ((v === 'settings' || v === 'booking') && !biz) { setLoading(true); setBiz(await api<any>(`/businesses/${bizId()}`)); }
      else if (v === 'subscriptions') { setLoading(true); setBiz(await api<any>(`/businesses/${bizId()}`)); }
      else if (v === 'notifications') {
        setLoading(true);
        const [bizResult, deliveriesResult] = await Promise.allSettled([
          !biz ? api<any>(`/businesses/${bizId()}`) : Promise.resolve(biz),
          !deliveries ? api<NotificationDelivery[]>(`/notifications/deliveries?limit=50`) : Promise.resolve(deliveries),
        ]);
        if (!biz && bizResult.status === 'fulfilled') setBiz(bizResult.value);
        if (!deliveries && deliveriesResult.status === 'fulfilled') setDeliveries(deliveriesResult.value);
        else if (deliveriesResult.status === 'rejected') Alert.alert('Could not load deliveries', deliveriesResult.reason instanceof Error ? deliveriesResult.reason.message : 'Please try again.');
      }
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
      else if (v === 'payouts') { setLoading(true); setConnectStatus(await api<ConnectStatus>(`/payments/connect/status`)); }
      else if (v === 'invoices' && !invoices) { setLoading(true); setInvoices(await api<any[]>(`/businesses/${bizId()}/invoices`)); }
      else if (v === 'resources') { setLoading(true); setResources(await api<Resource[]>(`/businesses/${bizId()}/resources`)); }
      else if (v === 'locations') { setLoading(true); setLocations(await api<Location[]>(`/businesses/${bizId()}/locations`)); }
      else if (v === 'hours') {
        setLoading(true);
        const data = await api<{ hours: any[]; closures: any[] }>(`/businesses/${bizId()}/hours`);
        if (data.hours.length > 0) {
          setHourRules([0,1,2,3,4,5,6].map(d => {
            const h = data.hours.find((x:any) => x.dayOfWeek === d);
            return { dayOfWeek:d, startTime:h?.startTime??'09:00', endTime:h?.endTime??'17:00', enabled:!!h };
          }));
        }
        setClosures(data.closures);
        setHoursLoaded(true);
      }
      else if (v === 'promo-codes') { setLoading(true); setPromoCodes(await api<any[]>(`/businesses/${bizId()}/promo-codes`)); }
      else if (v === 'memberships') {
        setLoading(true);
        const [plans, members] = await Promise.all([
          api<any[]>(`/businesses/${bizId()}/memberships/plans`),
          api<any[]>(`/businesses/${bizId()}/memberships/members`),
        ]);
        setMembershipPlans(plans); setMembershipMembers(members);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => {
    if (view === 'menu') return;
    const timer = setTimeout(() => loadView(view), 0);
    return () => clearTimeout(timer);
  }, []);

  const head = (title: string) => (
    <View style={[s.header, view!=='menu' && { flexDirection:'row', alignItems:'center' }]}>
      {view !== 'menu' && (
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
          accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
      )}
      <Text style={s.headerTitle}>{title}</Text>
    </View>
  );
  const loader = <View style={{ padding:40, alignItems:'center' }}><ActivityIndicator color={BRAND}/></View>;

  if (view === 'services') return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
          accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Services</Text>
        <TouchableOpacity onPress={()=>setServiceEditor({ name:'', durationMinutes:'30', price:'0.00', active:true, capacity:'1', priceType:preferredPriceType })}
          accessibilityRole="button" accessibilityLabel="Add new service">
          <Ionicons name="add" size={24} color={BRAND}/>
        </TouchableOpacity>
      </View>
      {loading ? loader : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {!!(categories && categories.length) && (
            <>
              <Text style={[ms.cardLabel,{ marginBottom:6, marginLeft:2 }]}>CATEGORIES</Text>
              {categories.map(cat => (
                <SwipeToDelete key={cat.id} onDelete={()=>deleteCategory(cat)}>
                  <View style={ms.row}>
                    <View style={[ms.dot,{ backgroundColor: cat.color || BRAND }]}/>
                    <Text style={[ms.rowTitle,{ flex:1 }]} numberOfLines={1}>{cat.name}</Text>
                  </View>
                </SwipeToDelete>
              ))}
              <Text style={[ms.cardLabel,{ marginTop:8, marginBottom:6, marginLeft:2 }]}>SERVICES</Text>
            </>
          )}
          {(services ?? []).map(sv => (
            <SwipeToDelete key={sv.id} onDelete={()=>deleteService(sv)}>
              <TouchableOpacity style={ms.row} onPress={()=>setServiceEditor({
                id: sv.id,
                name: sv.name,
                durationMinutes: String(sv.durationMinutes),
                price: (sv.priceCents / 100).toFixed(2),
                active: sv.active,
                capacity: String(sv.capacity ?? 1),
                priceType: (sv.priceType as any) ?? 'FLAT',
              })}
              accessibilityRole="button" accessibilityLabel={`Edit ${sv.name}`}>
                <View style={[ms.dot,{ backgroundColor: sv.color || BRAND }]}/>
                <View style={{ flex:1 }}>
                  <Text style={ms.rowTitle}>{sv.name}</Text>
                  <Text style={ms.rowMeta}>{sv.durationMinutes} min{(sv.capacity ?? 1) > 1 ? ` · group of ${sv.capacity}` : ''}{sv.active ? '' : ' · inactive'}</Text>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <PriceTag cents={sv.priceCents}/>
                  {sv.priceType==='PER_HOUR' && <Text style={{ fontSize:10, color:GRAY_400, marginTop:1 }}>/hr</Text>}
                  {sv.priceType==='STARTING_AT' && <Text style={{ fontSize:10, color:GRAY_400, marginTop:1 }}>starting</Text>}
                </View>
              </TouchableOpacity>
            </SwipeToDelete>
          ))}
          {services && services.length===0 && <Text style={ms.empty}>No services yet.</Text>}
          {!!(services && services.length) && <Text style={[ms.empty,{ marginTop:4 }]}>Swipe a row left to delete. Create categories on the web dashboard.</Text>}
        </ScrollView>
      )}
      <Modal visible={!!serviceEditor} animationType="slide" onRequestClose={()=>setServiceEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setServiceEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
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
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Pricing</Text>
              <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
                {([['FLAT','Flat rate'],['PER_HOUR','Per hour'],['STARTING_AT','Starting at']] as const).map(([val,label])=>{
                  const on = serviceEditor.priceType===val;
                  return (
                    <TouchableOpacity key={val} onPress={()=>setServiceEditor({...serviceEditor, priceType:val})}
                      style={[s.slotBtn, on && s.slotBtnActive, { flex:1, alignItems:'center' }]}
                      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}>
                      <Text style={[s.slotText, on && s.slotTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={s.fieldLabel}>{serviceEditor.priceType==='PER_HOUR'?'Hourly rate':serviceEditor.priceType==='STARTING_AT'?'Starting price':'Price'}</Text>
              <TextInput style={s.input} value={serviceEditor.price} keyboardType="decimal-pad" onChangeText={price=>setServiceEditor({...serviceEditor,price})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Group capacity</Text>
              <TextInput style={s.input} value={serviceEditor.capacity} keyboardType="number-pad"
                onChangeText={capacity=>setServiceEditor({...serviceEditor,capacity})}/>
              <Text style={s.fieldHint}>How many clients can book the same time slot. 1 = one-on-one; higher = a group class.</Text>
              <View style={[ms.card,{ marginTop:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}>
                <Text style={ms.rowTitle}>Active</Text>
                <Switch value={serviceEditor.active} onValueChange={active=>setServiceEditor({...serviceEditor,active})} trackColor={{ true: BRAND, false: GRAY_200 }} thumbColor="#fff"/>
              </View>
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:14 }]} onPress={saveService}
                accessibilityRole="button" accessibilityLabel="Save service"><Text style={s.btnPrimaryText}>Save service</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'staff') return (
    <SafeAreaView style={s.screen}>
      {head('Team')}
      {loading ? loader : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(staff ?? []).map(st => (
            <View key={st.id} style={ms.card}>
              {/* Name + avatar get their own full-width row so the name is never
                  squeezed by the action buttons; actions sit on a second row. */}
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                {uploadUri(st.avatarUrl)
                  ? <Image source={{ uri: uploadUri(st.avatarUrl)! }} style={s.avatarImg} contentFit="cover"
                      accessible={true} accessibilityLabel={`${st.user.name} profile photo`}/>
                  : <View style={s.avatar}><Text style={{ color:BRAND, fontWeight:'700' }}>{st.user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</Text></View>}
                <View style={{ flex:1, minWidth:0 }}>
                  <Text style={ms.rowTitle} numberOfLines={1}>{st.user.name}</Text>
                  <Text style={ms.rowMeta} numberOfLines={1}>{st.bio || `${st.staffServices?.length ?? 0} services`}</Text>
                  {st.locationId && (locations ?? []).find(l => l.id === st.locationId) && (
                    <Text style={[ms.rowMeta,{ color:BRAND, marginTop:2 }]} numberOfLines={1}>
                      <Ionicons name="location-outline" size={11} color={BRAND}/>{' '}{(locations ?? []).find(l => l.id === st.locationId)?.name}
                    </Text>
                  )}
                </View>
              </View>
              <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                <TouchableOpacity style={[ms.smallAction,{ flex:1, alignItems:'center' }]} onPress={()=>setTimeOffEditor({
                  staffId: st.id,
                  name: st.user.name,
                  startsAt: '',
                  endsAt: '',
                  reason: '',
                })}
                  accessibilityRole="button" accessibilityLabel={`Add time off for ${st.user.name}`}>
                  <Text style={ms.smallActionText}>Time off</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.smallAction,{ flex:1, alignItems:'center' }]} onPress={()=>openAvailabilityEditor(st)}
                  accessibilityRole="button" accessibilityLabel={`Edit hours for ${st.user.name}`}>
                  <Text style={ms.smallActionText}>Hours</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.smallAction,{ flex:1, alignItems:'center' }]} onPress={()=>openStaffServices(st)}
                  accessibilityRole="button" accessibilityLabel={`Edit services for ${st.user.name}`}>
                  <Text style={ms.smallActionText}>Services</Text>
                </TouchableOpacity>
                {(locations ?? []).length > 0 && (
                  <TouchableOpacity style={[ms.smallAction,{ flex:1, alignItems:'center' }]} onPress={()=>setStaffLocationEditor({ staffId:st.id, name:st.user.name, locationId:st.locationId??'' })}
                    accessibilityRole="button" accessibilityLabel={`Assign location for ${st.user.name}`}>
                    <Text style={ms.smallActionText}>Location</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          {staff && staff.length===0 && <Text style={ms.empty}>No team members yet.</Text>}
          <Text style={[ms.empty,{ marginTop:4 }]}>Use Hours for weekly recurring availability and Time off for one-off blocked time.</Text>
          <TouchableOpacity style={[s.btnPrimary,{ marginTop:16, marginBottom:8 }]} onPress={()=>setStaffInviteEditor({ name:'', email:'' })}
            accessibilityRole="button" accessibilityLabel="Invite team member">
            <Text style={s.btnPrimaryText}>Invite team member</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      {/* Staff invite modal */}
      <Modal visible={!!staffInviteEditor} animationType="slide" onRequestClose={()=>setStaffInviteEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setStaffInviteEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Invite team member</Text>
          </View>
          <ScrollView contentContainerStyle={s.listContent}>
            <Text style={s.fieldLabel}>Full name</Text>
            <TextInput style={s.input} placeholder="Jane Smith" placeholderTextColor={GRAY_400}
              value={staffInviteEditor?.name??''} onChangeText={name=>setStaffInviteEditor(e=>e&&({...e,name}))}/>
            <Text style={[s.fieldLabel,{ marginTop:12 }]}>Email address</Text>
            <TextInput style={s.input} placeholder="jane@example.com" placeholderTextColor={GRAY_400}
              autoCapitalize="none" keyboardType="email-address"
              value={staffInviteEditor?.email??''} onChangeText={email=>setStaffInviteEditor(e=>e&&({...e,email}))}/>
            <Text style={[s.fieldHint,{ marginTop:8 }]}>A temporary password will be shown after creating the account. Share it with your team member so they can sign in and change it.</Text>
            <TouchableOpacity style={[s.btnPrimary,{ marginTop:20 }]} disabled={staffInviteSaving||!staffInviteEditor?.name.trim()||!staffInviteEditor?.email.trim()}
              accessibilityRole="button" accessibilityLabel="Create account"
              onPress={async()=>{
                if (!staffInviteEditor) return;
                setStaffInviteSaving(true);
                try {
                  const res = await api<{ staff:any; tempPassword:string }>(`/businesses/${bizId()}/staff/invite`, {
                    method:'POST', body: JSON.stringify({ name:staffInviteEditor.name.trim(), email:staffInviteEditor.email.trim() }),
                  });
                  setStaff(prev=>[...(prev??[]), res.staff]);
                  setStaffInviteEditor(null);
                  setStaffInviteResult({ email:staffInviteEditor.email.trim(), tempPassword:res.tempPassword });
                } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not invite team member.'); }
                finally { setStaffInviteSaving(false); }
              }}>
              <Text style={s.btnPrimaryText}>{staffInviteSaving ? 'Inviting…' : 'Create account'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {/* Staff invite result — show temp password */}
      <Modal visible={!!staffInviteResult} animationType="slide" onRequestClose={()=>setStaffInviteResult(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <Text style={s.headerTitle}>Team member invited</Text>
          </View>
          <ScrollView contentContainerStyle={[s.listContent,{ alignItems:'center', paddingTop:32 }]}>
            <Ionicons name="checkmark-circle" size={56} color={BRAND}/>
            <Text style={[ms.rowTitle,{ marginTop:16, textAlign:'center' }]} accessibilityLiveRegion="polite">Account created for {staffInviteResult?.email}</Text>
            <Text style={[ms.rowMeta,{ marginTop:8, textAlign:'center' }]}>Share this temporary password. They can change it after signing in.</Text>
            <View style={[ms.card,{ marginTop:20, width:'100%', alignItems:'center' }]}>
              <Text style={{ fontFamily:'monospace', fontSize:20, fontWeight:'700', color:GRAY_900, letterSpacing:2 }}>{staffInviteResult?.tempPassword}</Text>
            </View>
            <TouchableOpacity style={[s.btnPrimary,{ marginTop:24, width:'100%' }]}
              accessibilityRole="button" accessibilityLabel="Share credentials"
              onPress={()=>{
              Share.share({ message:`Your Pulse login:\nEmail: ${staffInviteResult?.email}\nTemp password: ${staffInviteResult?.tempPassword}\n\nSign in at ${WEB_URL}/login` });
            }}>
              <Text style={s.btnPrimaryText}>Share credentials</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnSecondary,{ marginTop:10, width:'100%' }]} onPress={()=>setStaffInviteResult(null)}
              accessibilityRole="button" accessibilityLabel="Done">
              <Text style={s.btnSecondaryText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={!!timeOffEditor} animationType="slide" onRequestClose={()=>setTimeOffEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setTimeOffEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
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
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={saveTimeOff}
                accessibilityRole="button" accessibilityLabel="Save time off"><Text style={s.btnPrimaryText}>Save time off</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={!!availabilityEditor} animationType="slide" onRequestClose={()=>setAvailabilityEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setAvailabilityEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
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
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:8 }]} onPress={saveAvailability}
                accessibilityRole="button" accessibilityLabel="Save weekly hours">
                <Text style={s.btnPrimaryText}>Save weekly hours</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={!!staffServiceEditor} animationType="slide" onRequestClose={()=>setStaffServiceEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setStaffServiceEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Staff services</Text>
          </View>
          {staffServiceEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={ms.cardLabel}>{staffServiceEditor.name}</Text>
              {(services ?? []).map(sv => {
                const selected = staffServiceEditor.serviceIds.includes(sv.id);
                return (
                  <TouchableOpacity key={sv.id} style={[ms.row, selected && { borderColor:BRAND, backgroundColor:BRAND_LT }]}
                    accessibilityRole="button"
                    accessibilityLabel={selected ? `Remove ${sv.name}` : `Add ${sv.name}`}
                    accessibilityState={{ selected }}
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
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:8 }]} onPress={saveStaffServices}
                accessibilityRole="button" accessibilityLabel="Save services">
                <Text style={s.btnPrimaryText}>Save services</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={!!staffLocationEditor} animationType="slide" onRequestClose={()=>setStaffLocationEditor(undefined)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setStaffLocationEditor(undefined)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Assign location</Text>
          </View>
          {staffLocationEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={ms.cardLabel}>{staffLocationEditor.name}</Text>
              <TouchableOpacity
                style={[ms.row, !staffLocationEditor.locationId && { borderColor:BRAND, backgroundColor:BRAND_LT }]}
                accessibilityRole="button" accessibilityLabel="Any / unassigned location"
                accessibilityState={{ selected: !staffLocationEditor.locationId }}
                onPress={()=>setStaffLocationEditor({...staffLocationEditor, locationId:''})}>
                <View style={[ms.dot,{ backgroundColor: !staffLocationEditor.locationId ? BRAND : GRAY_200 }]}/>
                <Text style={ms.rowTitle}>Any / unassigned</Text>
                <Ionicons name={!staffLocationEditor.locationId ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={!staffLocationEditor.locationId ? BRAND : GRAY_400}/>
              </TouchableOpacity>
              {(locations ?? []).filter(l => l.active).map(l => {
                const selected = staffLocationEditor.locationId === l.id;
                return (
                  <TouchableOpacity key={l.id} style={[ms.row, selected && { borderColor:BRAND, backgroundColor:BRAND_LT }]}
                    accessibilityRole="button" accessibilityLabel={l.name}
                    accessibilityState={{ selected }}
                    onPress={()=>setStaffLocationEditor({...staffLocationEditor, locationId:l.id})}>
                    <View style={[ms.dot,{ backgroundColor: selected ? BRAND : GRAY_200 }]}/>
                    <View style={{ flex:1 }}>
                      <Text style={ms.rowTitle}>{l.name}</Text>
                      {l.address && <Text style={ms.rowMeta} numberOfLines={1}>{l.address}</Text>}
                    </View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? BRAND : GRAY_400}/>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:8 }]} onPress={saveStaffLocation}
                accessibilityRole="button" accessibilityLabel="Save location">
                <Text style={s.btnPrimaryText}>Save location</Text>
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
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
          accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Offers</Text>
        <TouchableOpacity onPress={()=>openOfferEditor()}
          accessibilityRole="button" accessibilityLabel="Add new offer">
          <Ionicons name="add" size={24} color={BRAND}/>
        </TouchableOpacity>
      </View>
      {loading ? loader : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          {(offers ?? []).map(of => (
            <View key={of.id} style={[ms.card,{ borderLeftWidth:3, borderLeftColor:'#10B981' }]}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <View style={{ flex:1, paddingRight:10 }}>
                  <Text style={ms.rowTitle}>{of.title}</Text>
                  {!!of.discount && <View style={[ms.dealChip,{ alignSelf:'flex-start', marginTop:5 }]}><Text style={ms.dealChipText}>{of.discount}</Text></View>}
                </View>
                <View style={{ flexDirection:'row', gap:8 }}>
                  <TouchableOpacity style={ms.smallAction} onPress={()=>openOfferEditor(of)} accessibilityRole="button" accessibilityLabel="Edit offer"><Ionicons name="create-outline" size={16} color={BRAND}/></TouchableOpacity>
                  <TouchableOpacity style={ms.smallAction} onPress={()=>removeOffer(of)} accessibilityRole="button" accessibilityLabel="Delete offer"><Ionicons name="trash-outline" size={16} color="#DC2626"/></TouchableOpacity>
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
            <TouchableOpacity onPress={()=>setOfferEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
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
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={saveOffer}
                accessibilityRole="button" accessibilityLabel="Save offer"><Text style={s.btnPrimaryText}>Save offer</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'waitlist') return (
    <SafeAreaView style={s.screen}>
      {head('Waitlist')}
      {loading ? loader : (
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
                {!!w.phone && <TouchableOpacity style={ms.smallAction} onPress={()=>Linking.openURL(`tel:${w.phone}`)} accessibilityRole="button" accessibilityLabel={`Call ${w.name}`}><Text style={ms.smallActionText}>Call</Text></TouchableOpacity>}
                {!!w.email && <TouchableOpacity style={ms.smallAction} onPress={()=>Linking.openURL(`mailto:${w.email}`)} accessibilityRole="button" accessibilityLabel={`Email ${w.name}`}><Text style={ms.smallActionText}>Email</Text></TouchableOpacity>}
                <TouchableOpacity style={ms.smallAction} onPress={()=>Linking.openURL(`mailto:${w.email}?subject=${encodeURIComponent('A spot is available')}`)} accessibilityRole="button" accessibilityLabel={`Notify ${w.name} of available spot`}><Text style={ms.smallActionText}>Notify</Text></TouchableOpacity>
                <TouchableOpacity style={ms.smallAction} onPress={()=>{ nav.navigate('Calendar', { screen: 'Book' }); }} accessibilityRole="button" accessibilityLabel="Book appointment"><Text style={ms.smallActionText}>Book</Text></TouchableOpacity>
                <TouchableOpacity style={ms.smallAction} onPress={()=>removeWaitlistEntry(w.id)} accessibilityRole="button" accessibilityLabel={`Remove ${w.name} from waitlist`}><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Remove</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {waitlist && waitlist.length===0 && <Text style={ms.empty}>No one on the waitlist.</Text>}
          {waitlist && waitlist.length>0 && <Text style={[ms.empty,{ marginTop:4 }]}>Waiting clients are emailed automatically when a spot opens.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  if (view === 'reviews') {
    const reviewList: any[] = Array.isArray(reviews) ? reviews : [];
    const publishedList = reviewList.filter((r:any) => r.published);
    const average = publishedList.length ? publishedList.reduce((s:number,r:any)=>s+r.rating,0)/publishedList.length : 0;
    async function togglePublish(r: any) {
      try {
        const updated = await api<any>(`/businesses/${bizId()}/reviews/${r.id}`, { method:'PATCH', body: JSON.stringify({ published: !r.published }) });
        setReviews((prev: any[]) => prev.map((x:any) => x.id === r.id ? { ...x, published: updated.published } : x));
      } catch (e) { Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again.'); }
    }
    return (
      <SafeAreaView style={s.screen}>
        {head('Reviews')}
        {loading ? loader : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            {reviewList.length > 0 && (
              <View style={[ms.card,{ alignItems:'center', paddingVertical:16 }]}>
                <Text style={{ fontSize:32, fontWeight:'800', color:GRAY_700 }}>{average.toFixed(1)}</Text>
                <View style={{ flexDirection:'row', marginTop:2 }}>
                  {[1,2,3,4,5].map(n => <Ionicons key={n} name={n<=Math.round(average)?'star':'star-outline'} size={16} color="#F59E0B"/>)}
                </View>
                <Text style={[ms.rowMeta,{ marginTop:4 }]}>{publishedList.length} published · {reviewList.length} total</Text>
              </View>
            )}
            {reviewList.map((r:any) => (
              <View key={r.id} style={[ms.card, !r.published && { opacity:0.65 }]}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                  <Text style={ms.rowTitle}>{r.clientName}</Text>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <View style={{ flexDirection:'row' }}>
                      {[1,2,3,4,5].map(n => <Ionicons key={n} name={n<=r.rating?'star':'star-outline'} size={13} color="#F59E0B"/>)}
                    </View>
                    <TouchableOpacity onPress={()=>togglePublish(r)}
                      accessibilityRole="button"
                      accessibilityLabel={r.published ? 'Unpublish review' : 'Publish review'}>
                      <Ionicons name={r.published ? 'eye' : 'eye-off-outline'} size={18} color={r.published ? BRAND : GRAY_400}/>
                    </TouchableOpacity>
                  </View>
                </View>
                {!!r.comment && <Text style={[ms.rowMeta,{ marginTop:4 }]}>{r.comment}</Text>}
                <Text style={[ms.rowMeta,{ color:GRAY_400, marginTop:4 }]}>{new Date(r.createdAt).toLocaleDateString()}{!r.published && ' · Hidden'}</Text>
              </View>
            ))}
            {reviewList.length === 0 && <Text style={ms.empty}>No reviews yet.</Text>}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (view === 'marketing') return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
          accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Marketing</Text>
        <TouchableOpacity onPress={openCampaignComposer}
          accessibilityRole="button" accessibilityLabel="Add new campaign">
          <Ionicons name="add" size={24} color={BRAND}/>
        </TouchableOpacity>
      </View>
      {loading ? loader : (
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
                  <TouchableOpacity style={ms.smallAction} onPress={()=>sendCampaign(c)} accessibilityRole="button" accessibilityLabel="Send campaign"><Text style={ms.smallActionText}>Send</Text></TouchableOpacity>
                  <TouchableOpacity style={ms.smallAction} onPress={()=>removeCampaign(c)} accessibilityRole="button" accessibilityLabel="Delete campaign"><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Delete</Text></TouchableOpacity>
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
            <TouchableOpacity onPress={()=>setCampaignEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>New campaign</Text>
          </View>
          {campaignEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.fieldLabel}>Campaign name</Text>
              <TextInput style={s.input} value={campaignEditor.name} placeholder="June promo" placeholderTextColor={GRAY_400} onChangeText={name=>setCampaignEditor({...campaignEditor,name})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Channel</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                {(['EMAIL','SMS'] as const).map(ch => (
                  <TouchableOpacity key={ch} style={[ms.methodChip, campaignEditor.channel === ch && ms.methodChipOn]} onPress={()=>updateCampaignAudience({ channel:ch })}
                    accessibilityRole="button" accessibilityLabel={ch === 'EMAIL' ? 'Email channel' : 'SMS channel'}
                    accessibilityState={{ selected: campaignEditor.channel === ch }}>
                    <Text style={[ms.methodChipText, campaignEditor.channel === ch && { color:BRAND }]}>{ch === 'EMAIL' ? 'Email' : 'Text'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Audience</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                {campaignAudiences.map(a => (
                  <TouchableOpacity key={a.value} style={[ms.methodChip, campaignEditor.audience === a.value && ms.methodChipOn]} onPress={()=>updateCampaignAudience({ audience:a.value })}
                    accessibilityRole="button" accessibilityLabel={a.label}
                    accessibilityState={{ selected: campaignEditor.audience === a.value }}>
                    <Text style={[ms.methodChipText, campaignEditor.audience === a.value && { color:BRAND }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[ms.rowMeta,{ marginTop:8 }]} accessibilityLiveRegion="polite">{campaignEditor.count === null ? 'Counting recipients...' : `${campaignEditor.count} recipient${campaignEditor.count === 1 ? '' : 's'}`}</Text>
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
                <TouchableOpacity style={[s.btnSecondary,{ flex:1 }]} onPress={()=>saveCampaign(false)} accessibilityRole="button" accessibilityLabel="Save draft"><Text style={s.btnSecondaryText}>Save draft</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btnPrimary,{ flex:1 }]} onPress={()=>saveCampaign(true)} disabled={campaignEditor.count === 0} accessibilityRole="button" accessibilityLabel="Send campaign now"><Text style={s.btnPrimaryText}>Send now</Text></TouchableOpacity>
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
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
          accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Gift cards</Text>
        <View style={{ flexDirection:'row', gap:12 }}>
          <TouchableOpacity onPress={()=>setGiftMode('redeem')} accessibilityRole="button" accessibilityLabel="Redeem gift card"><Ionicons name="ticket-outline" size={23} color={BRAND}/></TouchableOpacity>
          <TouchableOpacity onPress={()=>setGiftMode('issue')} accessibilityRole="button" accessibilityLabel="Issue gift card"><Ionicons name="add" size={24} color={BRAND}/></TouchableOpacity>
        </View>
      </View>
      {loading ? loader : (
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
                <TouchableOpacity style={[ms.smallAction,{ alignSelf:'flex-start', marginTop:10 }]} onPress={()=>voidGiftCard(g)}
                  accessibilityRole="button" accessibilityLabel={`Void gift card ${g.code}`}>
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
            <TouchableOpacity onPress={()=>setGiftMode(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
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
            <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={issueGiftCard} accessibilityRole="button" accessibilityLabel="Issue gift card"><Text style={s.btnPrimaryText}>Issue gift card</Text></TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={giftMode === 'redeem'} animationType="slide" onRequestClose={()=>setGiftMode(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setGiftMode(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Redeem gift card</Text>
          </View>
          <ScrollView contentContainerStyle={s.listContent}>
            <Text style={s.fieldLabel}>Code</Text>
            <TextInput style={s.input} value={giftRedeem.code} autoCapitalize="characters" placeholder="GIFT-XXXX" placeholderTextColor={GRAY_400} onChangeText={code=>setGiftRedeem({...giftRedeem,code:code.toUpperCase()})}/>
            <Text style={[s.fieldLabel,{ marginTop:12 }]}>Amount</Text>
            <TextInput style={s.input} value={giftRedeem.amount} keyboardType="decimal-pad" onChangeText={amount=>setGiftRedeem({...giftRedeem,amount})}/>
            <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={redeemGiftCard} accessibilityRole="button" accessibilityLabel="Redeem gift card"><Text style={s.btnPrimaryText}>Redeem</Text></TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'packages') return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
          accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Packages</Text>
        {packageTab === 'products' ? (
          <TouchableOpacity onPress={()=>setPackageEditor({ name:'', serviceId:'', credits:'5', price:'' })}
            accessibilityRole="button" accessibilityLabel="Add new package">
            <Ionicons name="add" size={24} color={BRAND}/>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={()=>setPackageIssue({ client:null, search:'', packageId:'', results:[] })}
            accessibilityRole="button" accessibilityLabel="Issue package">
            <Ionicons name="add" size={24} color={BRAND}/>
          </TouchableOpacity>
        )}
      </View>
      {loading ? loader : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          <View style={[ms.card,{ flexDirection:'row', gap:8 }]}>
            {(['products','issued'] as const).map(tab => (
              <TouchableOpacity key={tab} style={[ms.methodChip, packageTab === tab && ms.methodChipOn]} onPress={()=>setPackageTab(tab)}
                accessibilityRole="button"
                accessibilityLabel={tab === 'products' ? 'Products' : 'Issued'}
                accessibilityState={{ selected: packageTab === tab }}>
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
                    <TouchableOpacity style={{ marginTop:6 }} onPress={()=>removePackageProduct(p)}
                      accessibilityRole="button" accessibilityLabel={`Delete package ${p.name}`}>
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
                      <TouchableOpacity style={ms.smallAction} onPress={()=>redeemIssuedPackage(cp)} accessibilityRole="button" accessibilityLabel="Use one credit"><Text style={ms.smallActionText}>Use credit</Text></TouchableOpacity>
                      <TouchableOpacity style={ms.smallAction} onPress={()=>voidIssuedPackage(cp)} accessibilityRole="button" accessibilityLabel="Void issued package"><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Void</Text></TouchableOpacity>
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
            <TouchableOpacity onPress={()=>setPackageEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
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
                <TouchableOpacity style={[dst.chip, !packageEditor.serviceId && dst.chipOn, { marginRight:8 }]} onPress={()=>setPackageEditor({...packageEditor,serviceId:''})}
                  accessibilityRole="button" accessibilityLabel="Any service"
                  accessibilityState={{ selected: !packageEditor.serviceId }}>
                  <Text style={[dst.chipDow, !packageEditor.serviceId && dst.chipTextOn]}>Any</Text>
                </TouchableOpacity>
                {(services ?? []).map(sv => {
                  const selected = packageEditor.serviceId === sv.id;
                  return (
                    <TouchableOpacity key={sv.id} style={[dst.chip, selected && dst.chipOn, { marginRight:8 }]} onPress={()=>setPackageEditor({...packageEditor,serviceId:sv.id})}
                      accessibilityRole="button" accessibilityLabel={sv.name}
                      accessibilityState={{ selected }}>
                      <Text style={[dst.chipDow, selected && dst.chipTextOn]}>{sv.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={savePackageProduct}
                accessibilityRole="button" accessibilityLabel="Create package"><Text style={s.btnPrimaryText}>Create package</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={!!packageIssue} animationType="slide" onRequestClose={()=>setPackageIssue(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setPackageIssue(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
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
                  <TouchableOpacity onPress={()=>setPackageIssue({...packageIssue,client:null,search:'',results:[]})} accessibilityRole="button" accessibilityLabel="Change selected client"><Text style={[ms.smallActionText,{ color:BRAND }]}>Change</Text></TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput style={s.input} value={packageIssue.search} placeholder="Search name or email" placeholderTextColor={GRAY_400} onChangeText={searchPackageClients}/>
                  {packageIssue.results.map(c => (
                    <TouchableOpacity key={c.id} style={ms.row} onPress={()=>setPackageIssue({...packageIssue,client:c,search:c.name,results:[]})}
                      accessibilityRole="button" accessibilityLabel={`Select client ${c.name}`}>
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
                  <TouchableOpacity key={p.id} style={[ms.row, selected && { borderColor:BRAND, backgroundColor:BRAND_LT }]} onPress={()=>setPackageIssue({...packageIssue,packageId:p.id})}
                    accessibilityRole="button" accessibilityLabel={`Select package ${p.name}`}
                    accessibilityState={{ selected }}>
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
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={issuePackageToClient}
                accessibilityRole="button" accessibilityLabel="Issue package to client"><Text style={s.btnPrimaryText}>Issue package</Text></TouchableOpacity>
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
      const overdue = !!due && t.status !== 'DONE' && due.getTime() < renderedAt;
      return (
        <View key={t.id} style={ms.row}>
          <TouchableOpacity onPress={()=>toggleTask(t)} style={[ms.checkCircle, t.status === 'DONE' && ms.checkCircleOn]}
            accessibilityRole="button" accessibilityLabel={t.status === 'DONE' ? `Mark ${t.title} as open` : `Mark ${t.title} as done`}>
            {t.status === 'DONE' && <Ionicons name="checkmark" size={14} color="#fff"/>}
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={[ms.rowTitle, t.status === 'DONE' && { color:GRAY_400, textDecorationLine:'line-through' }]}>{t.title}</Text>
            <Text style={[ms.rowMeta, overdue && { color:'#DC2626', fontWeight:'700' }]} numberOfLines={2}>
              {t.staff?.user?.name ? `${t.staff.user.name} · ` : ''}{due ? `${due.toLocaleDateString()} ${fmtTime(due.toISOString())}` : 'No due date'}{t.notes ? ` · ${t.notes}` : ''}
            </Text>
          </View>
          {isOwner && (
            <TouchableOpacity style={ms.iconAction} onPress={()=>removeTask(t)}
              accessibilityRole="button" accessibilityLabel="Delete task">
              <Ionicons name="trash-outline" size={18} color="#DC2626"/>
            </TouchableOpacity>
          )}
        </View>
      );
    };
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
            accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
          <Text style={s.headerTitle}>Tasks</Text>
          {isOwner && (
            <TouchableOpacity onPress={()=>setTaskEditor({ title:'', staffId:'', dueAt:'', notes:'' })}
              accessibilityRole="button" accessibilityLabel="Add new task">
              <Ionicons name="add" size={24} color={BRAND}/>
            </TouchableOpacity>
          )}
        </View>
        {loading ? loader : (
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
              <TouchableOpacity onPress={()=>setTaskEditor(null)} style={{ marginRight:6 }}
                accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
              <Text style={s.headerTitle}>New task</Text>
            </View>
            {taskEditor && (
              <ScrollView contentContainerStyle={s.listContent}>
                <Text style={s.fieldLabel}>Task</Text>
                <TextInput style={s.input} value={taskEditor.title} placeholder="Restock products, call client..." placeholderTextColor={GRAY_400} onChangeText={title=>setTaskEditor({...taskEditor,title})}/>
                <Text style={[s.fieldLabel,{ marginTop:12 }]}>Assign to</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }}>
                  <TouchableOpacity style={[dst.chip, !taskEditor.staffId && dst.chipOn, { marginRight:8 }]} onPress={()=>setTaskEditor({...taskEditor,staffId:''})}
                    accessibilityRole="button" accessibilityLabel="Assign to anyone"
                    accessibilityState={{ selected: !taskEditor.staffId }}>
                    <Text style={[dst.chipDow, !taskEditor.staffId && dst.chipTextOn]}>Any</Text>
                  </TouchableOpacity>
                  {(staff ?? []).map(st => {
                    const selected = taskEditor.staffId === st.id;
                    return (
                      <TouchableOpacity key={st.id} style={[dst.chip, selected && dst.chipOn, { marginRight:8 }]} onPress={()=>setTaskEditor({...taskEditor,staffId:st.id})}
                        accessibilityRole="button" accessibilityLabel={`Assign to ${st.user.name}`}
                        accessibilityState={{ selected }}>
                        <Text style={[dst.chipDow, selected && dst.chipTextOn]}>{st.user.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={[s.fieldLabel,{ marginTop:12 }]}>Due date</Text>
                <TextInput style={s.input} value={taskEditor.dueAt} placeholder="2026-06-05 14:00" placeholderTextColor={GRAY_400} onChangeText={dueAt=>setTaskEditor({...taskEditor,dueAt})}/>
                <Text style={[s.fieldLabel,{ marginTop:12 }]}>Notes</Text>
                <TextInput style={[s.input,{ minHeight:86, textAlignVertical:'top' }]} multiline value={taskEditor.notes} placeholder="Optional details" placeholderTextColor={GRAY_400} onChangeText={notes=>setTaskEditor({...taskEditor,notes})}/>
                <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={saveTask}
                  accessibilityRole="button" accessibilityLabel="Add task"><Text style={s.btnPrimaryText}>Add task</Text></TouchableOpacity>
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
            <TouchableOpacity disabled={followupBusy===it.id} style={ms.smallAction} onPress={()=>approveFollowup(it)} accessibilityRole="button" accessibilityLabel="Approve follow-up invite"><Text style={ms.smallActionText}>Approve</Text></TouchableOpacity>
            <TouchableOpacity disabled={followupBusy===it.id} style={ms.smallAction} onPress={()=>setFollowupSnoozing(it.id)} accessibilityRole="button" accessibilityLabel="Reschedule follow-up"><Text style={ms.smallActionText}>Reschedule</Text></TouchableOpacity>
            <TouchableOpacity disabled={followupBusy===it.id} style={ms.smallAction} onPress={()=>cancelFollowup(it)} accessibilityRole="button" accessibilityLabel="Stop follow-up reminders"><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Stop</Text></TouchableOpacity>
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
        {head('Follow-ups')}
        {loading ? loader : (
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
        {head('Online Booking')}
        {loading ? loader : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            <Text style={[ms.cardLabel,{ marginBottom:6, marginLeft:2 }]}>YOUR BOOKING PAGE</Text>
            <View style={ms.card}>
              <Text style={[ms.rowMeta,{ color:BRAND }]} numberOfLines={2}>{bookingUrl}</Text>
              <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                <TouchableOpacity style={[ms.methodChip,{ flex:1 }]} onPress={()=>Linking.openURL(bookingUrl)}
                  accessibilityRole="button" accessibilityLabel="Open booking page">
                  <Text style={ms.methodChipText}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.methodChip,{ flex:1 }]} onPress={()=>Share.share({ message: bookingUrl })}
                  accessibilityRole="button" accessibilityLabel="Share booking link">
                  <Text style={ms.methodChipText}>Share link</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[ms.cardLabel,{ marginTop:18, marginBottom:6, marginLeft:2 }]}>QR CODE</Text>
            <View style={[ms.card,{ alignItems:'center', paddingVertical:20 }]}>
              {biz?.slug ? (
                <QRCode value={bookingUrl} size={180} color={GRAY_900} backgroundColor="#fff"/>
              ) : (
                <Text style={ms.empty}>Save your business settings first to generate a QR code.</Text>
              )}
              <Text style={[ms.rowMeta,{ marginTop:12, textAlign:'center' }]}>Clients can scan this to go straight to your booking page.</Text>
            </View>
            <Text style={[ms.cardLabel,{ marginTop:18, marginBottom:6, marginLeft:2 }]}>BOOKING-PAGE TOOLS</Text>
            {[
              { label:'Reviews', icon:'star-outline' as const, v:'reviews' as MoreView },
              { label:'Offers', icon:'pricetag-outline' as const, v:'offers' as MoreView },
            ].map((r,i,arr)=>(
              <TouchableOpacity key={r.label} style={[s.menuRow, i<arr.length-1&&s.menuRowBorder]} onPress={()=>open(r.v)} activeOpacity={0.7}
                accessibilityRole="button" accessibilityLabel={r.label}>
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
      {head('Notifications')}
      {loading ? loader : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          <Text style={[ms.cardLabel,{ marginBottom:6, marginLeft:2 }]}>CLIENT NOTIFICATIONS</Text>
          <View style={ms.card}>
            {([
              ['emailConfirmation','Booking confirmation'],
              ['emailReminder24h','24-hour reminder'],
              ['emailCancellation','Cancellation notice'],
              ['emailReschedule','Reschedule notice'],
              ['emailStaffCancellation','Business cancellation notice'],
            ] as const).map(([key,label],i,arr)=>(
              <View key={key} style={[ms.notifRow, i<arr.length-1&&ms.notifRowBorder]}>
                <Text style={ms.rowTitle}>{label}</Text>
                <Switch
                  value={biz?.notificationSettings?.[key] !== false}
                  onValueChange={(enabled)=>setNotificationPreference(key, enabled)}
                  trackColor={{ false:GRAY_200, true:BRAND_LT }}
                  thumbColor={biz?.notificationSettings?.[key] !== false ? BRAND : GRAY_400}
                />
              </View>
            ))}
          </View>
          <Text style={[ms.cardLabel,{ marginTop:18, marginBottom:6, marginLeft:2 }]}>SMS</Text>
          <View style={ms.card}>
            <View style={ms.notifRow}>
              <View style={{ flex:1, paddingRight:12 }}>
                <Text style={ms.rowTitle}>2-hour reminder</Text>
                <Text style={ms.rowMeta}>Booking confirmation texts are always sent when a client provides a phone number.</Text>
              </View>
              <Switch
                value={biz?.notificationSettings?.smsReminder2h !== false}
                onValueChange={(enabled)=>setNotificationPreference('smsReminder2h', enabled)}
                trackColor={{ false:GRAY_200, true:BRAND_LT }}
                thumbColor={biz?.notificationSettings?.smsReminder2h !== false ? BRAND : GRAY_400}
              />
            </View>
          </View>
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
    const now = renderedAt;
    const cutoff = reportRange === 'week' ? now - 7*86400000 : reportRange === 'month' ? now - 30*86400000 : 0;
    const allAppts = appts ?? [];
    const list = cutoff ? allAppts.filter(a => +new Date(a.startsAt) >= cutoff) : allAppts;
    const allPayments = payments ?? [];
    const paymentRows = cutoff ? allPayments.filter(p => +new Date(p.createdAt) >= cutoff) : allPayments;
    const todayKey = new Date(renderedAt).toDateString();
    const todayCount = allAppts.filter(a => new Date(a.startsAt).toDateString()===todayKey).length;
    const upcoming = allAppts.filter(a => ['PENDING','CONFIRMED'].includes(a.status) && +new Date(a.startsAt) > now).length;
    const completed = list.filter(a => a.status==='COMPLETED');
    const revenueCents = paymentRows
      .filter(p => p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED')
      .reduce((sum:number,p:any)=> sum + (p.amountCents ?? 0) - (p.refundedCents ?? 0), 0);
    const failedPayments = paymentRows.filter((p:any) => p.status === 'FAILED').length;
    const noShows = list.filter(a => a.status==='NO_SHOW').length;
    const cancelled = list.filter(a => a.status==='CANCELLED').length;
    const total = list.length;
    const cancellationRate = total ? Math.round(((cancelled + noShows) / total) * 100) : 0;
    const byService = completed.reduce((map,a)=>{
      const key = a.service?.name ?? 'Unknown';
      map[key] = (map[key] ?? 0) + 1;
      return map;
    }, {} as Record<string,number>);
    const serviceBreakdown = Object.entries(byService).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const stats = [
      { label:"Today's appointments", value:String(todayCount) },
      { label:'Upcoming', value:String(upcoming) },
      { label:'Completed', value:String(completed.length) },
      { label:'Collected revenue', value:`$${(revenueCents/100).toFixed(2)}` },
      { label:'Cancellation rate', value:`${cancellationRate}% (${cancelled + noShows} of ${total})` },
      { label:'Failed payments', value:String(failedPayments) },
    ];
    return (
      <SafeAreaView style={s.screen}>
        {head('Reports')}
        {loading ? loader : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            {/* Date range tabs */}
            <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
              {([['week','7 days'],['month','30 days'],['all','All time']] as const).map(([r,label]) => (
                <TouchableOpacity key={r} onPress={()=>setReportRange(r)}
                  style={[ms.methodChip, reportRange===r && ms.methodChipOn, { flex:1, justifyContent:'center' }]}
                  accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: reportRange===r }}>
                  <Text style={[ms.methodChipText, reportRange===r && { color:BRAND }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {stats.map(st => (
              <View key={st.label} style={[ms.card,{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}>
                <Text style={ms.cardLabel}>{st.label}</Text>
                <Text style={[ms.cardValue,{ marginTop:0 }]}>{st.value}</Text>
              </View>
            ))}
            {serviceBreakdown.length > 0 && (
              <View style={ms.card}>
                <Text style={[ms.cardLabel,{ marginBottom:10 }]}>Top services (completed)</Text>
                {serviceBreakdown.map(([name, count]) => {
                  const pct = completed.length ? Math.round((count/completed.length)*100) : 0;
                  return (
                    <View key={name} style={{ marginBottom:8 }}>
                      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:3 }}>
                        <Text style={{ fontSize:13, color:GRAY_700, flex:1 }} numberOfLines={1}>{name}</Text>
                        <Text style={{ fontSize:13, color:GRAY_500 }}>{count} · {pct}%</Text>
                      </View>
                      <View style={{ height:5, backgroundColor:GRAY_100, borderRadius:3 }}>
                        <View style={{ height:5, borderRadius:3, backgroundColor:BRAND, width:`${pct}%` }}/>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            <Text style={[ms.empty,{ marginTop:8 }]}>Full exports and charts are available on the web dashboard.</Text>
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
        {head('Transactions')}
        {loading ? loader : (
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
                    <TouchableOpacity style={[ms.methodChip,{ marginTop:10 }]} onPress={()=>refundPayment(p)}
                      accessibilityRole="button" accessibilityLabel="Refund payment">
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

  if (view === 'payouts') {
    const cs = connectStatus;
    const refreshConnect = () => api<ConnectStatus>('/payments/connect/status').then(setConnectStatus).catch(() => {});
    return (
      <SafeAreaView style={s.screen}>
        {head('Payouts')}
        {loading && !cs ? loader : (
          <ScrollView contentContainerStyle={{ padding:16, gap:12 }} showsVerticalScrollIndicator={false}>
            {!cs ? (
              <Text style={{ color:GRAY_400, fontSize:14 }}>Loading…</Text>
            ) : !cs.onboarded ? (
              <View style={{ backgroundColor:'#EDE9FE', borderRadius:14, padding:16, gap:10 }}>
                <Text style={{ fontSize:15, fontWeight:'700', color:'#4C1D95' }}>Connect your bank account</Text>
                <Text style={{ fontSize:13, color:'#5B21B6' }}>Link your bank account via Stripe to receive payouts from client payments and in-person charges.</Text>
                <TouchableOpacity
                  style={[s.btnPrimary, connectBusy && { opacity:0.6 }]}
                  disabled={connectBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Set up payouts with Stripe"
                  onPress={async () => {
                    setConnectBusy(true);
                    try {
                      const { url } = await api<{ url: string; accountId: string }>('/payments/connect/onboard', { method:'POST' });
                      await Linking.openURL(url);
                    } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not start Stripe onboarding'); }
                    finally { setConnectBusy(false); }
                  }}>
                  <Text style={s.btnPrimaryText}>{connectBusy ? 'Opening…' : 'Set up payouts with Stripe'}</Text>
                </TouchableOpacity>
              </View>
            ) : !cs.chargesEnabled ? (
              <View style={{ backgroundColor:'#FFFBEB', borderRadius:14, padding:16, gap:10, borderWidth:1, borderColor:'#FDE68A' }}>
                <Text style={{ fontSize:15, fontWeight:'700', color:'#78350F' }}>Verification in progress</Text>
                <Text style={{ fontSize:13, color:'#92400E' }}>You&apos;ve submitted your information — Stripe is reviewing your account. This typically takes a few minutes to 1 business day.</Text>
                <Text style={{ fontSize:12, color:'#B45309' }}>Payments made before approval are held safely in your Stripe balance.</Text>
                <TouchableOpacity
                  style={[s.btnGhost, connectBusy && { opacity:0.6 }]}
                  disabled={connectBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Check status in Stripe dashboard"
                  onPress={async () => {
                    setConnectBusy(true);
                    try {
                      const { url } = await api<{ url: string }>('/payments/connect/dashboard', { method:'POST' });
                      await Linking.openURL(url);
                    } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not open dashboard'); }
                    finally { setConnectBusy(false); refreshConnect(); }
                  }}>
                  <Text style={s.btnGhostText}>{connectBusy ? 'Opening…' : 'Check status in Stripe dashboard'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={{ backgroundColor:'#ECFDF5', borderRadius:14, padding:16, gap:4, borderWidth:1, borderColor:'#A7F3D0' }}>
                  <Text style={{ fontSize:15, fontWeight:'700', color:'#065F46' }}>Bank account connected</Text>
                  <Text style={{ fontSize:13, color:'#047857' }}>Your Stripe Express account is active and ready to receive payouts.</Text>
                </View>
                {cs.available.length > 0 && (
                  <View style={{ flexDirection:'row', gap:10 }}>
                    <View style={{ flex:1, backgroundColor:'#fff', borderRadius:14, padding:14, borderWidth:1, borderColor:GRAY_100 }}>
                      <Text style={{ fontSize:11, color:GRAY_400, marginBottom:4 }}>Available</Text>
                      {cs.available.map(b => (
                        <Text key={b.currency} style={{ fontSize:22, fontWeight:'700', color:GRAY_900 }}>${(b.amount/100).toFixed(2)} <Text style={{ fontSize:13, color:GRAY_400 }}>{b.currency.toUpperCase()}</Text></Text>
                      ))}
                    </View>
                    <View style={{ flex:1, backgroundColor:'#fff', borderRadius:14, padding:14, borderWidth:1, borderColor:GRAY_100 }}>
                      <Text style={{ fontSize:11, color:GRAY_400, marginBottom:4 }}>Pending</Text>
                      {cs.pending.map(b => (
                        <Text key={b.currency} style={{ fontSize:22, fontWeight:'700', color:GRAY_500 }}>${(b.amount/100).toFixed(2)} <Text style={{ fontSize:13, color:GRAY_400 }}>{b.currency.toUpperCase()}</Text></Text>
                      ))}
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  style={[s.btnPrimary, connectBusy && { opacity:0.6 }]}
                  disabled={connectBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Open Stripe Express dashboard"
                  onPress={async () => {
                    setConnectBusy(true);
                    try {
                      const { url } = await api<{ url: string }>('/payments/connect/dashboard', { method:'POST' });
                      await Linking.openURL(url);
                    } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not open dashboard'); }
                    finally { setConnectBusy(false); refreshConnect(); }
                  }}>
                  <Text style={s.btnPrimaryText}>{connectBusy ? 'Opening…' : 'Open Stripe Express dashboard'}</Text>
                </TouchableOpacity>
              </>
            )}
            <Text style={{ fontSize:11, color:GRAY_400, textAlign:'center', marginTop:8 }}>Powered by Stripe Connect. Payouts are processed securely by Stripe.</Text>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (view === 'invoices') {
    const IC: Record<string,string> = { DRAFT:GRAY_500, SENT:'#2563EB', PAID:'#10B981', VOID:'#EF4444' };
    const subtotal = invoiceEditor ? invoiceEditor.items.reduce((t,it)=>t + (Math.max(1,Number.parseInt(it.quantity||'1',10)||1) * (Number.parseFloat(it.unit||'0')||0)), 0) : 0;
    return (
      <SafeAreaView style={s.screen}>
        {head('Invoices')}
        {loading ? loader : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={[s.btnPrimary,{ marginBottom:14 }]} onPress={()=>setInvoiceEditor({ items:[{ description:'', quantity:'1', unit:'0.00' }], notes:'' })}
              accessibilityRole="button" accessibilityLabel="Add new invoice">
              <Text style={s.btnPrimaryText}>New invoice</Text>
            </TouchableOpacity>
            {(invoices ?? []).map(inv => {
              const c = IC[inv.status] ?? GRAY_400;
              return (
                <View key={inv.id} style={ms.card}>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                    <Text style={ms.rowTitle}>#{inv.number} · ${(inv.totalCents/100).toFixed(2)}</Text>
                    <View style={[s.pill,{ borderColor:c+'33', backgroundColor:c+'15' }]}><Text style={[s.pillText,{ color:c }]}>{inv.status}</Text></View>
                  </View>
                  <Text style={[ms.rowMeta,{ marginTop:2 }]}>{inv.client?.name ?? 'No client'} · {new Date(inv.createdAt).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' })}</Text>
                  <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:10 }}>
                    {inv.status==='DRAFT' && <TouchableOpacity style={ms.smallAction} onPress={()=>setInvoiceStatus(inv.id,'SENT')} accessibilityRole="button" accessibilityLabel="Mark invoice sent"><Text style={ms.smallActionText}>Mark sent</Text></TouchableOpacity>}
                    {(inv.status==='DRAFT'||inv.status==='SENT') && inv.client?.email && (
                      <TouchableOpacity style={ms.smallAction} accessibilityRole="button" accessibilityLabel="Send invoice by email" onPress={async()=>{
                        try {
                          await api(`/businesses/${bizId()}/invoices/${inv.id}/send`, { method:'POST' });
                          setInvoices(await api<any[]>(`/businesses/${bizId()}/invoices`));
                          Alert.alert('Invoice sent', `Invoice #${inv.number} emailed to ${inv.client.email}.`);
                        } catch(e) { Alert.alert('Could not send', e instanceof Error ? e.message : 'Please try again.'); }
                      }}><Text style={ms.smallActionText}>Send email</Text></TouchableOpacity>
                    )}
                    {inv.status!=='PAID' && inv.status!=='VOID' && <TouchableOpacity style={ms.smallAction} onPress={()=>setInvoiceStatus(inv.id,'PAID')} accessibilityRole="button" accessibilityLabel="Mark invoice paid"><Text style={ms.smallActionText}>Mark paid</Text></TouchableOpacity>}
                    {inv.status!=='VOID' && <TouchableOpacity style={ms.smallAction} onPress={()=>setInvoiceStatus(inv.id,'VOID')} accessibilityRole="button" accessibilityLabel="Void invoice"><Text style={ms.smallActionText}>Void</Text></TouchableOpacity>}
                    <TouchableOpacity style={ms.smallAction} onPress={()=>deleteInvoice(inv.id)} accessibilityRole="button" accessibilityLabel="Delete invoice"><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Delete</Text></TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {invoices && invoices.length===0 && <Text style={ms.empty}>No invoices yet.</Text>}
          </ScrollView>
        )}
        <Modal visible={!!invoiceEditor} animationType="slide" onRequestClose={()=>setInvoiceEditor(null)}>
          <SafeAreaView style={s.screen}>
            <View style={s.header}>
              <TouchableOpacity onPress={()=>setInvoiceEditor(null)} style={{ marginRight:6 }}
                accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
              <Text style={s.headerTitle}>New invoice</Text>
            </View>
            {invoiceEditor && (
              <ScrollView contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled">
                <Text style={s.fieldLabel}>Line items</Text>
                {invoiceEditor.items.map((it,idx)=>(
                  <View key={idx} style={[ms.card,{ gap:8 }]}>
                    <TextInput style={s.input} placeholder="Description" placeholderTextColor={GRAY_400} value={it.description}
                      onChangeText={v=>setInvoiceEditor(e=>e?{ ...e, items:e.items.map((x,i)=>i===idx?{ ...x, description:v }:x) }:e)}/>
                    <View style={{ flexDirection:'row', gap:8, alignItems:'flex-end' }}>
                      <View style={{ flex:1 }}>
                        <Text style={s.fieldHint}>Qty</Text>
                        <TextInput style={s.input} keyboardType="number-pad" value={it.quantity}
                          onChangeText={v=>setInvoiceEditor(e=>e?{ ...e, items:e.items.map((x,i)=>i===idx?{ ...x, quantity:v }:x) }:e)}/>
                      </View>
                      <View style={{ flex:2 }}>
                        <Text style={s.fieldHint}>Unit price ($)</Text>
                        <TextInput style={s.input} keyboardType="decimal-pad" value={it.unit}
                          onChangeText={v=>setInvoiceEditor(e=>e?{ ...e, items:e.items.map((x,i)=>i===idx?{ ...x, unit:v }:x) }:e)}/>
                      </View>
                      {invoiceEditor.items.length>1 && (
                        <TouchableOpacity style={{ padding:10 }} onPress={()=>setInvoiceEditor(e=>e?{ ...e, items:e.items.filter((_,i)=>i!==idx) }:e)}
                          accessibilityRole="button" accessibilityLabel="Delete line item">
                          <Ionicons name="trash-outline" size={20} color="#DC2626"/>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={[ms.smallAction,{ alignSelf:'flex-start', marginBottom:14 }]} onPress={()=>setInvoiceEditor(e=>e?{ ...e, items:[...e.items, { description:'', quantity:'1', unit:'0.00' }] }:e)}
                  accessibilityRole="button" accessibilityLabel="Add line item">
                  <Text style={ms.smallActionText}>+ Add line</Text>
                </TouchableOpacity>
                <Text style={[ms.rowMeta,{ color:BRAND, marginBottom:14 }]}>Subtotal: ${subtotal.toFixed(2)} (tax added per your settings)</Text>
                <Text style={s.fieldLabel}>Notes (optional)</Text>
                <TextInput style={[s.input,{ minHeight:70, textAlignVertical:'top' }]} multiline value={invoiceEditor.notes}
                  onChangeText={v=>setInvoiceEditor(e=>e?{ ...e, notes:v }:e)}/>
                <TouchableOpacity style={[s.btnPrimary,{ marginTop:14 }]} onPress={saveInvoice}
                  accessibilityRole="button" accessibilityLabel="Create invoice"><Text style={s.btnPrimaryText}>Create invoice</Text></TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  if (view === 'addons') return (
    <SafeAreaView style={s.screen}>
      {head('Add-ons')}
      <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
        <View style={ms.card}>
          {[
            { label:'Gift cards', icon:'gift-outline' as const, v:'giftcards' as MoreView },
            { label:'Packages', icon:'cube-outline' as const, v:'packages' as MoreView },
            { label:'Marketing', icon:'megaphone-outline' as const, v:'marketing' as MoreView },
            { label:'Team', icon:'people-outline' as const, v:'staff' as MoreView },
          ].map((r,i,arr)=>(
            <TouchableOpacity key={r.label} style={[ms.notifRow, i<arr.length-1&&ms.notifRowBorder]} onPress={()=>open(r.v)} activeOpacity={0.7}
              accessibilityRole="button" accessibilityLabel={r.label}>
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
      {head('Subscriptions')}
      {loading ? loader : (
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

  // ── Locations ───────────────────────────────────────────────────────────────
  async function loadLocations() {
    setLoading(true);
    try { setLocations(await api<Location[]>(`/businesses/${bizId()}/locations`)); }
    catch { Alert.alert('Error', 'Could not load locations.'); }
    finally { setLoading(false); }
  }
  async function saveLocation() {
    if (!locationEditor) return;
    const name = locationEditor.name.trim();
    if (!name) return;
    setLocationSaving(true);
    try {
      const payload = {
        name,
        address: locationEditor.address.trim() || undefined,
        phone: locationEditor.phone.trim() || undefined,
        timezone: locationEditor.timezone.trim() || undefined,
        active: locationEditor.active,
      };
      if (locationEditor.id) {
        await api(`/businesses/${bizId()}/locations/${locationEditor.id}`, { method:'PATCH', body: JSON.stringify(payload) });
      } else {
        await api(`/businesses/${bizId()}/locations`, { method:'POST', body: JSON.stringify(payload) });
      }
      setLocationEditor(null);
      await loadLocations();
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not save.'); }
    finally { setLocationSaving(false); }
  }
  async function toggleLocation(l: Location) {
    try {
      await api(`/businesses/${bizId()}/locations/${l.id}`, { method:'PATCH', body: JSON.stringify({ active: !l.active }) });
      setLocations(prev => (prev ?? []).map(x => x.id === l.id ? { ...x, active: !l.active } : x));
    } catch { Alert.alert('Error', 'Could not update location.'); }
  }
  async function deleteLocation(l: Location) {
    Alert.alert('Delete location?', `Delete "${l.name}"? Staff assigned to it become unassigned.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/locations/${l.id}`, { method:'DELETE' });
          setLocations(prev => (prev ?? []).filter(x => x.id !== l.id));
        } catch { Alert.alert('Error', 'Could not delete location.'); }
      }},
    ]);
  }

  // ── Resources ───────────────────────────────────────────────────────────────
  async function loadResources() {
    setLoading(true);
    try { setResources(await api<Resource[]>(`/businesses/${bizId()}/resources`)); }
    catch { Alert.alert('Error', 'Could not load resources.'); }
    finally { setLoading(false); }
  }
  async function saveResource() {
    if (!resourceEditor) return;
    const name = resourceEditor.name.trim();
    if (!name) return;
    setResourceSaving(true);
    try {
      if (resourceEditor.id) {
        await api(`/businesses/${bizId()}/resources/${resourceEditor.id}`, { method:'PATCH', body: JSON.stringify({ name }) });
      } else {
        await api(`/businesses/${bizId()}/resources`, { method:'POST', body: JSON.stringify({ name }) });
      }
      setResourceEditor(null);
      await loadResources();
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not save.'); }
    finally { setResourceSaving(false); }
  }
  async function toggleResource(r: Resource) {
    try {
      await api(`/businesses/${bizId()}/resources/${r.id}`, { method:'PATCH', body: JSON.stringify({ active: !r.active }) });
      setResources(prev => (prev ?? []).map(x => x.id === r.id ? { ...x, active: !r.active } : x));
    } catch { Alert.alert('Error', 'Could not update resource.'); }
  }
  async function deleteResource(r: Resource) {
    Alert.alert('Delete resource?', `Delete "${r.name}"? Services using it will lose their room assignment.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try {
          await api(`/businesses/${bizId()}/resources/${r.id}`, { method:'DELETE' });
          setResources(prev => (prev ?? []).filter(x => x.id !== r.id));
        } catch { Alert.alert('Error', 'Could not delete resource.'); }
      }},
    ]);
  }

  if (view === 'locations') return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
          accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={GRAY_700}/>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Locations</Text>
        <TouchableOpacity onPress={()=>setLocationEditor({ name:'', address:'', phone:'', timezone:'', active:true })}
          accessibilityRole="button" accessibilityLabel="Add new location">
          <Ionicons name="add" size={24} color={BRAND}/>
        </TouchableOpacity>
      </View>
      {loading ? loader : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          <Text style={[ms.empty,{ marginBottom:12 }]}>
            Add branches or locations. Assign staff to a location so clients only see that branch&apos;s providers when booking.
          </Text>

          {(locations ?? []).length === 0 ? (
            <View style={[ms.card, { alignItems:'center', paddingVertical:28 }]}>
              <Ionicons name="location-outline" size={32} color={GRAY_400}/>
              <Text style={[ms.rowTitle,{ marginTop:10, textAlign:'center' }]}>No locations yet</Text>
              <Text style={[ms.empty,{ marginTop:4, textAlign:'center' }]}>
                Tap + to add your first location or branch.
              </Text>
            </View>
          ) : (
            <View style={ms.card}>
              {(locations ?? []).map((l, i, arr) => (
                <View key={l.id} style={[ms.notifRow, i < arr.length - 1 && ms.notifRowBorder]}>
                  <View style={{
                    width:8, height:8, borderRadius:4, marginRight:10,
                    backgroundColor: l.active ? '#34d399' : GRAY_200,
                  }}/>
                  <View style={{ flex:1 }}>
                    <Text style={[ms.rowTitle, !l.active && { color:GRAY_400, textDecorationLine:'line-through' }]}>
                      {l.name}
                    </Text>
                    {(l.address || l.phone || l.timezone) ? (
                      <Text style={ms.rowMeta} numberOfLines={1}>
                        {[l.address, l.phone, l.timezone].filter(Boolean).join(' · ')}
                      </Text>
                    ) : (
                      <Text style={ms.rowMeta}>{l.active ? 'Active' : 'Inactive'}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection:'row', gap:4 }}>
                    <TouchableOpacity
                      onPress={()=>toggleLocation(l)}
                      accessibilityRole="button"
                      accessibilityLabel={l.active ? `Deactivate ${l.name}` : `Activate ${l.name}`}
                      style={{
                        paddingHorizontal:10, paddingVertical:4, borderRadius:12, borderWidth:1,
                        borderColor: l.active ? '#a7f3d0' : GRAY_200,
                        backgroundColor: l.active ? '#ecfdf5' : GRAY_50,
                      }}>
                      <Text style={{ fontSize:11, fontWeight:'600', color: l.active ? '#065f46' : GRAY_500 }}>
                        {l.active ? 'Active' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={()=>setLocationEditor({ id:l.id, name:l.name, address:l.address??'', phone:formatPhoneDisplay(l.phone), timezone:l.timezone??'', active:l.active })}
                      accessibilityRole="button" accessibilityLabel="Edit location"
                      style={{ padding:6, borderRadius:8, backgroundColor:GRAY_50 }}>
                      <Ionicons name="pencil-outline" size={15} color={GRAY_500}/>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={()=>deleteLocation(l)}
                      accessibilityRole="button" accessibilityLabel="Delete location"
                      style={{ padding:6, borderRadius:8, backgroundColor:'#fff0f0' }}>
                      <Ionicons name="trash-outline" size={15} color="#ef4444"/>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[s.btnPrimary, { marginTop:16 }]}
            onPress={()=>setLocationEditor({ name:'', address:'', phone:'', timezone:'', active:true })}
            accessibilityRole="button" accessibilityLabel="Add new location">
            <Text style={s.btnPrimaryText}>+ Add location</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={!!locationEditor} animationType="slide" onRequestClose={()=>setLocationEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setLocationEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={GRAY_700}/>
            </TouchableOpacity>
            <Text style={s.headerTitle}>{locationEditor?.id ? 'Edit location' : 'New location'}</Text>
          </View>
          {locationEditor && (
            <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
              <ScrollView contentContainerStyle={s.listContent}>
                <Text style={s.fieldLabel}>Name *</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Downtown, West End"
                  placeholderTextColor={GRAY_400}
                  value={locationEditor.name}
                  onChangeText={name=>setLocationEditor({...locationEditor, name})}
                  autoFocus
                />
                <Text style={[s.fieldLabel,{ marginTop:12 }]}>Address</Text>
                <TextInput
                  style={s.input}
                  placeholder="123 Main St"
                  placeholderTextColor={GRAY_400}
                  value={locationEditor.address}
                  onChangeText={address=>setLocationEditor({...locationEditor, address})}
                />
                <Text style={[s.fieldLabel,{ marginTop:12 }]}>Phone</Text>
                <TextInput
                  style={s.input}
                  placeholder="+1 555 000 0000"
                  placeholderTextColor={GRAY_400}
                  keyboardType="phone-pad"
                  value={locationEditor.phone}
                  onChangeText={phone=>setLocationEditor({...locationEditor, phone})}
                />
                <Text style={[s.fieldLabel,{ marginTop:12 }]}>Timezone</Text>
                <TextInput
                  style={s.input}
                  placeholder="America/Toronto"
                  placeholderTextColor={GRAY_400}
                  value={locationEditor.timezone}
                  onChangeText={timezone=>setLocationEditor({...locationEditor, timezone})}
                  autoCapitalize="none"
                />
                <View style={[ms.card,{ marginTop:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}>
                  <Text style={ms.rowTitle}>Active</Text>
                  <Switch value={locationEditor.active} onValueChange={active=>setLocationEditor({...locationEditor,active})} trackColor={{ true: BRAND, false: GRAY_200 }} thumbColor="#fff"/>
                </View>
                <TouchableOpacity
                  style={[s.btnPrimary, { marginTop:24, opacity: locationSaving || !locationEditor.name.trim() ? 0.5 : 1 }]}
                  disabled={locationSaving || !locationEditor.name.trim()}
                  accessibilityRole="button"
                  accessibilityLabel={locationEditor.id ? 'Save location changes' : 'Add location'}
                  onPress={saveLocation}>
                  <Text style={s.btnPrimaryText}>{locationSaving ? 'Saving…' : (locationEditor.id ? 'Save changes' : 'Add location')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'resources') return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
          accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={GRAY_700}/>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Rooms & Resources</Text>
        <TouchableOpacity onPress={()=>setResourceEditor({ name:'' })}
          accessibilityRole="button" accessibilityLabel="Add new resource">
          <Ionicons name="add" size={24} color={BRAND}/>
        </TouchableOpacity>
      </View>
      {loading ? loader : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          <Text style={[ms.empty,{ marginBottom:12 }]}>
            Shared rooms, chairs, or equipment. Assign one to a service to block it when already in use.
          </Text>

          {(resources ?? []).length === 0 ? (
            <View style={[ms.card, { alignItems:'center', paddingVertical:28 }]}>
              <Ionicons name="business-outline" size={32} color={GRAY_400}/>
              <Text style={[ms.rowTitle,{ marginTop:10, textAlign:'center' }]}>No resources yet</Text>
              <Text style={[ms.empty,{ marginTop:4, textAlign:'center' }]}>
                Tap + to add a room, chair, or piece of equipment.
              </Text>
            </View>
          ) : (
            <View style={ms.card}>
              {(resources ?? []).map((r, i, arr) => (
                <View key={r.id} style={[ms.notifRow, i < arr.length - 1 && ms.notifRowBorder]}>
                  {/* Active indicator dot */}
                  <View style={{
                    width:8, height:8, borderRadius:4, marginRight:10,
                    backgroundColor: r.active ? '#34d399' : GRAY_200,
                  }}/>

                  {/* Name + meta */}
                  <View style={{ flex:1 }}>
                    <Text style={[ms.rowTitle, !r.active && { color:GRAY_400, textDecorationLine:'line-through' }]}>
                      {r.name}
                    </Text>
                    <Text style={ms.rowMeta}>{r.active ? 'Active' : 'Inactive'}</Text>
                  </View>

                  {/* Action buttons */}
                  <View style={{ flexDirection:'row', gap:4 }}>
                    <TouchableOpacity
                      onPress={()=>toggleResource(r)}
                      accessibilityRole="button"
                      accessibilityLabel={r.active ? `Deactivate ${r.name}` : `Activate ${r.name}`}
                      style={{
                        paddingHorizontal:10, paddingVertical:4, borderRadius:12, borderWidth:1,
                        borderColor: r.active ? '#a7f3d0' : GRAY_200,
                        backgroundColor: r.active ? '#ecfdf5' : GRAY_50,
                      }}>
                      <Text style={{ fontSize:11, fontWeight:'600', color: r.active ? '#065f46' : GRAY_500 }}>
                        {r.active ? 'Active' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={()=>setResourceEditor({ id:r.id, name:r.name })}
                      accessibilityRole="button" accessibilityLabel="Edit resource"
                      style={{ padding:6, borderRadius:8, backgroundColor:GRAY_50 }}>
                      <Ionicons name="pencil-outline" size={15} color={GRAY_500}/>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={()=>deleteResource(r)}
                      accessibilityRole="button" accessibilityLabel="Delete resource"
                      style={{ padding:6, borderRadius:8, backgroundColor:'#fff0f0' }}>
                      <Ionicons name="trash-outline" size={15} color="#ef4444"/>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[s.btnPrimary, { marginTop:16 }]}
            onPress={()=>setResourceEditor({ name:'' })}
            accessibilityRole="button" accessibilityLabel="Add new resource">
            <Text style={s.btnPrimaryText}>+ Add resource</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Add / Edit modal */}
      <Modal visible={!!resourceEditor} animationType="slide" onRequestClose={()=>setResourceEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setResourceEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={GRAY_700}/>
            </TouchableOpacity>
            <Text style={s.headerTitle}>{resourceEditor?.id ? 'Edit resource' : 'New resource'}</Text>
          </View>
          {resourceEditor && (
            <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
              <ScrollView contentContainerStyle={s.listContent}>
                <Text style={s.fieldLabel}>Name</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Room 1, Chair 2, Laser"
                  placeholderTextColor={GRAY_400}
                  value={resourceEditor.name}
                  onChangeText={name=>setResourceEditor({...resourceEditor, name})}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveResource}
                />
                <Text style={[ms.empty,{ marginTop:8 }]}>
                  Give this room or piece of equipment a short, recognisable name.
                </Text>
                <TouchableOpacity
                  style={[s.btnPrimary, { marginTop:24, opacity: resourceSaving || !resourceEditor.name.trim() ? 0.5 : 1 }]}
                  disabled={resourceSaving || !resourceEditor.name.trim()}
                  accessibilityRole="button"
                  accessibilityLabel={resourceEditor.id ? 'Save resource changes' : 'Add resource'}
                  onPress={saveResource}>
                  <Text style={s.btnPrimaryText}>{resourceSaving ? 'Saving…' : (resourceEditor.id ? 'Save changes' : 'Add resource')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  if (view === 'hours') {
    function setHourRule(i: number, patch: Partial<typeof hourRules[0]>) {
      setHourRules(r => r.map((x, j) => j === i ? {...x, ...patch} : x));
    }
    function copyMonToWeekdays() {
      const mon = hourRules[1];
      if (!mon.enabled) { Alert.alert('Monday off','Enable Monday first to copy from it.'); return; }
      setHourRules(r => r.map((x,i) => i>=1&&i<=5 ? {...x, startTime:mon.startTime, endTime:mon.endTime, enabled:true} : x));
    }
    async function saveHours() {
      setHoursSaving(true);
      try {
        const enabled = hourRules.filter(r=>r.enabled).map(({dayOfWeek,startTime,endTime})=>({dayOfWeek,startTime,endTime}));
        await api(`/businesses/${bizId()}/hours`, { method:'POST', body: JSON.stringify({ hours: enabled }) });
        Alert.alert('Saved','Business hours updated.');
      } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not save.'); }
      finally { setHoursSaving(false); }
    }
    async function addClosure() {
      if (!closureForm.startsAt || !closureForm.endsAt) { Alert.alert('Missing','Enter start and end dates.'); return; }
      setClosureSaving(true);
      try {
        const c = await api<{ id:string; startsAt:string; endsAt:string; reason?:string }>(`/businesses/${bizId()}/closures`, {
          method:'POST',
          body: JSON.stringify({ startsAt: new Date(closureForm.startsAt).toISOString(), endsAt: new Date(closureForm.endsAt).toISOString(), reason: closureForm.reason||undefined }),
        });
        setClosures(prev=>[...prev, c]);
        setClosureForm({ startsAt:'', endsAt:'', reason:'' });
      } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not add closure.'); }
      finally { setClosureSaving(false); }
    }
    async function removeClosure(id: string) {
      try {
        await api(`/businesses/${bizId()}/closures/${id}`, { method:'DELETE' });
        setClosures(prev=>prev.filter(c=>c.id!==id));
      } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove.'); }
    }
    return (
      <SafeAreaView style={s.screen}>
        <View style={[s.header,{ flexDirection:'row', alignItems:'center' }]}>
          <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
            accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
          <Text style={[s.headerTitle,{ flex:1 }]}>Business Hours</Text>
        </View>
        {loading && !hoursLoaded ? loader : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            {/* Weekly schedule */}
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <Text style={ms.cardLabel}>WEEKLY SCHEDULE</Text>
              <TouchableOpacity onPress={copyMonToWeekdays}
                accessibilityRole="button" accessibilityLabel="Copy Monday hours to Tuesday through Friday">
                <Text style={{ color:BRAND, fontSize:12, fontWeight:'600' }}>Copy Mon → Tue–Fri</Text>
              </TouchableOpacity>
            </View>
            <View style={ms.card}>
              {hourRules.map((rule, i)=>(
                <View key={i} style={[{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8 }, i>0&&{ borderTopWidth:1, borderColor:GRAY_100 }]}>
                  <Switch
                    value={rule.enabled}
                    onValueChange={v=>setHourRule(i,{enabled:v})}
                    trackColor={{ false:GRAY_200, true:BRAND_LT }}
                    thumbColor={rule.enabled?BRAND:GRAY_400}
                  />
                  <Text style={[{ width:36, fontSize:13, fontWeight:'700' }, rule.enabled?{ color:GRAY_900 }:{ color:GRAY_400 }]}>
                    {DAYS_SHORT[i]}
                  </Text>
                  {rule.enabled ? (
                    <View style={{ flex:1, flexDirection:'row', alignItems:'center', gap:6 }}>
                      <TextInput
                        style={[s.input,{ flex:1, textAlign:'center', padding:8 }]}
                        value={rule.startTime}
                        onChangeText={v=>setHourRule(i,{startTime:v})}
                        placeholder="09:00"
                        placeholderTextColor={GRAY_400}
                        keyboardType="numbers-and-punctuation"
                      />
                      <Text style={{ color:GRAY_400, fontSize:13 }}>–</Text>
                      <TextInput
                        style={[s.input,{ flex:1, textAlign:'center', padding:8 }]}
                        value={rule.endTime}
                        onChangeText={v=>setHourRule(i,{endTime:v})}
                        placeholder="17:00"
                        placeholderTextColor={GRAY_400}
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                  ) : (
                    <Text style={{ color:GRAY_400, fontSize:13 }}>Closed</Text>
                  )}
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[s.btnPrimary, { marginTop:12, opacity:hoursSaving?0.5:1 }]}
              disabled={hoursSaving}
              accessibilityRole="button" accessibilityLabel="Save business hours"
              onPress={saveHours}>
              <Text style={s.btnPrimaryText}>{hoursSaving?'Saving…':'Save hours'}</Text>
            </TouchableOpacity>

            {/* Closures */}
            <Text style={[ms.cardLabel,{ marginTop:24, marginBottom:8 }]}>CLOSURES & TIME OFF</Text>
            <View style={ms.card}>
              <Text style={ms.rowMeta}>Enter start date/time and end date/time in format: YYYY-MM-DDTHH:MM</Text>
              {([
                { k:'startsAt' as const, label:'From (YYYY-MM-DDTHH:MM)' },
                { k:'endsAt'   as const, label:'To (YYYY-MM-DDTHH:MM)'   },
                { k:'reason'   as const, label:'Reason (optional)'         },
              ]).map(({k,label})=>(
                <View key={k} style={{ marginTop:10 }}>
                  <Text style={{ fontSize:11, color:GRAY_500, marginBottom:3 }}>{label}</Text>
                  <TextInput
                    style={s.input}
                    value={closureForm[k]}
                    onChangeText={v=>setClosureForm(p=>({...p,[k]:v}))}
                    placeholder={k==='reason'?'Holiday, Vacation…':'2026-12-25T00:00'}
                    placeholderTextColor={GRAY_400}
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[ms.methodChip,{ marginTop:12, opacity:closureSaving?0.5:1 }]}
                disabled={closureSaving}
                accessibilityRole="button" accessibilityLabel="Add closure"
                onPress={addClosure}>
                <Text style={ms.methodChipText}>{closureSaving?'Adding…':'+ Add closure'}</Text>
              </TouchableOpacity>
            </View>

            {closures.length > 0 && (
              <>
                <Text style={[ms.cardLabel,{ marginTop:16, marginBottom:6 }]}>UPCOMING CLOSURES</Text>
                {closures.map((c,i,arr)=>(
                  <View key={c.id} style={[ms.row, i<arr.length-1&&{ borderBottomWidth:1, borderColor:GRAY_100 }]}>
                    <View style={{ flex:1 }}>
                      <Text style={ms.rowTitle}>
                        {new Date(c.startsAt).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}
                        {' — '}
                        {new Date(c.endsAt).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}
                      </Text>
                      {c.reason && <Text style={ms.rowMeta}>{c.reason}</Text>}
                    </View>
                    <TouchableOpacity onPress={()=>removeClosure(c.id)} style={{ padding:8 }}
                      accessibilityRole="button" accessibilityLabel="Delete closure">
                      <Ionicons name="close-circle-outline" size={20} color="#EF4444"/>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (view === 'promo-codes') {
    async function savePromoCode() {
      if (!promoEditor) return;
      const val = Number(promoEditor.discountValue);
      if (!promoEditor.code.trim() || isNaN(val) || val <= 0) {
        Alert.alert('Missing info', 'Enter a code and a valid discount value.'); return;
      }
      try {
        const body = {
          code: promoEditor.code.trim().toUpperCase(),
          discountType: promoEditor.discountType,
          discountValue: val,
          maxUsages: promoEditor.maxUsages ? Number(promoEditor.maxUsages) : undefined,
          expiresAt: promoEditor.expiresAt || undefined,
          active: true,
        };
        if (promoEditor.id) {
          await api(`/businesses/${bizId()}/promo-codes/${promoEditor.id}`, { method:'PATCH', body: JSON.stringify(body) });
        } else {
          await api(`/businesses/${bizId()}/promo-codes`, { method:'POST', body: JSON.stringify(body) });
        }
        setPromoCodes(null); setPromoEditor(null);
        setLoading(true);
        setPromoCodes(await api<any[]>(`/businesses/${bizId()}/promo-codes`));
      } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not save promo code.'); }
      finally { setLoading(false); }
    }
    async function deletePromoCode(id: string) {
      Alert.alert('Delete promo code','This cannot be undone.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{
        try {
          await api(`/businesses/${bizId()}/promo-codes/${id}`, { method:'DELETE' });
          setPromoCodes(p => p?.filter(x=>x.id!==id) ?? null);
        } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete.'); }
      }}]);
    }
    return (
      <SafeAreaView style={s.screen}>
        <View style={[s.header,{ flexDirection:'row', alignItems:'center' }]}>
          <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
            accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
          <Text style={[s.headerTitle,{ flex:1 }]}>Promo Codes</Text>
          <TouchableOpacity onPress={()=>setPromoEditor({ code:'', discountType:'PERCENT', discountValue:'10', maxUsages:'', expiresAt:'' })}
            accessibilityRole="button" accessibilityLabel="Add new promo code">
            <Ionicons name="add" size={24} color={BRAND}/>
          </TouchableOpacity>
        </View>
        {loading ? loader : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            {(!promoCodes || promoCodes.length === 0) ? (
              <View style={[s.center,{ padding:40 }]}>
                <Ionicons name="pricetag-outline" size={40} color={GRAY_200}/>
                <Text style={[ms.empty,{ marginTop:10 }]}>No promo codes yet. Tap + to create one.</Text>
              </View>
            ) : promoCodes.map((pc,i,arr)=>(
              <TouchableOpacity key={pc.id} style={[ms.row, i<arr.length-1&&{ borderBottomWidth:1, borderColor:GRAY_100 }]}
                onPress={()=>setPromoEditor({ id:pc.id, code:pc.code, discountType:pc.discountType, discountValue:String(pc.discountValue), maxUsages:pc.maxUsages?String(pc.maxUsages):'', expiresAt:pc.expiresAt?pc.expiresAt.slice(0,10):'' })}
                accessibilityRole="button" accessibilityLabel={`Edit promo code ${pc.code}`}>
                <View style={{ flex:1 }}>
                  <Text style={ms.rowTitle}>{pc.code}</Text>
                  <Text style={ms.rowMeta}>
                    {pc.discountType==='PERCENT' ? `${pc.discountValue}% off` : `$${(pc.discountValue/100).toFixed(2)} off`}
                    {pc.maxUsages ? ` · ${pc.usageCount}/${pc.maxUsages} used` : ` · ${pc.usageCount} used`}
                    {!pc.active && ' · Inactive'}
                  </Text>
                </View>
                <TouchableOpacity onPress={()=>deletePromoCode(pc.id)} style={{ padding:8 }}
                  accessibilityRole="button" accessibilityLabel="Delete promo code">
                  <Ionicons name="trash-outline" size={18} color="#EF4444"/>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <Modal visible={!!promoEditor} animationType="slide" presentationStyle="formSheet" onRequestClose={()=>setPromoEditor(null)}>
          <SafeAreaView style={s.screen}>
            <View style={[s.header,{ flexDirection:'row', alignItems:'center' }]}>
              <TouchableOpacity onPress={()=>setPromoEditor(null)} style={{ marginRight:6 }}
                accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
              <Text style={s.headerTitle}>{promoEditor?.id ? 'Edit code' : 'New promo code'}</Text>
            </View>
            <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
              <ScrollView contentContainerStyle={{ padding:16 }}>
                {(
                  [
                    { k:'code' as const, label:'Code', ph:'SUMMER20', upper:true, numeric:false },
                    { k:'discountValue' as const, label:'Discount amount', ph:'10', upper:false, numeric:true },
                    { k:'maxUsages' as const, label:'Max usages (leave blank = unlimited)', ph:'100', upper:false, numeric:true },
                    { k:'expiresAt' as const, label:'Expires (YYYY-MM-DD, leave blank = never)', ph:'2026-12-31', upper:false, numeric:false },
                  ]
                ).map(({k,label,ph,upper,numeric})=>(
                  <View key={k} style={{ marginBottom:12 }}>
                    <Text style={s.fieldLabel}>{label}</Text>
                    <TextInput style={s.input} placeholder={ph} placeholderTextColor={GRAY_400}
                      keyboardType={numeric?'numeric':'default'}
                      autoCapitalize={upper?'characters':'none'}
                      value={promoEditor?.[k] ?? ''}
                      onChangeText={v=>setPromoEditor(p=>p?({...p,[k]:upper?v.toUpperCase():v}):p)}/>
                  </View>
                ))}
                <Text style={s.fieldLabel}>Discount type</Text>
                <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                  {(['PERCENT','FLAT'] as const).map(t=>(
                    <TouchableOpacity key={t} onPress={()=>setPromoEditor(p=>p?({...p,discountType:t}):p)}
                      style={[s.slotBtn, promoEditor?.discountType===t&&s.slotBtnActive]}
                      accessibilityRole="button"
                      accessibilityLabel={t==='PERCENT'?'Percent':'Flat dollar'}
                      accessibilityState={{ selected: promoEditor?.discountType===t }}>
                      <Text style={[s.slotText, promoEditor?.discountType===t&&s.slotTextActive]}>{t==='PERCENT'?'Percent':'Flat $'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.btnPrimary} onPress={savePromoCode}
                  accessibilityRole="button"
                  accessibilityLabel={promoEditor?.id ? 'Save promo code changes' : 'Create promo code'}>
                  <Text style={s.btnPrimaryText}>{promoEditor?.id ? 'Save changes' : 'Create code'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  if (view === 'memberships') {
    async function cancelMembership(id: string) {
      Alert.alert('Cancel membership','The member will keep access until their period ends.',[{text:'Keep',style:'cancel'},{text:'Cancel membership',style:'destructive',onPress:async()=>{
        try {
          await api(`/businesses/${bizId()}/memberships/${id}/cancel`, { method:'PATCH' });
          setMembershipMembers(m => m?.map(x=>x.id===id?{...x,status:'CANCELLED'}:x) ?? null);
        } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not cancel.'); }
      }}]);
    }
    const activeCount = (membershipMembers??[]).filter(m=>m.status==='ACTIVE').length;
    const mrr = (membershipMembers??[]).filter(m=>m.status==='ACTIVE').reduce((sum,m)=>{
      const plan = (membershipPlans??[]).find(p=>p.id===m.planId);
      return sum + (plan?.priceMonthly ?? 0);
    }, 0);
    return (
      <SafeAreaView style={s.screen}>
        <View style={[s.header,{ flexDirection:'row', alignItems:'center' }]}>
          <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}
            accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
          <Text style={s.headerTitle}>Memberships</Text>
        </View>
        {loading ? loader : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            <View style={[ms.card,{ flexDirection:'row', gap:0 }]}>
              <View style={{ flex:1, alignItems:'center' }}>
                <Text style={{ fontSize:24, fontWeight:'800', color:BRAND }}>{activeCount}</Text>
                <Text style={ms.rowMeta}>Active members</Text>
              </View>
              <View style={{ width:1, backgroundColor:GRAY_100 }}/>
              <View style={{ flex:1, alignItems:'center' }}>
                <Text style={{ fontSize:24, fontWeight:'800', color:BRAND }}>${(mrr/100).toFixed(0)}</Text>
                <Text style={ms.rowMeta}>MRR / mo</Text>
              </View>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:18, marginBottom:6, marginHorizontal:2 }}>
              <Text style={ms.cardLabel}>PLANS</Text>
              <TouchableOpacity onPress={()=>setMembershipPlanEditor({ name:'', priceMonthly:'', description:'' })}
                accessibilityRole="button" accessibilityLabel="Add new membership plan">
                <Text style={{ fontSize:13, color:BRAND, fontWeight:'600' }}>+ New plan</Text>
              </TouchableOpacity>
            </View>
            {(!membershipPlans || membershipPlans.length===0) ? (
              <Text style={[ms.empty,{ marginLeft:2 }]}>No plans yet. Tap + New plan to create one.</Text>
            ) : membershipPlans.map((p,i,arr)=>(
              <View key={p.id} style={[ms.row, i<arr.length-1&&{ borderBottomWidth:1, borderColor:GRAY_100 }]}>
                <View style={{ flex:1 }}>
                  <Text style={ms.rowTitle}>{p.name}</Text>
                  <Text style={ms.rowMeta}>${(p.priceMonthly/100).toFixed(0)}/mo{!p.active ? ' · Inactive' : ''}</Text>
                </View>
                <TouchableOpacity onPress={()=>setMembershipPlanEditor({ id:p.id, name:p.name, priceMonthly:String((p.priceMonthly/100).toFixed(2)), description:p.description??'' })} style={{ padding:8 }}
                  accessibilityRole="button" accessibilityLabel="Edit plan">
                  <Ionicons name="pencil-outline" size={17} color={GRAY_500}/>
                </TouchableOpacity>
                <TouchableOpacity onPress={async()=>{
                  Alert.alert('Delete plan',`Delete "${p.name}"? This cannot be undone.`,[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{
                    try {
                      await api(`/businesses/${bizId()}/memberships/plans/${p.id}`, { method:'DELETE' });
                      setMembershipPlans(prev=>(prev??[]).filter(x=>x.id!==p.id));
                    } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete.'); }
                  }}]);
                }} style={{ padding:8 }}
                  accessibilityRole="button" accessibilityLabel="Delete plan">
                  <Ionicons name="trash-outline" size={17} color="#EF4444"/>
                </TouchableOpacity>
              </View>
            ))}
            <Text style={[ms.cardLabel,{ marginTop:18, marginBottom:6, marginLeft:2 }]}>ACTIVE MEMBERS</Text>
            {(!membershipMembers || membershipMembers.filter(m=>m.status==='ACTIVE').length===0) ? (
              <Text style={[ms.empty,{ marginLeft:2 }]}>No active members yet.</Text>
            ) : membershipMembers.filter(m=>m.status==='ACTIVE').map((m,i,arr)=>(
              <View key={m.id} style={[ms.row, i<arr.length-1&&{ borderBottomWidth:1, borderColor:GRAY_100 }]}>
                <View style={{ flex:1 }}>
                  <Text style={ms.rowTitle}>{m.client?.name ?? 'Client'}</Text>
                  <Text style={ms.rowMeta}>{(membershipPlans??[]).find(p=>p.id===m.planId)?.name ?? 'Plan'} · renews {m.currentPeriodEnd ? new Date(m.currentPeriodEnd).toLocaleDateString('en-CA') : '—'}</Text>
                </View>
                <TouchableOpacity onPress={()=>cancelMembership(m.id)} style={{ padding:8 }}
                  accessibilityRole="button" accessibilityLabel="Cancel membership">
                  <Ionicons name="close-circle-outline" size={20} color="#EF4444"/>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        {/* Membership plan create / edit modal */}
        <Modal visible={!!membershipPlanEditor} animationType="slide" onRequestClose={()=>setMembershipPlanEditor(null)}>
          <SafeAreaView style={s.screen}>
            <View style={s.header}>
              <TouchableOpacity onPress={()=>setMembershipPlanEditor(null)} style={{ marginRight:6 }}
                accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
              <Text style={s.headerTitle}>{membershipPlanEditor?.id ? 'Edit plan' : 'New plan'}</Text>
            </View>
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.fieldLabel}>Plan name</Text>
              <TextInput style={s.input} placeholder="e.g. Monthly VIP" placeholderTextColor={GRAY_400}
                value={membershipPlanEditor?.name??''} onChangeText={name=>setMembershipPlanEditor(e=>e&&({...e,name}))}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Monthly price ($)</Text>
              <TextInput style={s.input} placeholder="29.99" placeholderTextColor={GRAY_400} keyboardType="decimal-pad"
                value={membershipPlanEditor?.priceMonthly??''} onChangeText={priceMonthly=>setMembershipPlanEditor(e=>e&&({...e,priceMonthly}))}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Description (optional)</Text>
              <TextInput style={[s.input,{ height:72, textAlignVertical:'top' }]} multiline placeholder="What's included…" placeholderTextColor={GRAY_400}
                value={membershipPlanEditor?.description??''} onChangeText={description=>setMembershipPlanEditor(e=>e&&({...e,description}))}/>
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:20 }]} disabled={membershipPlanSaving||!membershipPlanEditor?.name.trim()||!membershipPlanEditor?.priceMonthly}
                accessibilityRole="button"
                accessibilityLabel={membershipPlanEditor?.id ? 'Save membership plan changes' : 'Save membership plan'}
                onPress={async()=>{
                  if (!membershipPlanEditor) return;
                  const price = parseFloat(membershipPlanEditor.priceMonthly);
                  if (!price || price<=0) { Alert.alert('Invalid price','Enter a valid monthly price.'); return; }
                  setMembershipPlanSaving(true);
                  try {
                    const payload = { name:membershipPlanEditor.name.trim(), description:membershipPlanEditor.description.trim()||undefined, priceMonthly:Math.round(price*100) };
                    if (membershipPlanEditor.id) {
                      const updated = await api<any>(`/businesses/${bizId()}/memberships/plans/${membershipPlanEditor.id}`, { method:'PATCH', body:JSON.stringify(payload) });
                      setMembershipPlans(prev=>(prev??[]).map(x=>x.id===membershipPlanEditor.id?updated:x));
                    } else {
                      const created = await api<any>(`/businesses/${bizId()}/memberships/plans`, { method:'POST', body:JSON.stringify(payload) });
                      setMembershipPlans(prev=>[...(prev??[]), created]);
                    }
                    setMembershipPlanEditor(null);
                  } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not save plan.'); }
                  finally { setMembershipPlanSaving(false); }
                }}>
                <Text style={s.btnPrimaryText}>{membershipPlanSaving ? 'Saving…' : 'Save plan'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  if (view === 'soon') return (
    <SafeAreaView style={s.screen}>
      {head(soonLabel)}
      <View style={[s.center,{ padding:32 }]}>
        <View style={ms.soonIcon}><Ionicons name="construct-outline" size={28} color={BRAND}/></View>
        <Text style={[ms.rowTitle,{ marginTop:14, textAlign:'center' }]}>{soonLabel} is coming to the app</Text>
        <Text style={[ms.empty,{ marginTop:6, textAlign:'center' }]}>Manage {soonLabel.toLowerCase()} on the web dashboard for now.</Text>
      </View>
    </SafeAreaView>
  );

  if (view === 'settings') return (
    <SafeAreaView style={s.screen}>
      {head('Settings')}
      {loading ? loader : (
        <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
          <View style={ms.card}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
              <Text style={ms.cardLabel}>Business</Text>
              <TouchableOpacity onPress={pickLogo} disabled={logoBusy}
                accessibilityRole="button" accessibilityLabel="Change business logo">
                <Text style={{ fontSize:13, color:BRAND, fontWeight:'600' }}>{logoBusy ? 'Uploading...' : 'Change logo'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <TouchableOpacity onPress={pickLogo} disabled={logoBusy}
                accessibilityRole="button" accessibilityLabel="Change business logo">
                {biz?.logoUrl ? (
                  <Image source={{ uri: uploadUri(biz.logoUrl)! }} style={s.bizLogoImg} contentFit="cover"
                    accessible={true} accessibilityLabel="Business logo"/>
                ) : (
                  <View style={[s.bizLogoImg, { alignItems:'center', justifyContent:'center' }]}><Ionicons name="image-outline" size={24} color={GRAY_400}/></View>
                )}
              </TouchableOpacity>
              <Text style={ms.cardValue}>{biz?.name ?? '—'}</Text>
              {(biz as any)?.verificationStatus === 'VERIFIED' && <VerifiedPill/>}
            </View>
          </View>
          <Text style={[ms.cardLabel,{ marginTop:4, marginBottom:6, marginLeft:2 }]}>PLAN</Text>
          {PLANS.map(p => {
            const current = ((biz as any)?.plan ?? 'FREE') === p.id;
            return (
              <View key={p.id} style={[ms.card, current && { borderColor:BRAND, borderWidth:1.5 }]}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                  <View style={{ flexDirection:'row', alignItems:'baseline', gap:6 }}>
                    <Text style={ms.cardValue}>{p.name}</Text>
                    <Text style={ms.rowMeta}>{p.price}{p.period}</Text>
                  </View>
                  {current
                    ? <View style={[s.pill,{ borderColor:BRAND+'33', backgroundColor:BRAND_LT }]}><Text style={[s.pillText,{ color:BRAND }]}>Current</Text></View>
                    : <Text style={[ms.rowMeta,{ color:GRAY_400 }]}>Soon</Text>}
                </View>
                <View style={{ marginTop:8, gap:4 }}>
                  {p.features.map(f => (
                    <View key={f} style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                      <Ionicons name="checkmark" size={14} color={current ? BRAND : GRAY_400}/>
                      <Text style={ms.rowMeta}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          <View style={ms.card}>
            <Text style={ms.cardLabel}>Cancellation window</Text>
            <Text style={ms.cardValue}>{(biz as any)?.cancellationWindowHours ?? 24} hours</Text>
          </View>
          <View style={ms.card}>
            <Text style={ms.cardLabel}>Deposit required</Text>
            <Text style={ms.cardValue}>{(biz as any)?.requireDeposit ? `Yes · ${(biz as any)?.depositPercent ?? 25}%` : 'No'}</Text>
          </View>
          <TouchableOpacity style={[s.btnPrimary,{ marginBottom:14 }]}
            accessibilityRole="button" accessibilityLabel="Edit business settings"
            onPress={()=>setSettingsEditor({
            name: biz?.name ?? '',
            email: biz?.email ?? '',
            phone: formatPhoneDisplay(biz?.phone),
            address: biz?.address ?? '',
            minNoticeMinutes: String(biz?.minNoticeMinutes ?? 120),
            maxAdvanceDays: String(biz?.maxAdvanceDays ?? 60),
            cancellationWindowHours: String(biz?.cancellationWindowHours ?? 24),
            requireDeposit: !!biz?.requireDeposit,
            depositPercent: String(biz?.depositPercent ?? 25),
            cancellationPolicy: biz?.cancellationPolicy ?? '',
          })}>
            <Text style={s.btnPrimaryText}>Edit business settings</Text>
          </TouchableOpacity>

          <Text style={[ms.cardLabel,{ marginTop:14, marginBottom:6, marginLeft:2 }]}>MY PROFILE</Text>
          <View style={ms.card}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <View>
                <Text style={ms.cardValue}>{user?.name ?? '—'}</Text>
                <Text style={ms.rowMeta}>{user?.email}</Text>
              </View>
              <TouchableOpacity onPress={()=>setProfileEditor({ name: user?.name ?? '', phone: (user as any)?.phone ?? '' })}
                accessibilityRole="button" accessibilityLabel="Edit profile">
                <Text style={{ fontSize:13, color:BRAND, fontWeight:'600' }}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          {user?.role === 'OWNER' && (
            <>
              <Text style={[ms.cardLabel,{ marginTop:14, marginBottom:6, marginLeft:2 }]}>GOOGLE CALENDAR</Text>
              <View style={ms.card}>
                {calSyncStatus ? (
                  calSyncStatus.connected ? (
                    <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                      <View style={{ flex:1, paddingRight:12 }}>
                        <Text style={ms.cardValue}>Connected</Text>
                        <Text style={ms.rowMeta}>{calSyncStatus.email}</Text>
                        {calSyncStatus.since && <Text style={[ms.rowMeta,{color:GRAY_400}]}>Since {new Date(calSyncStatus.since).toLocaleDateString()}</Text>}
                      </View>
                      <TouchableOpacity disabled={calSyncBusy} style={[ms.methodChip,{ flex:0, paddingHorizontal:16 }]}
                        accessibilityRole="button" accessibilityLabel="Disconnect Google Calendar"
                        onPress={async()=>{
                          setCalSyncBusy(true);
                          try {
                            await api('/calendar-sync/google/disconnect', { method:'POST' });
                            setCalSyncStatus(s=>s?{ ...s, connected:false, email:null, since:null }:s);
                          } catch(e) { Alert.alert('Could not disconnect', e instanceof Error ? e.message : 'Please try again.'); }
                          finally { setCalSyncBusy(false); }
                        }}>
                        <Text style={ms.methodChipText}>{calSyncBusy ? 'Disconnecting…' : 'Disconnect'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                      <View style={{ flex:1, paddingRight:12 }}>
                        <Text style={ms.cardValue}>Not connected</Text>
                        <Text style={ms.rowMeta}>Sync appointments to your Google Calendar automatically.</Text>
                      </View>
                      <TouchableOpacity disabled={calSyncBusy} style={[ms.methodChip,{ flex:0, paddingHorizontal:16 }, ms.methodChipOn]}
                        accessibilityRole="button" accessibilityLabel="Connect Google Calendar"
                        onPress={async()=>{
                          setCalSyncBusy(true);
                          try {
                            const { url } = await api<{url:string}>('/calendar-sync/google/connect');
                            await Linking.openURL(url);
                          } catch(e) { Alert.alert('Could not connect', e instanceof Error ? e.message : 'Please try again.'); }
                          finally { setCalSyncBusy(false); }
                        }}>
                        <Text style={[ms.methodChipText,{ color:BRAND }]}>{calSyncBusy ? 'Loading…' : 'Connect'}</Text>
                      </TouchableOpacity>
                    </View>
                  )
                ) : (
                  <ActivityIndicator size="small" color={BRAND}/>
                )}
              </View>
            </>
          )}

          {user?.role === 'OWNER' && (verifStatus === 'UNVERIFIED' || verifStatus === 'REJECTED') && (
            <>
              <Text style={[ms.cardLabel,{ marginTop:14, marginBottom:6, marginLeft:2 }]}>BUSINESS VERIFICATION</Text>
              <View style={ms.card}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                  <View style={{ flex:1, paddingRight:12 }}>
                    <Text style={ms.cardValue}>{verifStatus === 'REJECTED' ? 'Verification rejected' : 'Not verified'}</Text>
                    <Text style={ms.rowMeta}>Submit documents to get a verified badge on your booking page.</Text>
                    {verifStatus === 'REJECTED' && <Text style={[ms.rowMeta,{color:'#DC2626',marginTop:2}]}>Your previous submission was rejected. Please resubmit.</Text>}
                  </View>
                  <TouchableOpacity onPress={()=>setVerifEditor({ legalName:'', address:'', phone:'', govIdUrl:'', regDocUrl:'' })}
                    accessibilityRole="button" accessibilityLabel="Submit verification documents">
                    <Text style={{ fontSize:13, color:BRAND, fontWeight:'600' }}>Submit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
          {user?.role === 'OWNER' && verifStatus === 'PENDING' && (
            <>
              <Text style={[ms.cardLabel,{ marginTop:14, marginBottom:6, marginLeft:2 }]}>BUSINESS VERIFICATION</Text>
              <View style={ms.card}>
                <Text style={ms.cardValue}>Under review</Text>
                <Text style={ms.rowMeta}>Your verification documents are being reviewed. This usually takes 1–2 business days.</Text>
              </View>
            </>
          )}

          <Text style={[ms.cardLabel,{ marginTop:14, marginBottom:6, marginLeft:2 }]}>WEB DASHBOARD</Text>
          <View style={ms.card}>
            <TouchableOpacity style={[ms.notifRow, ms.notifRowBorder]} onPress={()=>Linking.openURL(`${WEB_URL}/dashboard/settings`)}
              accessibilityRole="button" accessibilityLabel="Open business settings on web">
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                <Ionicons name="storefront-outline" size={20} color={BRAND}/>
                <Text style={ms.rowTitle}>Business settings</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={GRAY_400}/>
            </TouchableOpacity>
            <TouchableOpacity style={[ms.notifRow, ms.notifRowBorder]} onPress={()=>Linking.openURL(`${WEB_URL}/dashboard/settings?tab=billing`)}
              accessibilityRole="button" accessibilityLabel="Open billing and plan on web">
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                <Ionicons name="card-outline" size={20} color={BRAND}/>
                <Text style={ms.rowTitle}>Billing and plan</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={GRAY_400}/>
            </TouchableOpacity>
            <TouchableOpacity style={ms.notifRow} onPress={()=>Linking.openURL(`${WEB_URL}/dashboard/notifications`)}
              accessibilityRole="button" accessibilityLabel="Open delivery logs on web">
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                <Ionicons name="notifications-outline" size={20} color={BRAND}/>
                <Text style={ms.rowTitle}>Delivery logs</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={GRAY_400}/>
            </TouchableOpacity>
          </View>

          <Text style={[ms.cardLabel,{ marginTop:14, marginBottom:6, marginLeft:2 }]}>SECURITY</Text>
          <TouchableOpacity style={[ms.card,{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 }]}
            onPress={()=>setChangePwEditor({ current:'', next:'', confirm:'' })}
            accessibilityRole="button" accessibilityLabel="Change password">
            <View>
              <Text style={ms.cardValue}>Change password</Text>
              <Text style={[ms.rowMeta,{ marginTop:2 }]}>Update your account password.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={GRAY_400}/>
          </TouchableOpacity>
          <View style={ms.card}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <View style={{ flex:1, paddingRight:12 }}>
                <Text style={ms.cardValue}>Two-factor sign-in</Text>
                <Text style={[ms.rowMeta,{ marginTop:2 }]}>Ask for a one-time code after your password.</Text>
              </View>
              <Switch
                value={twoFA}
                disabled={twoFASaving}
                onValueChange={(v)=>requestTwoFA(v, twoFAMethod)}
                trackColor={{ true: BRAND, false: GRAY_200 }}
                thumbColor="#fff"
              />
            </View>
            {twoFA && (
              <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                {(['EMAIL','SMS'] as const).map(m => (
                  <TouchableOpacity key={m} disabled={twoFASaving} onPress={()=>requestTwoFA(true, m)}
                    style={[ms.methodChip, twoFAMethod===m && ms.methodChipOn]}
                    accessibilityRole="button"
                    accessibilityLabel={m==='EMAIL'?'Two-factor via Email':'Two-factor via Text message'}
                    accessibilityState={{ selected: twoFAMethod===m }}>
                    <Text style={[ms.methodChipText, twoFAMethod===m && { color:BRAND }]}>{m==='EMAIL'?'Email':'Text message'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {twoFA && twoFAMethod==='SMS' && (
              <Text style={[ms.rowMeta,{ color:'#B45309', marginTop:8 }]}>Add a mobile number to your account — codes fall back to email otherwise.</Text>
            )}
          </View>

          {bioAvailable && (
            <View style={ms.card}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <View style={{ flex:1, paddingRight:12 }}>
                  <Text style={ms.cardValue}>Unlock with {bioLabel}</Text>
                  <Text style={[ms.rowMeta,{ marginTop:2 }]}>Require {bioLabel} when reopening the app.</Text>
                </View>
                <Switch
                  value={bioEnabled}
                  disabled={bioSaving}
                  onValueChange={toggleBiometric}
                  trackColor={{ true: BRAND, false: GRAY_200 }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          )}

          {recoveryCodes && (
            <View style={ms.recoveryBox}>
              <Text style={ms.recoveryTitle} accessibilityLiveRegion="polite">Save your recovery codes</Text>
              <Text style={ms.recoverySub}>Each works once. If you can&apos;t receive your code, enter one of these to sign in. They won&apos;t be shown again.</Text>
              <View style={ms.recoveryGrid}>
                {recoveryCodes.map(c => <Text key={c} style={ms.recoveryCode}>{c}</Text>)}
              </View>
              <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
                <TouchableOpacity style={[ms.methodChip,{ flex:1 }]} onPress={()=>setRecoveryCodes(null)}
                  accessibilityRole="button" accessibilityLabel="Dismiss recovery codes, I have saved them">
                  <Text style={ms.methodChipText}>I&apos;ve saved them</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {user?.role === 'OWNER' && (
            <>
              <Text style={[ms.cardLabel,{ marginTop:14, marginBottom:6, marginLeft:2 }]}>ACCOUNT</Text>
              <View style={ms.card}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                  <View style={{ flex:1, paddingRight:12 }}>
                    <Text style={ms.cardValue}>{(biz as any)?.suspended ? 'Business paused' : 'Pause business'}</Text>
                    <Text style={[ms.rowMeta,{ marginTop:2 }]}>
                      {(biz as any)?.suspended
                        ? 'Your booking page is hidden — reactivate any time.'
                        : 'Hide your booking page and stop new online bookings. Nothing is deleted.'}
                    </Text>
                  </View>
                  <TouchableOpacity disabled={acctBusy} onPress={toggleActive}
                    style={[ms.methodChip, { flex:0, paddingHorizontal:16 }, (biz as any)?.suspended && ms.methodChipOn]}
                    accessibilityRole="button"
                    accessibilityLabel={(biz as any)?.suspended ? 'Reactivate business' : 'Pause business'}>
                    <Text style={[ms.methodChipText, (biz as any)?.suspended && { color:BRAND }]}>{(biz as any)?.suspended ? 'Reactivate' : 'Pause'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Kept intentionally quiet — a muted text link, not an advertised
                  red button. The confirm dialog spells out that it's permanent. */}
              <TouchableOpacity disabled={acctBusy} onPress={confirmDelete} style={{ paddingVertical:16, alignItems:'center' }}
                accessibilityRole="button" accessibilityLabel="Delete business permanently">
                <Text style={{ fontSize:12, color:GRAY_400, fontWeight:'400' }}>Delete business</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={[ms.empty,{ marginTop:8 }]}>Advanced business settings, billing, and delivery-log controls are available on the web dashboard.</Text>
        </ScrollView>
      )}
      {/* User profile editor modal */}
      <Modal visible={!!profileEditor} animationType="slide" onRequestClose={()=>setProfileEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setProfileEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>My profile</Text>
          </View>
          {profileEditor && (
            <ScrollView contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Display name</Text>
              <TextInput style={s.input} value={profileEditor.name} onChangeText={v=>setProfileEditor(e=>e?{...e,name:v}:e)}
                autoCapitalize="words" returnKeyType="next"/>
              <Text style={s.fieldLabel}>Phone</Text>
              <TextInput style={s.input} value={profileEditor.phone} onChangeText={v=>setProfileEditor(e=>e?{...e,phone:v}:e)}
                keyboardType="phone-pad" returnKeyType="done"/>
              <TouchableOpacity style={[s.btnPrimary,{marginTop:14}]} disabled={profileSaving} onPress={saveProfile}
                accessibilityRole="button" accessibilityLabel="Save profile">
                <Text style={s.btnPrimaryText}>{profileSaving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Verification submission modal */}
      <Modal visible={!!verifEditor} animationType="slide" onRequestClose={()=>setVerifEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setVerifEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Request verification</Text>
          </View>
          {verifEditor && (
            <ScrollView contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled">
              <Text style={[ms.rowMeta,{marginBottom:16}]}>Provide your legal business details. We'll review and add a verified badge to your booking page.</Text>
              <Text style={s.fieldLabel}>Legal business name *</Text>
              <TextInput style={s.input} value={verifEditor.legalName} onChangeText={v=>setVerifEditor(e=>e?{...e,legalName:v}:e)} autoCapitalize="words" returnKeyType="next"/>
              <Text style={s.fieldLabel}>Business address *</Text>
              <TextInput style={s.input} value={verifEditor.address} onChangeText={v=>setVerifEditor(e=>e?{...e,address:v}:e)} autoCapitalize="words" returnKeyType="next"/>
              <Text style={s.fieldLabel}>Business phone *</Text>
              <TextInput style={s.input} value={verifEditor.phone} onChangeText={v=>setVerifEditor(e=>e?{...e,phone:v}:e)} keyboardType="phone-pad" returnKeyType="next"/>
              <Text style={[s.fieldLabel,{marginTop:12}]}>Government-issued ID *</Text>
              <TouchableOpacity style={[s.btnSecondary,{marginBottom:8}]} onPress={()=>pickVerifDoc('govIdUrl')}
                accessibilityRole="button" accessibilityLabel="Upload government ID">
                <Text style={s.btnSecondaryText}>{verifEditor.govIdUrl ? 'Change document' : 'Upload document'}</Text>
              </TouchableOpacity>
              {!!verifEditor.govIdUrl && <Text style={[ms.rowMeta,{color:'#10B981',marginBottom:8}]}>Document uploaded</Text>}
              <Text style={s.fieldLabel}>Business registration document *</Text>
              <TouchableOpacity style={[s.btnSecondary,{marginBottom:8}]} onPress={()=>pickVerifDoc('regDocUrl')}
                accessibilityRole="button" accessibilityLabel="Upload registration document">
                <Text style={s.btnSecondaryText}>{verifEditor.regDocUrl ? 'Change document' : 'Upload document'}</Text>
              </TouchableOpacity>
              {!!verifEditor.regDocUrl && <Text style={[ms.rowMeta,{color:'#10B981',marginBottom:8}]}>Document uploaded</Text>}
              <TouchableOpacity style={[s.btnPrimary,{marginTop:14,opacity:verifSaving?0.6:1}]} disabled={verifSaving} onPress={submitVerification}
                accessibilityRole="button" accessibilityLabel="Submit for verification">
                <Text style={s.btnPrimaryText}>{verifSaving ? 'Submitting…' : 'Submit for verification'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Change password modal */}
      <Modal visible={!!changePwEditor} animationType="slide" onRequestClose={()=>setChangePwEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setChangePwEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Change password</Text>
          </View>
          <ScrollView contentContainerStyle={s.listContent}>
            <Text style={s.fieldLabel}>Current password</Text>
            <TextInput style={s.input} secureTextEntry placeholder="••••••••" placeholderTextColor={GRAY_400}
              value={changePwEditor?.current??''} onChangeText={current=>setChangePwEditor(e=>e&&({...e,current}))}/>
            <Text style={[s.fieldLabel,{ marginTop:12 }]}>New password</Text>
            <TextInput style={s.input} secureTextEntry placeholder="Min 8 characters" placeholderTextColor={GRAY_400}
              value={changePwEditor?.next??''} onChangeText={next=>setChangePwEditor(e=>e&&({...e,next}))}/>
            <Text style={[s.fieldLabel,{ marginTop:12 }]}>Confirm new password</Text>
            <TextInput style={s.input} secureTextEntry placeholder="Repeat new password" placeholderTextColor={GRAY_400}
              value={changePwEditor?.confirm??''} onChangeText={confirm=>setChangePwEditor(e=>e&&({...e,confirm}))}/>
            <TouchableOpacity style={[s.btnPrimary,{ marginTop:20 }]} disabled={changePwSaving}
              accessibilityRole="button" accessibilityLabel="Update password"
              onPress={async()=>{
                if (!changePwEditor) return;
                if (changePwEditor.next.length < 8) { Alert.alert('Too short','New password must be at least 8 characters.'); return; }
                if (changePwEditor.next !== changePwEditor.confirm) { Alert.alert('Mismatch','New passwords do not match.'); return; }
                setChangePwSaving(true);
                try {
                  await api('/auth/change-password', { method:'PATCH', body: JSON.stringify({ currentPassword:changePwEditor.current, newPassword:changePwEditor.next }) });
                  setChangePwEditor(null);
                  Alert.alert('Password updated','Your password has been changed successfully.');
                } catch(e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not change password.'); }
                finally { setChangePwSaving(false); }
              }}>
              <Text style={s.btnPrimaryText}>{changePwSaving ? 'Saving…' : 'Update password'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={!!settingsEditor} animationType="slide" onRequestClose={()=>setSettingsEditor(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={()=>setSettingsEditor(null)} style={{ marginRight:6 }}
              accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
            <Text style={s.headerTitle}>Business settings</Text>
          </View>
          {settingsEditor && (
            <ScrollView contentContainerStyle={s.listContent}>
              <Text style={s.fieldLabel}>Business name</Text>
              <TextInput style={s.input} value={settingsEditor.name} onChangeText={name=>setSettingsEditor({...settingsEditor,name})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Email</Text>
              <TextInput style={s.input} value={settingsEditor.email} autoCapitalize="none" keyboardType="email-address" onChangeText={email=>setSettingsEditor({...settingsEditor,email})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Phone</Text>
              <TextInput style={s.input} value={settingsEditor.phone} keyboardType="phone-pad" placeholder="+1 (416) 555-0123" placeholderTextColor={GRAY_400} onChangeText={phone=>setSettingsEditor({...settingsEditor,phone:formatPhoneInput(phone)})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Address</Text>
              <TextInput style={s.input} value={settingsEditor.address} onChangeText={address=>setSettingsEditor({...settingsEditor,address})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Minimum notice minutes</Text>
              <TextInput style={s.input} value={settingsEditor.minNoticeMinutes} keyboardType="number-pad" onChangeText={minNoticeMinutes=>setSettingsEditor({...settingsEditor,minNoticeMinutes})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Maximum advance days</Text>
              <TextInput style={s.input} value={settingsEditor.maxAdvanceDays} keyboardType="number-pad" onChangeText={maxAdvanceDays=>setSettingsEditor({...settingsEditor,maxAdvanceDays})}/>
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Cancellation window hours</Text>
              <TextInput style={s.input} value={settingsEditor.cancellationWindowHours} keyboardType="number-pad" onChangeText={cancellationWindowHours=>setSettingsEditor({...settingsEditor,cancellationWindowHours})}/>
              <Text style={s.fieldHint}>Clients can cancel for free until this many hours before the appointment.</Text>

              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Cancellation policy text</Text>
              <TextInput
                style={[s.input, { height:80, textAlignVertical:'top' }]}
                multiline
                numberOfLines={3}
                placeholder="Appointments cancelled within 24 hours..."
                placeholderTextColor={GRAY_400}
                value={settingsEditor.cancellationPolicy}
                onChangeText={cancellationPolicy=>setSettingsEditor({...settingsEditor,cancellationPolicy})}
              />

              <Text style={[s.fieldLabel,{ marginTop:14 }]}>Require deposit</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                {([['No', false],['Yes', true]] as const).map(([label, val]) => {
                  const on = settingsEditor.requireDeposit === val;
                  return (
                    <TouchableOpacity key={label} onPress={()=>setSettingsEditor({...settingsEditor, requireDeposit: val})}
                      style={[s.slotBtn, on && s.slotBtnActive, { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 }]}
                      accessibilityRole="button" accessibilityLabel={`Require deposit: ${label}`} accessibilityState={{ selected: on }}>
                      <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? BRAND : GRAY_400}/>
                      <Text style={[s.slotText, on && s.slotTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {settingsEditor.requireDeposit && (
                <>
                  <Text style={[s.fieldLabel,{ marginTop:12 }]}>Deposit percent</Text>
                  <TextInput style={s.input} value={settingsEditor.depositPercent} keyboardType="number-pad" onChangeText={depositPercent=>setSettingsEditor({...settingsEditor,depositPercent})}/>
                </>
              )}
              <TouchableOpacity style={[s.btnPrimary,{ marginTop:18 }]} onPress={saveSettings}
                accessibilityRole="button" accessibilityLabel="Save settings"><Text style={s.btnPrimaryText}>Save settings</Text></TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Android-only: current-password prompt for 2FA toggle */}
      <Modal visible={!!twoFaPwModal} transparent animationType="fade" onRequestClose={()=>setTwoFaPwModal(null)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.45)' }}>
          <View style={{ backgroundColor:'#fff', borderRadius:14, padding:24, width:'80%', maxWidth:340 }}>
            <Text style={{ fontWeight:'700', fontSize:16, marginBottom:8, color:GRAY_900 }}>
              {twoFaPwModal?.enabled ? 'Enable two-factor sign-in' : 'Disable two-factor sign-in'}
            </Text>
            <Text style={{ color:GRAY_500, fontSize:14, marginBottom:16 }}>Enter your current password to confirm.</Text>
            <TextInput
              style={[s.input,{ marginBottom:16 }]}
              placeholder="Current password"
              secureTextEntry
              value={twoFaPwText}
              onChangeText={setTwoFaPwText}
              autoFocus
            />
            <View style={{ flexDirection:'row', gap:10 }}>
              <TouchableOpacity style={[s.btnPrimary,{ flex:1 }]} onPress={()=>{
                const pw = twoFaPwText.trim();
                setTwoFaPwModal(null);
                if (pw && twoFaPwModal) saveTwoFA(twoFaPwModal.enabled, twoFaPwModal.method, pw);
              }} accessibilityRole="button" accessibilityLabel="Confirm">
                <Text style={s.btnPrimaryText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnPrimary,{ flex:1, backgroundColor:GRAY_200 }]} onPress={()=>setTwoFaPwModal(null)}
                accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={[s.btnPrimaryText,{ color:GRAY_700 }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );

  // Mirror the web dashboard's information architecture so features stay in a
  // predictable place across desktop and mobile.
  const isOwner = user?.role === 'OWNER';
  const dashboardGroups: Array<{ title:string; items:Array<{ label:string; icon:any; onPress:()=>void; badge?:string }> }> = isOwner ? [
    { title:'Operations', items:[
      { label:'Staff',             icon:'people-outline',          onPress:()=>open('staff') },
      { label:'Services',          icon:'pricetags-outline',       onPress:()=>open('services') },
      { label:'Locations',         icon:'location-outline',        onPress:()=>open('locations') },
      { label:'Rooms & Resources', icon:'business-outline',        onPress:()=>open('resources') },
      { label:'Business Hours',    icon:'time-outline',            onPress:()=>open('hours') },
      { label:'Online Booking',    icon:'globe-outline',           onPress:()=>open('booking') },
      { label:'Tasks',             icon:'checkbox-outline',        onPress:()=>open('tasks') },
      { label:'Follow-ups',        icon:'repeat-outline',          onPress:()=>open('followups') },
      { label:'Waitlist',          icon:'hourglass-outline',       onPress:()=>open('waitlist') },
    ]},
    { title:'Financials', items:[
      { label:'Payouts',           icon:'wallet-outline',          onPress:()=>open('payouts') },
      { label:'Transactions',      icon:'swap-horizontal-outline', onPress:()=>open('transactions') },
      { label:'Invoices',          icon:'receipt-outline',         onPress:()=>open('invoices') },
      { label:'Reports',           icon:'bar-chart-outline',       onPress:()=>open('reports') },
    ]},
    { title:'Marketing', items:[
      { label:'Campaigns',         icon:'megaphone-outline',       onPress:()=>open('marketing') },
      { label:'Offers',            icon:'sparkles-outline',        onPress:()=>open('offers') },
      { label:'Promo Codes',       icon:'pricetag-outline',        onPress:()=>open('promo-codes') },
      { label:'Gift Cards',        icon:'gift-outline',            onPress:()=>open('giftcards') },
      { label:'Packages',          icon:'cube-outline',            onPress:()=>open('packages') },
      { label:'Memberships',       icon:'people-circle-outline',   onPress:()=>open('memberships') },
      { label:'Reviews',           icon:'star-outline',            onPress:()=>open('reviews') },
    ]},
    { title:'Account', items:[
      { label:'Notifications',     icon:'notifications-outline',   onPress:()=>open('notifications') },
      { label:'Plan & Add-ons',    icon:'extension-puzzle-outline',onPress:()=>open('addons') },
      { label:'Subscriptions',     icon:'card-outline',            onPress:()=>open('subscriptions') },
      { label:'Settings',          icon:'settings-outline',        onPress:()=>open('settings') },
      { label:'Support',           icon:'help-buoy-outline',       onPress:()=>Linking.openURL('mailto:support@pulseappointments.com') },
      { label:'Privacy Policy',    icon:'shield-checkmark-outline',onPress:()=>Linking.openURL(`${WEB_URL}/privacy`) },
      { label:'Terms of Service',  icon:'document-text-outline',   onPress:()=>Linking.openURL(`${WEB_URL}/terms`) },
    ]},
  ] : [
    { title:'Work', items:[
      { label:'My Tasks',          icon:'checkbox-outline',        onPress:()=>open('tasks') },
      { label:'Follow-ups',        icon:'repeat-outline',          onPress:()=>open('followups') },
      { label:'Notifications',     icon:'notifications-outline',   onPress:()=>open('notifications') },
    ]},
    { title:'Account', items:[
      { label:'Settings',          icon:'settings-outline',        onPress:()=>open('settings') },
      { label:'Support',           icon:'help-buoy-outline',       onPress:()=>Linking.openURL('mailto:support@pulseappointments.com') },
      { label:'Privacy Policy',    icon:'shield-checkmark-outline',onPress:()=>Linking.openURL(`${WEB_URL}/privacy`) },
      { label:'Terms of Service',  icon:'document-text-outline',   onPress:()=>Linking.openURL(`${WEB_URL}/terms`) },
    ]},
  ];
  const quickActions = isOwner ? [
    { label:'Services', icon:'pricetags-outline', view:'services' as MoreView },
    { label:'Staff', icon:'people-outline', view:'staff' as MoreView },
    { label:'Reports', icon:'bar-chart-outline', view:'reports' as MoreView },
    { label:'Settings', icon:'settings-outline', view:'settings' as MoreView },
  ] : [
    { label:'Tasks', icon:'checkbox-outline', view:'tasks' as MoreView },
    { label:'Alerts', icon:'notifications-outline', view:'notifications' as MoreView },
    { label:'Settings', icon:'settings-outline', view:'settings' as MoreView },
  ];
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Dashboard</Text></View>
      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {user&&(
          <TouchableOpacity style={s.profileCard} activeOpacity={0.7} onPress={()=>open('settings')}
            accessibilityRole="button" accessibilityLabel="Open settings">
            {biz?.logoUrl ? (
              <Image source={{ uri: uploadUri(biz.logoUrl)! }} style={s.avatarLg} contentFit="cover"
                accessible={true} accessibilityLabel="Business logo"/>
            ) : (
              <View style={s.avatarLg}><Text style={s.avatarLgText}>{user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</Text></View>
            )}
            <View>
              <Text style={s.profileName}>{biz?.name ?? user.name}</Text>
              <Text style={s.profileRole}>{user.role.toLowerCase()}</Text>
            </View>
          </TouchableOpacity>
        )}
        {user?.role === 'OWNER' && !twoFA && (
          <TouchableOpacity
            style={{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#FFF7ED', borderRadius:12, padding:14, marginBottom:12, borderWidth:1, borderColor:'#FED7AA' }}
            onPress={()=>open('settings')}
            accessibilityRole="button"
            accessibilityLabel="Enable two-factor authentication"
          >
            <Ionicons name="shield-outline" size={20} color="#C2410C"/>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:13, fontWeight:'700', color:'#C2410C' }}>Secure your account</Text>
              <Text style={{ fontSize:12, color:'#9A3412', marginTop:1 }}>Enable two-factor sign-in in Settings to protect access.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C2410C"/>
          </TouchableOpacity>
        )}
        <Text style={{ fontSize:12, fontWeight:'700', color:GRAY_500, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Quick actions</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:18 }}>
          {quickActions.map(action => (
            <TouchableOpacity key={action.label} onPress={()=>open(action.view)} activeOpacity={0.7}
              style={{ width:'48%', minHeight:82, borderRadius:14, padding:14, backgroundColor:'#fff', borderWidth:1, borderColor:GRAY_100 }}
              accessibilityRole="button" accessibilityLabel={action.label}>
              <View style={s.menuIcon}><Ionicons name={action.icon as any} size={20} color={BRAND}/></View>
              <Text style={{ fontSize:14, fontWeight:'700', color:GRAY_900, marginTop:8 }}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {dashboardGroups.map(group => (
          <View key={group.title}>
            <Text style={{ fontSize:12, fontWeight:'700', color:GRAY_500, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8, marginLeft:2 }}>{group.title}</Text>
            <View style={s.menuCard}>
              {group.items.map((r,i)=>(
                <TouchableOpacity key={r.label} style={[s.menuRow, i<group.items.length-1&&s.menuRowBorder]} onPress={r.onPress} activeOpacity={0.7}
                  accessibilityRole="button" accessibilityLabel={r.label}>
                  <View style={s.menuIcon}><Ionicons name={r.icon} size={20} color={BRAND}/></View>
                  <Text style={s.menuLabel}>{r.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={GRAY_400}/>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.logoutBtn} onPress={()=>{
          Alert.alert('Sign out','Are you sure?',[{text:'Cancel',style:'cancel'},{text:'Sign out',style:'destructive',onPress:onLogout}]);
        }} accessibilityRole="button" accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{marginRight:8}}/>
          <Text style={{color:'#EF4444',fontWeight:'600',fontSize:15}}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export { MenuScreen };
