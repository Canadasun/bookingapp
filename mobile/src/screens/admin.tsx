import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, SafeAreaView, StatusBar, RefreshControl, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../auth';
import { api } from '../api';
import { BRAND, GRAY_50, GRAY_100, GRAY_200, GRAY_400, GRAY_500, GRAY_700, GRAY_900 } from '../theme';

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'verifications' | 'duplicates';

interface AdminMetrics {
  totalBusinesses: number;
  totalUsers: number;
  totalClients: number;
  pendingVerifications: number;
  activeSubscriptions: number;
  upcomingAppointments: number;
  recentAppointments: number;
  netRevenueCents: number;
  successfulPayments: number;
  flaggedDuplicates: number;
}

interface AdminOverview {
  generatedAt: string;
  metrics: AdminMetrics;
  planCounts: Record<'FREE' | 'BASIC' | 'PRO', number>;
  verificationCounts: Record<'PENDING' | 'VERIFIED' | 'UNVERIFIED' | 'REJECTED', number>;
  recentBusinesses: Array<{
    id: string; name: string; email: string; slug: string;
    plan: 'FREE' | 'BASIC' | 'PRO';
    verificationStatus: 'PENDING' | 'VERIFIED' | 'UNVERIFIED' | 'REJECTED';
    suspended: boolean; createdAt: string;
  }>;
}

interface PendingVerification {
  id: string; name: string; email: string; slug: string;
  verificationLegalName: string | null;
  verificationAddress: string | null;
  verificationPhone: string | null;
  verificationDocUrl: string | null;
  verificationSubmittedAt: string | null;
}

