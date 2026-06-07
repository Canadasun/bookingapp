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
import type { User, Appointment, ServiceCategory, Service, AvailabilityRule, Staff, Slot, BookingSlot, Client, Message, NotificationItem, NotificationDelivery, TaskItem, ServiceDueItem, ClientPortalAppointment, ClientPortalMessageThread, ClientPortalOffer } from '../types';
import { fmtTime, fmtDur, normalizePhoneClient } from '../format';
import { setAuth, getAuth, bizId, listeners, persistAuth, loadPersistedAuth, refreshSession } from '../auth';
import { api, registerPushNotifications } from '../api';
import { s, cal, co, ms, dst } from '../styles';
import { Pill, PriceTag, VerifiedPill, SwipeToDelete } from '../components';

type MoreView = 'menu' | 'services' | 'staff' | 'offers' | 'waitlist' | 'reviews' | 'invoices'
  | 'marketing' | 'giftcards' | 'packages' | 'settings'
  | 'booking' | 'notifications' | 'reports' | 'addons' | 'subscriptions' | 'transactions' | 'tasks' | 'followups' | 'soon';

// Plan tiers mirror the web billing page. Display-only on mobile for now — every
// business is on Pro during testing; paid switching gets wired up after testing.
const PLANS = [
  { id:'FREE',  name:'Free',  price:'$0',  period:'/mo', features:['Unlimited bookings','Client management','Email confirmations','Public booking page'] },
  { id:'BASIC', name:'Basic', price:'$10', period:'/mo', features:['Everything in Free','Email reminders (24h)','Deposit collection','Cancellation policies'] },
  { id:'PRO',   name:'Pro',   price:'$20', period:'/mo', features:['Everything in Basic','SMS reminders (2h)','Automatic no-show fees','Analytics'] },
] as const;

