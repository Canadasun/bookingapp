import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  SafeAreaView, RefreshControl, Share, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { BRAND, BRAND_LT, GRAY_100, GRAY_400, GRAY_500, GRAY_700, GRAY_900 } from '../theme';
import { api } from '../api';
import { bizId, getAuth } from '../auth';
import { WEB_URL } from '../config';
import { fmtTime } from '../format';
import type { Appointment, ServiceDueItem } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtCAD(cents: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(cents / 100);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// ── screen ───────────────────────────────────────────────────────────────────

export function TodayScreen() {
  const nav = useNavigation<any>();
  const { user } = getAuth();
  const bid = bizId();
  const [blockModal, setBlockModal] = useState(false);

  const { data: biz } = useQuery({
    queryKey: ['biz-today', bid],
    queryFn: () => api<any>(`/businesses/${bid}`),
    staleTime: 300_000,
  });

  const { data: allBookings = [], isLoading: loadingBookings, refetch: refetchBookings, isFetching } = useQuery({
    queryKey: ['bookings-today', bid],
    queryFn: () => api<{ data: Appointment[] }>(`/businesses/${bid}/bookings`).then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: followups = [] } = useQuery({
    queryKey: ['followups-today', bid],
    queryFn: () => api<ServiceDueItem[]>(`/businesses/${bid}/service-due`).catch(() => [] as ServiceDueItem[]),
    staleTime: 120_000,
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ['waitlist-today', bid],
    queryFn: () => api<any[]>(`/businesses/${bid}/waitlist`).catch(() => [] as any[]),
    staleTime: 120_000,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-today', bid],
    queryFn: () => api<any[]>(`/payments`).catch(() => [] as any[]),
    staleTime: 120_000,
  });

  // Compute today's metrics from existing data
  const todayApts = allBookings.filter(a => isToday(a.startsAt));
  const confirmedToday = todayApts.filter(a => a.status === 'CONFIRMED').length;
  const pendingToday = todayApts.filter(a => a.status === 'PENDING').length;
  const noShowRisk = todayApts.filter(a =>
    ['CONFIRMED', 'PENDING'].includes(a.status) && !(a as any).depositCents
  ).length;

  const todayPayments = payments.filter((p: any) => isToday(p.createdAt ?? p.updatedAt ?? ''));
  const depositsToday = todayPayments
    .filter((p: any) => p.status === 'SUCCEEDED' && p.description?.toLowerCase().includes('deposit'))
    .reduce((sum: number, p: any) => sum + (p.amountCents - p.refundedCents), 0);

  // Revenue protected = deposits + no-show/cancellation fees collected (approximation from paid payments)
  const revenueProtected = payments
    .filter((p: any) => p.status === 'SUCCEEDED' && p.source !== 'CHECKOUT')
    .reduce((sum: number, p: any) => sum + ((p.amountCents ?? 0) - (p.refundedCents ?? 0)), 0);

  const now = new Date();
  const nextApt = todayApts
    .filter(a => ['CONFIRMED', 'PENDING'].includes(a.status) && new Date(a.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  const dueFollowups = followups.filter((f: ServiceDueItem) => f.status === 'DUE');

  async function shareBookingLink() {
    const slug = biz?.slug;
    if (!slug) { Alert.alert('Not ready', 'Business slug not loaded yet — try again in a moment.'); return; }
    const url = `${WEB_URL}/book/${slug}`;
    try {
      await Share.share({ message: `Book with me at Pulse Appointments:\n${url}`, url });
    } catch {}
  }

  const onRefresh = useCallback(() => { refetchBookings(); }, [refetchBookings]);

  if (loadingBookings && !allBookings.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BRAND} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F7FF' }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={BRAND} />}
      >
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 13, color: GRAY_500, fontWeight: '500' }}>
            {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: GRAY_900, marginTop: 2 }}>
            {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {/* ── Revenue Protected hero ── */}
        <View style={{
          marginHorizontal: 20, marginTop: 16, borderRadius: 20, overflow: 'hidden',
          backgroundColor: BRAND, padding: 20,
          shadowColor: BRAND, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Ionicons name="shield-checkmark" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Revenue Protected
            </Text>
          </View>
          <Text style={{ fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -1 }}>
            {fmtCAD(revenueProtected)}
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            Deposits, no-show fees & cancellation fees collected
          </Text>
        </View>

        {/* ── Today stats row ── */}
        <View style={{ flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 14 }}>
          <StatCard
            icon="calendar-outline"
            label="Today"
            value={String(todayApts.length)}
            sub={`${confirmedToday} confirmed · ${pendingToday} pending`}
            color="#7C3AED"
            onPress={() => nav.navigate('Calendar')}
          />
          <StatCard
            icon="card-outline"
            label="Deposits today"
            value={fmtCAD(depositsToday)}
            sub="Collected today"
            color="#059669"
          />
        </View>

        {noShowRisk > 0 && (
          <TouchableOpacity
            onPress={() => nav.navigate('Calendar')}
            style={{
              marginHorizontal: 20, marginTop: 12, borderRadius: 14, padding: 14,
              backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            <Ionicons name="warning-outline" size={20} color="#C2410C" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>
                {noShowRisk} appointment{noShowRisk !== 1 ? 's' : ''} without a deposit
              </Text>
              <Text style={{ fontSize: 12, color: '#B45309', marginTop: 1 }}>
                Consider collecting a deposit to protect your revenue
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C2410C" />
          </TouchableOpacity>
        )}

        {/* ── Next appointment ── */}
        {nextApt && (
          <View style={{ marginHorizontal: 20, marginTop: 14 }}>
            <Text style={sectionLabel}>Next up</Text>
            <TouchableOpacity
              onPress={() => nav.navigate('Calendar')}
              style={{
                backgroundColor: '#fff', borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: GRAY_100, gap: 4,
                shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: GRAY_900 }}>{nextApt.client.name}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: BRAND }}>{fmtTime(nextApt.startsAt)}</Text>
              </View>
              <Text style={{ fontSize: 13, color: GRAY_500 }}>{nextApt.service.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={{
                  backgroundColor: (nextApt as any).depositCents ? '#D1FAE5' : '#FEF3C7',
                  borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: (nextApt as any).depositCents ? '#059669' : '#D97706' }}>
                    {(nextApt as any).depositCents ? `Deposit paid` : 'No deposit'}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: nextApt.status === 'CONFIRMED' ? BRAND_LT : GRAY_100,
                  borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: nextApt.status === 'CONFIRMED' ? BRAND : GRAY_500 }}>
                    {nextApt.status}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {todayApts.length === 0 && (
          <View style={{
            marginHorizontal: 20, marginTop: 14, backgroundColor: '#fff', borderRadius: 16,
            padding: 24, alignItems: 'center', borderWidth: 1, borderColor: GRAY_100,
          }}>
            <Ionicons name="calendar-outline" size={40} color={GRAY_400} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: GRAY_700, marginTop: 10 }}>No appointments today</Text>
            <Text style={{ fontSize: 13, color: GRAY_500, textAlign: 'center', marginTop: 4 }}>
              Share your booking link to get your first booking
            </Text>
            <TouchableOpacity
              onPress={shareBookingLink}
              style={{ marginTop: 14, backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Share booking link</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Quick actions ── */}
        <View style={{ marginHorizontal: 20, marginTop: 20 }}>
          <Text style={sectionLabel}>Quick actions</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <QuickAction icon="add-circle" label="Add booking" color="#7C3AED" onPress={() => nav.navigate('Book')} />
            <QuickAction icon="time" label="Block time" color="#EF4444" onPress={() => nav.navigate('Calendar', { openBlockTime: true })} />
            <QuickAction icon="share-social" label="Share link" color="#0EA5E9" onPress={shareBookingLink} />
            <QuickAction icon="card" label="Checkout" color="#059669" onPress={() => nav.navigate('Checkout')} />
          </View>
        </View>

        {/* ── Rebooking due ── */}
        {dueFollowups.length > 0 && (
          <View style={{ marginHorizontal: 20, marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={sectionLabel}>Due for rebooking</Text>
              <TouchableOpacity onPress={() => nav.navigate('Dashboard', { screen: 'MenuDetail', params: { view: 'followups' } })}>
                <Text style={{ fontSize: 13, color: BRAND, fontWeight: '600' }}>See all</Text>
              </TouchableOpacity>
            </View>
            {dueFollowups.slice(0, 3).map((f: ServiceDueItem) => (
              <View key={f.id} style={{
                backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
                flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: GRAY_100,
                shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 },
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: GRAY_900 }}>{f.client.name}</Text>
                  <Text style={{ fontSize: 12, color: GRAY_500, marginTop: 2 }}>
                    {f.service?.name ?? 'Service due'} · Due {new Date(f.dueAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: BRAND_LT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
                  onPress={() => nav.navigate('Dashboard', { screen: 'MenuDetail', params: { view: 'followups' } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Send rebooking invite to ${f.client.name}`}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND }}>Invite</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── Waitlist ── */}
        {waitlist.length > 0 && (
          <TouchableOpacity
            onPress={() => nav.navigate('Dashboard', { screen: 'MenuDetail', params: { view: 'waitlist' } })}
            style={{
              marginHorizontal: 20, marginTop: 14, backgroundColor: '#fff', borderRadius: 16,
              padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
              borderWidth: 1, borderColor: GRAY_100,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="hourglass-outline" size={20} color={BRAND} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: GRAY_900 }}>
                {waitlist.length} person{waitlist.length !== 1 ? 's' : ''} on the waitlist
              </Text>
              <Text style={{ fontSize: 12, color: GRAY_500, marginTop: 1 }}>Tap to notify and fill open slots</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={GRAY_400} />
          </TouchableOpacity>
        )}

        {/* ── All today's appointments ── */}
        {todayApts.length > 0 && (
          <View style={{ marginHorizontal: 20, marginTop: 20 }}>
            <Text style={sectionLabel}>Today's schedule</Text>
            {todayApts
              .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
              .map(a => {
                const past = new Date(a.endsAt ?? a.startsAt) < now;
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => nav.navigate('Calendar')}
                    style={{
                      backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      borderWidth: 1, borderColor: GRAY_100, opacity: past ? 0.5 : 1,
                    }}
                  >
                    <View style={{ width: 46, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: GRAY_700 }}>{fmtTime(a.startsAt)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: GRAY_900 }}>{a.client.name}</Text>
                      <Text style={{ fontSize: 12, color: GRAY_500 }}>{a.service.name}</Text>
                    </View>
                    <StatusPill status={a.status} />
                  </TouchableOpacity>
                );
              })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, onPress }: {
  icon: string; label: string; value: string; sub: string; color: string; onPress?: () => void;
}) {
  const Inner = (
    <View style={{
      flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: GRAY_100,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={{ fontSize: 10, fontWeight: '700', color: GRAY_500, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: GRAY_900, marginTop: 2, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: GRAY_500, marginTop: 2 }}>{sub}</Text>
    </View>
  );
  if (onPress) return <TouchableOpacity style={{ flex: 1 }} onPress={onPress} activeOpacity={0.75}>{Inner}</TouchableOpacity>;
  return <View style={{ flex: 1 }}>{Inner}</View>;
}

function QuickAction({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{ flex: 1, alignItems: 'center', gap: 6 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={{
        width: 52, height: 52, borderRadius: 16, backgroundColor: color + '18',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '600', color: GRAY_700, textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    CONFIRMED: { bg: '#D1FAE5', fg: '#059669', label: 'Confirmed' },
    PENDING:   { bg: '#FEF3C7', fg: '#D97706', label: 'Pending' },
    COMPLETED: { bg: '#E0E7FF', fg: '#4338CA', label: 'Done' },
    CANCELLED: { bg: '#FEE2E2', fg: '#DC2626', label: 'Cancelled' },
    NO_SHOW:   { bg: '#FEE2E2', fg: '#DC2626', label: 'No-show' },
  };
  const s = map[status] ?? { bg: GRAY_100, fg: GRAY_500, label: status };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: s.fg }}>{s.label}</Text>
    </View>
  );
}

const sectionLabel = { fontSize: 12, fontWeight: '700' as const, color: GRAY_500, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 10 };