interface FlaggedDuplicate {
  id: string; name: string; email: string; phone: string | null; slug: string;
  duplicateOf: { id: string; name: string; email: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const verificationColor: Record<string, string> = {
  VERIFIED: '#10B981',
  PENDING: '#F59E0B',
  REJECTED: '#EF4444',
  UNVERIFIED: GRAY_400,
};

// ── Screen ───────────────────────────────────────────────────────────────────

export function AdminScreen({ onLogout }: { onLogout: () => void }) {
  const { user } = getAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [queue, setQueue] = useState<PendingVerification[]>([]);
  const [duplicates, setDuplicates] = useState<FlaggedDuplicate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ov, q, dups] = await Promise.all([
        api<AdminOverview>('/admin/overview'),
        api<PendingVerification[]>('/admin/verifications'),
        api<FlaggedDuplicate[]>('/admin/verifications/duplicates'),
      ]);
      setOverview(ov);
      setQueue(q);
      setDuplicates(dups);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approveVerification(b: PendingVerification) {
    Alert.alert(
      'Approve verification',
      `Verify "${b.name}"? They will receive a Verified badge.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve', style: 'default',
          onPress: async () => {
            setBusy(b.id);
            try {
              await api(`/admin/verifications/${b.id}/approve`, { method: 'POST' });
              load(true);
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  async function rejectVerification(b: PendingVerification) {
    Alert.prompt(
      'Reject verification',
      `Optional reason that "${b.name}" will see:`,
      async (note) => {
        setBusy(b.id);
        try {
          await api(`/admin/verifications/${b.id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ note: note || undefined }),
          });
          load(true);
        } catch (e) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
        } finally {
          setBusy(null);
        }
      },
      'plain-text',
    );
  }

  async function dismissDuplicate(d: FlaggedDuplicate) {
    Alert.alert(
      'Dismiss flag',
      `Mark "${d.name}" as reviewed (not a duplicate)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss', style: 'default',
          onPress: async () => {
            setBusy(d.id);
            try {
              await api(`/admin/verifications/${d.id}/duplicate-reviewed`, { method: 'POST' });
              load(true);
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  const TABS: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview',      label: 'Overview',      icon: 'grid-outline' },
    { id: 'verifications', label: 'Verify',         icon: 'shield-checkmark-outline', badge: queue.length || undefined },
    { id: 'duplicates',    label: 'Duplicates',     icon: 'warning-outline', badge: duplicates.length || undefined },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <View style={st.shieldBadge}>
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
          </View>
          <View>
            <Text style={st.headerTitle}>Pulse Admin</Text>
            <Text style={st.headerSub}>{user?.email ?? 'Admin'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onLogout} style={st.signOutBtn}>
          <Ionicons name="log-out-outline" size={20} color={GRAY_500} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={st.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[st.tabItem, tab === t.id && st.tabItemActive]}
          >
            <View style={{ position: 'relative' }}>
              <Ionicons name={t.icon as any} size={18} color={tab === t.id ? '#7C3AED' : GRAY_400} />
              {!!t.badge && (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{t.badge > 9 ? '9+' : t.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[st.tabLabel, tab === t.id && st.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={BRAND} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={BRAND}
            />
          }
        >

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          {tab === 'overview' && overview && (
            <View style={{ gap: 16 }}>
              {/* Stats grid */}
              <View style={st.statsGrid}>
                {[
                  { label: 'Businesses',    value: overview.metrics.totalBusinesses,   icon: 'business-outline',    color: '#7C3AED' },
                  { label: 'Users',         value: overview.metrics.totalUsers,         icon: 'people-outline',      color: '#3B82F6' },
                  { label: 'Appointments',  value: overview.metrics.upcomingAppointments, icon: 'calendar-outline', color: '#10B981' },
                  { label: '30d Revenue',   value: fmtMoney(overview.metrics.netRevenueCents), icon: 'card-outline', color: '#F59E0B', isString: true },
                ].map((item) => (
                  <View key={item.label} style={st.statCard}>
                    <View style={[st.statIcon, { backgroundColor: item.color + '20' }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <Text style={[st.statValue, { color: item.color }]}>
                      {item.isString ? item.value : String(item.value)}
                    </Text>
                    <Text style={st.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Alerts */}
              {(queue.length > 0 || duplicates.length > 0) && (
                <View style={{ gap: 8 }}>
                  {queue.length > 0 && (
                    <TouchableOpacity onPress={() => setTab('verifications')} style={st.alertCard}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#7C3AED" />
                      <Text style={st.alertText}>{queue.length} verification{queue.length !== 1 ? 's' : ''} pending review</Text>
                      <Ionicons name="chevron-forward" size={16} color={GRAY_400} />
                    </TouchableOpacity>
                  )}
                  {duplicates.length > 0 && (
                    <TouchableOpacity onPress={() => setTab('duplicates')} style={[st.alertCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
                      <Ionicons name="warning-outline" size={20} color="#D97706" />
                      <Text style={[st.alertText, { color: '#92400E' }]}>{duplicates.length} flagged duplicate account{duplicates.length !== 1 ? 's' : ''}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#D97706" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Plan mix */}
              <View style={st.section}>
                <Text style={st.sectionTitle}>Plan mix</Text>
                {(['PRO', 'BASIC', 'FREE'] as const).map((plan) => {
                  const count = overview.planCounts[plan];
                  const total = overview.planCounts.FREE + overview.planCounts.BASIC + overview.planCounts.PRO;
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  const colors: Record<string, string> = { PRO: '#7C3AED', BASIC: '#3B82F6', FREE: GRAY_200 };
                  return (
                    <View key={plan} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: GRAY_700 }}>{plan}</Text>
                        <Text style={{ fontSize: 13, color: GRAY_500 }}>{count} · {pct}%</Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: GRAY_100, borderRadius: 3 }}>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors[plan], width: `${pct}%` }} />
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Verification status */}
              <View style={st.section}>
                <Text style={st.sectionTitle}>Verification status</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(['PENDING', 'VERIFIED', 'UNVERIFIED', 'REJECTED'] as const).map((st2) => (
                    <View key={st2} style={[st.verifChip, { borderColor: verificationColor[st2] + '40', backgroundColor: verificationColor[st2] + '15' }]}>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: verificationColor[st2] }}>{overview.verificationCounts[st2]}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: verificationColor[st2] }}>{st2}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Recent businesses */}
              <View style={st.section}>
                <Text style={st.sectionTitle}>Recent businesses</Text>
                {overview.recentBusinesses.slice(0, 8).map((b) => (
                  <View key={b.id} style={[st.bizRow, b.suspended && { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                    <View style={[st.avatar, { backgroundColor: '#EDE9FE' }]}>
                      <Text style={[st.avatarText, { color: '#7C3AED' }]}>{initials(b.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: GRAY_900 }}>{b.name}</Text>
                      <Text style={{ fontSize: 12, color: GRAY_500 }}>/{b.slug}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <View style={[st.planPill, { backgroundColor: b.plan === 'PRO' ? '#EDE9FE' : b.plan === 'BASIC' ? '#DBEAFE' : GRAY_100 }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: b.plan === 'PRO' ? '#7C3AED' : b.plan === 'BASIC' ? '#1D4ED8' : GRAY_500 }}>{b.plan}</Text>
                      </View>
                      {b.suspended && (
                        <View style={[st.planPill, { backgroundColor: '#FEE2E2' }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626' }}>SUSPENDED</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── VERIFICATIONS ─────────────────────────────────────────── */}
          {tab === 'verifications' && (
            <View style={{ gap: 12 }}>
              <Text style={st.pageTitle}>Verification queue</Text>
              {queue.length === 0 ? (
                <View style={st.emptyBox}>
                  <Ionicons name="checkmark-circle-outline" size={40} color="#10B981" />
                  <Text style={st.emptyTitle}>All caught up</Text>
                  <Text style={st.emptyBody}>New verification requests will appear here.</Text>
                </View>
              ) : queue.map((b) => (
                <View key={b.id} style={st.verifCard}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <View style={[st.avatar, { backgroundColor: '#EDE9FE', width: 44, height: 44, borderRadius: 12 }]}>
                      <Text style={[st.avatarText, { color: '#7C3AED', fontSize: 14 }]}>{initials(b.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: GRAY_900 }}>{b.name}</Text>
                      <Text style={{ fontSize: 12, color: GRAY_500, marginTop: 1 }}>{b.email}</Text>
                      {b.verificationSubmittedAt && (
                        <Text style={{ fontSize: 11, color: GRAY_400, marginTop: 2 }}>Submitted {timeAgo(b.verificationSubmittedAt)}</Text>
                      )}
                      <View style={{ backgroundColor: GRAY_50, borderRadius: 8, padding: 10, marginTop: 10, gap: 3 }}>
                        <Text style={st.detailRow}><Text style={st.detailKey}>Legal: </Text>{b.verificationLegalName || 'Missing'}</Text>
                        <Text style={st.detailRow}><Text style={st.detailKey}>Address: </Text>{b.verificationAddress || 'Missing'}</Text>
                        <Text style={st.detailRow}><Text style={st.detailKey}>Phone: </Text>{b.verificationPhone || 'Missing'}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                    <TouchableOpacity
                      disabled={busy === b.id}
                      onPress={() => rejectVerification(b)}
                      style={[st.btnDanger, { flex: 1 }]}
                    >
                      <Ionicons name="close" size={16} color="#DC2626" />
                      <Text style={st.btnDangerText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busy === b.id}
                      onPress={() => approveVerification(b)}
                      style={[st.btnSuccess, { flex: 1 }]}
                    >
                      {busy === b.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={st.btnSuccessText}>Approve</Text></>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── DUPLICATES ────────────────────────────────────────────── */}
          {tab === 'duplicates' && (
            <View style={{ gap: 12 }}>
              <Text style={st.pageTitle}>Flagged duplicates</Text>
              <Text style={{ fontSize: 13, color: GRAY_500, marginTop: -6 }}>
                Accounts auto-flagged at signup for matching an existing business name and phone.
              </Text>
              {duplicates.length === 0 ? (
                <View style={st.emptyBox}>
                  <Ionicons name="checkmark-circle-outline" size={40} color="#10B981" />
                  <Text style={st.emptyTitle}>No duplicate flags</Text>
                  <Text style={st.emptyBody}>Accounts are automatically flagged here when a new signup matches an existing business.</Text>
                </View>
              ) : duplicates.map((d) => (
                <View key={d.id} style={[st.verifCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <View style={[st.avatar, { backgroundColor: '#FDE68A', width: 44, height: 44, borderRadius: 12 }]}>
                      <Text style={[st.avatarText, { color: '#92400E', fontSize: 14 }]}>{initials(d.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: GRAY_900 }}>{d.name}</Text>
                      <Text style={{ fontSize: 12, color: GRAY_500, marginTop: 1 }}>{d.email}</Text>
                      {d.phone && <Text style={{ fontSize: 12, color: GRAY_500 }}>{d.phone}</Text>}
                      {d.duplicateOf && (
                        <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 10 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#92400E' }}>
                            Possible duplicate of: {d.duplicateOf.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#B45309' }}>{d.duplicateOf.email}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    disabled={busy === d.id}
                    onPress={() => dismissDuplicate(d)}
                    style={[st.btnOutline, { marginTop: 12 }]}
                  >
                    {busy === d.id
                      ? <ActivityIndicator size="small" color={GRAY_500} />
                      : <><Ionicons name="checkmark-circle-outline" size={16} color="#10B981" /><Text style={st.btnOutlineText}>Not a duplicate</Text></>
                    }
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: GRAY_100, backgroundColor: '#fff',
  },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shieldBadge:  { width: 38, height: 38, borderRadius: 12, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: GRAY_900 },
  headerSub:    { fontSize: 11, color: GRAY_500, marginTop: 1 },
  signOutBtn:   { padding: 8 },
  tabBar:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: GRAY_100, backgroundColor: '#fff' },
  tabItem:      { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive:{ borderBottomColor: '#7C3AED' },
  tabLabel:     { fontSize: 10, fontWeight: '600', color: GRAY_400 },
  tabLabelActive: { color: '#7C3AED' },
  badge:        { position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:    { fontSize: 9, fontWeight: '700', color: '#fff' },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:     { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: GRAY_100, padding: 14, alignItems: 'flex-start', gap: 6, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  statIcon:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue:    { fontSize: 24, fontWeight: '700' },
  statLabel:    { fontSize: 11, color: GRAY_500 },
  alertCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 12, padding: 14 },
  alertText:    { flex: 1, fontSize: 13, fontWeight: '600', color: '#4C1D95' },
  section:      { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: GRAY_100, padding: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: GRAY_500, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  bizRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: GRAY_100, padding: 10, marginBottom: 6, backgroundColor: '#FAFAFA' },
  avatar:       { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 12, fontWeight: '700' },
  planPill:     { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  verifChip:    { borderWidth: 1, borderRadius: 10, padding: 10, minWidth: '45%', flex: 1 },
  pageTitle:    { fontSize: 20, fontWeight: '700', color: GRAY_900 },
  verifCard:    { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: GRAY_100, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  detailRow:    { fontSize: 12, color: GRAY_700 },
  detailKey:    { fontWeight: '600', color: GRAY_900 },
  btnDanger:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12 },
  btnDangerText:{ fontSize: 14, fontWeight: '600', color: '#DC2626' },
  btnSuccess:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 10, padding: 12 },
  btnSuccessText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  btnOutline:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: GRAY_200, backgroundColor: '#fff', borderRadius: 10, padding: 12 },
  btnOutlineText: { fontSize: 14, fontWeight: '600', color: GRAY_700 },
  emptyBox:     { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: GRAY_900 },
  emptyBody:    { fontSize: 13, color: GRAY_500, textAlign: 'center' },
});