function MenuScreen({ onLogout }: { onLogout:()=>void }) {
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
  const [loading, setLoading]   = useState(false);
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
  const [acctBusy, setAcctBusy] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('bookingapp.preferred-price-type.v1')
      .then((value) => {
        if (value === 'FLAT' || value === 'PER_HOUR' || value === 'STARTING_AT') setPreferredPriceType(value);
      })
      .catch(() => {});
  }, []);

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

  // Open a drill-in by pushing a new MenuDetail screen (works from the menu list
  // AND from nested drill-ins like Add-ons → Gift cards, so back pops one level).
  function open(v: MoreView) { nav.push('MenuDetail', { view: v }); }

  // Load the data this drill-in needs, once, when its screen mounts.
  useEffect(() => { if (view !== 'menu') loadView(view); }, []);
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
      else if (v === 'invoices' && !invoices) { setLoading(true); setInvoices(await api<any[]>(`/businesses/${bizId()}/invoices`)); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  const Head = ({ title }: { title:string }) => (
    <View style={[s.header, view!=='menu' && { flexDirection:'row', alignItems:'center' }]}>
      {view !== 'menu' && (
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
      )}
      <Text style={s.headerTitle}>{title}</Text>
    </View>
  );
  const Loader = () => <View style={{ padding:40, alignItems:'center' }}><ActivityIndicator color={BRAND}/></View>;

  if (view === 'services') return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
        <Text style={s.headerTitle}>Services</Text>
        <TouchableOpacity onPress={()=>setServiceEditor({ name:'', durationMinutes:'30', price:'0.00', active:true, capacity:'1', priceType:preferredPriceType })}>
          <Ionicons name="add" size={24} color={BRAND}/>
        </TouchableOpacity>
      </View>
      {loading ? <Loader/> : (
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
              })}>
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
              <Text style={[s.fieldLabel,{ marginTop:12 }]}>Pricing</Text>
              <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
                {([['FLAT','Flat rate'],['PER_HOUR','Per hour'],['STARTING_AT','Starting at']] as const).map(([val,label])=>{
                  const on = serviceEditor.priceType===val;
                  return (
                    <TouchableOpacity key={val} onPress={()=>setServiceEditor({...serviceEditor, priceType:val})}
                      style={[s.slotBtn, on && s.slotBtnActive, { flex:1, alignItems:'center' }]}>
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
            <View key={st.id} style={ms.card}>
              {/* Name + avatar get their own full-width row so the name is never
                  squeezed by the action buttons; actions sit on a second row. */}
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                {uploadUri(st.avatarUrl)
                  ? <Image source={{ uri: uploadUri(st.avatarUrl)! }} style={s.avatarImg} contentFit="cover"/>
                  : <View style={s.avatar}><Text style={{ color:BRAND, fontWeight:'700' }}>{st.user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</Text></View>}
                <View style={{ flex:1, minWidth:0 }}>
                  <Text style={ms.rowTitle} numberOfLines={1}>{st.user.name}</Text>
                  <Text style={ms.rowMeta} numberOfLines={1}>{st.bio || `${st.staffServices?.length ?? 0} services`}</Text>
                </View>
              </View>
              <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                <TouchableOpacity style={[ms.smallAction,{ flex:1, alignItems:'center' }]} onPress={()=>setTimeOffEditor({
                  staffId: st.id,
                  name: st.user.name,
                  startsAt: '',
                  endsAt: '',
                  reason: '',
                })}>
                  <Text style={ms.smallActionText}>Time off</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.smallAction,{ flex:1, alignItems:'center' }]} onPress={()=>openAvailabilityEditor(st)}>
                  <Text style={ms.smallActionText}>Hours</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.smallAction,{ flex:1, alignItems:'center' }]} onPress={()=>openStaffServices(st)}>
                  <Text style={ms.smallActionText}>Services</Text>
                </TouchableOpacity>
              </View>
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
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
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
                <TouchableOpacity style={ms.smallAction} onPress={()=>{ nav.navigate('Calendar', { screen: 'Book' }); }}><Text style={ms.smallActionText}>Book</Text></TouchableOpacity>
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
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
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
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
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
        <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
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
          <TouchableOpacity onPress={()=>nav.goBack()} style={{ marginRight:6 }}><Ionicons name="chevron-back" size={24} color={GRAY_700}/></TouchableOpacity>
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

  if (view === 'invoices') {
    const IC: Record<string,string> = { DRAFT:GRAY_500, SENT:'#2563EB', PAID:'#10B981', VOID:'#EF4444' };
    const subtotal = invoiceEditor ? invoiceEditor.items.reduce((t,it)=>t + (Math.max(1,Number.parseInt(it.quantity||'1',10)||1) * (Number.parseFloat(it.unit||'0')||0)), 0) : 0;
    return (
      <SafeAreaView style={s.screen}>
        <Head title="Invoices"/>
        {loading ? <Loader/> : (
          <ScrollView contentContainerStyle={{ padding:16 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={[s.btnPrimary,{ marginBottom:14 }]} onPress={()=>setInvoiceEditor({ items:[{ description:'', quantity:'1', unit:'0.00' }], notes:'' })}>
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
                    {inv.status==='DRAFT' && <TouchableOpacity style={ms.smallAction} onPress={()=>setInvoiceStatus(inv.id,'SENT')}><Text style={ms.smallActionText}>Mark sent</Text></TouchableOpacity>}
                    {inv.status!=='PAID' && inv.status!=='VOID' && <TouchableOpacity style={ms.smallAction} onPress={()=>setInvoiceStatus(inv.id,'PAID')}><Text style={ms.smallActionText}>Mark paid</Text></TouchableOpacity>}
                    {inv.status!=='VOID' && <TouchableOpacity style={ms.smallAction} onPress={()=>setInvoiceStatus(inv.id,'VOID')}><Text style={ms.smallActionText}>Void</Text></TouchableOpacity>}
                    <TouchableOpacity style={ms.smallAction} onPress={()=>deleteInvoice(inv.id)}><Text style={[ms.smallActionText,{ color:'#DC2626' }]}>Delete</Text></TouchableOpacity>
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
              <TouchableOpacity onPress={()=>setInvoiceEditor(null)} style={{ marginRight:6 }}><Ionicons name="close" size={24} color={GRAY_700}/></TouchableOpacity>
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
                        <TouchableOpacity style={{ padding:10 }} onPress={()=>setInvoiceEditor(e=>e?{ ...e, items:e.items.filter((_,i)=>i!==idx) }:e)}>
                          <Ionicons name="trash-outline" size={20} color="#DC2626"/>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={[ms.smallAction,{ alignSelf:'flex-start', marginBottom:14 }]} onPress={()=>setInvoiceEditor(e=>e?{ ...e, items:[...e.items, { description:'', quantity:'1', unit:'0.00' }] }:e)}>
                  <Text style={ms.smallActionText}>+ Add line</Text>
                </TouchableOpacity>
                <Text style={[ms.rowMeta,{ color:BRAND, marginBottom:14 }]}>Subtotal: ${subtotal.toFixed(2)} (tax added per your settings)</Text>
                <Text style={s.fieldLabel}>Notes (optional)</Text>
                <TextInput style={[s.input,{ minHeight:70, textAlignVertical:'top' }]} multiline value={invoiceEditor.notes}
                  onChangeText={v=>setInvoiceEditor(e=>e?{ ...e, notes:v }:e)}/>
                <TouchableOpacity style={[s.btnPrimary,{ marginTop:14 }]} onPress={saveInvoice}><Text style={s.btnPrimaryText}>Create invoice</Text></TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
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
            <View style={{ flexDirection:'row', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              {uploadUri((biz as any)?.logoUrl) && (
                <Image source={{ uri: uploadUri((biz as any).logoUrl)! }} style={s.bizLogoImg} contentFit="cover"/>
              )}
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
          <Text style={[ms.empty,{ marginTop:0, marginBottom:6 }]}>Every business is on Pro during testing. Paid plan changes will be enabled here soon.</Text>

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
                    style={[ms.methodChip, { flex:0, paddingHorizontal:16 }, (biz as any)?.suspended && ms.methodChipOn]}>
                    <Text style={[ms.methodChipText, (biz as any)?.suspended && { color:BRAND }]}>{(biz as any)?.suspended ? 'Reactivate' : 'Pause'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Kept intentionally quiet — a muted text link, not an advertised
                  red button. The confirm dialog spells out that it's permanent. */}
              <TouchableOpacity disabled={acctBusy} onPress={confirmDelete} style={{ paddingVertical:16, alignItems:'center' }}>
                <Text style={{ fontSize:12, color:GRAY_400, fontWeight:'400' }}>Delete business</Text>
              </TouchableOpacity>
            </>
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
              <Text style={s.fieldHint}>Clients can cancel for free until this many hours before the appointment.</Text>

              <Text style={[s.fieldLabel,{ marginTop:14 }]}>Require deposit</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                {([['No', false],['Yes', true]] as const).map(([label, val]) => {
                  const on = settingsEditor.requireDeposit === val;
                  return (
                    <TouchableOpacity key={label} onPress={()=>setSettingsEditor({...settingsEditor, requireDeposit: val})}
                      style={[s.slotBtn, on && s.slotBtnActive, { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 }]}>
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
    { label:'Invoices',         icon:'receipt-outline',         onPress:()=>open('invoices') },
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

export { MenuScreen };
