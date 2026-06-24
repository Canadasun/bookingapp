// Extracted from App.tsx (Phase 0b). Behavior unchanged.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, SafeAreaView, Platform, Modal, StatusBar,
  KeyboardAvoidingView, RefreshControl, BackHandler, Linking, Switch, Share,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
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

type DupeGroup = { clients: Array<{ id: string; name: string; email: string; phone?: string | null; createdAt: string; appointments: number }> };
type ClientHistory = { id: string; startsAt: string; status: string; service: { name: string }; staff: { user: { name: string } } };

function ClientsScreen({ onMessage }: { onMessage: (c: Client) => void }) {
  const { user } = getAuth();
  const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const nav = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState<Client | null>(null);
  const [profileHistory, setProfileHistory] = useState<ClientHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [profileTab, setProfileTab] = useState<'info' | 'history'>('info');
  const [blockingClient, setBlockingClient] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Duplicate detection + merge
  const [dupeModal, setDupeModal] = useState(false);
  const [dupeGroups, setDupeGroups] = useState<DupeGroup[]>([]);
  const [dupeBusy, setDupeBusy] = useState(false);
  const [merging, setMerging] = useState<DupeGroup | null>(null);
  const [primaryId, setPrimaryId] = useState<string>('');

  const PAGE_SIZE = 50;

  const { data: firstPage, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['clients', search],
    queryFn: async () => {
      if (!isOwner) throw new Error('Access denied. Only owners can view the client list.');
      const res = await api<{ data: Client[]; total: number }>(`/businesses/${bizId()}/clients?limit=${PAGE_SIZE}&page=1${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      setPage(1);
      setHasMore(res.total > PAGE_SIZE);
      return res.data;
    },
    enabled: isOwner,
  });

  const [extraClients, setExtraClients] = useState<Client[]>([]);
  const clients = [...(firstPage ?? []), ...extraClients];

  // Reset extra pages when search changes
  useEffect(() => { setExtraClients([]); }, [search]);

  async function openProfile(c: Client) {
    setProfile(c);
    setProfileTab('info');
    setProfileHistory([]);
    setHistoryLoading(true);
    try {
      const data = await api<{ data: ClientHistory[] }>(`/businesses/${bizId()}/bookings?clientId=${c.id}&limit=20`).catch(() => null);
      if (data?.data) setProfileHistory(data.data.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function toggleBlock(c: Client) {
    const willBlock = !c.isBlocked;
    if (willBlock) {
      Alert.alert(
        'Block client',
        `Block ${c.name} from online booking?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block', style: 'destructive', onPress: async () => {
              setBlockingClient(true);
              try {
                const updated = await api<Client>(`/businesses/${bizId()}/clients/${c.id}/block`, {
                  method: 'PATCH',
                  body: JSON.stringify({ isBlocked: true }),
                });
                queryClient.invalidateQueries({ queryKey: ['clients'] });
                setProfile(prev => prev ? { ...prev, isBlocked: updated.isBlocked, blockedReason: updated.blockedReason } : prev);
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Could not block client.');
              } finally { setBlockingClient(false); }
            },
          },
        ]
      );
    } else {
      setBlockingClient(true);
      try {
        const updated = await api<Client>(`/businesses/${bizId()}/clients/${c.id}/block`, {
          method: 'PATCH',
          body: JSON.stringify({ isBlocked: false }),
        });
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        setProfile(prev => prev ? { ...prev, isBlocked: updated.isBlocked, blockedReason: updated.blockedReason } : prev);
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Could not unblock client.');
      } finally { setBlockingClient(false); }
    }
  }

  async function toggleMarketingConsent(c: Client) {
    const next = !c.marketingOptOut;
    try {
      const updated = await api<Client>(`/businesses/${bizId()}/clients/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ marketingOptOut: next }),
      });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setProfile(prev => prev ? { ...prev, marketingOptOut: updated.marketingOptOut } : prev);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update consent.');
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api<{ data: Client[]; total: number }>(`/businesses/${bizId()}/clients?limit=${PAGE_SIZE}&page=${nextPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      setExtraClients(prev => [...prev, ...res.data]);
      setPage(nextPage);
      setHasMore(clients.length + res.data.length < res.total);
    } catch {}
    finally { setLoadingMore(false); }
  }

  const updateClientMutation = useMutation({
    mutationFn: ({ id, tags }: { id: string, tags: string[] }) =>
      api<Client>(`/businesses/${bizId()}/clients/${id}`, { method: 'PATCH', body: JSON.stringify({ tags }) }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (profile && profile.id === updated.id) {
        setProfile(updated);
      }
    },
    onError: (e) => {
      Alert.alert('Could not update tags', e instanceof Error ? e.message : 'Please try again.');
    }
  });

  function addTag(client: Client) {
    if (!isOwner) return;
    const t = tagInput.trim();
    if (!t) return;
    const existing = client.tags ?? [];
    if (existing.some(x => x.toLowerCase() === t.toLowerCase())) { setTagInput(''); return; }
    updateClientMutation.mutate({ id: client.id, tags: [...existing, t] });
    setTagInput('');
  }

  function removeTag(client: Client, tag: string) {
    if (!isOwner) return;
    updateClientMutation.mutate({ id: client.id, tags: (client.tags ?? []).filter(x => x !== tag) });
  }

  async function findDuplicates() {
    setDupeBusy(true);
    setDupeModal(true);
    try {
      const groups = await api<DupeGroup[]>(`/businesses/${bizId()}/clients/duplicates`);
      setDupeGroups(groups);
    } catch (e) {
      Alert.alert('Could not load duplicates', e instanceof Error ? e.message : 'Please try again.');
      setDupeModal(false);
    } finally { setDupeBusy(false); }
  }

  async function doMerge(group: DupeGroup, primary: string) {
    const dupeIds = group.clients.filter(c => c.id !== primary).map(c => c.id);
    setDupeBusy(true);
    try {
      await api<{ ok: boolean; merged: number }>(`/businesses/${bizId()}/clients/merge`, {
        method: 'POST',
        body: JSON.stringify({ primaryId: primary, dupeIds }),
      });
      setMerging(null);
      setDupeGroups(prev => prev.filter(g => g !== group));
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      Alert.alert('Merged', `${dupeIds.length} duplicate${dupeIds.length > 1 ? 's' : ''} merged into the primary record.`);
    } catch (e) {
      Alert.alert('Merge failed', e instanceof Error ? e.message : 'Please try again.');
    } finally { setDupeBusy(false); }
  }

  // Hardware back closes the open profile instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (merging) { setMerging(null); return true; }
      if (dupeModal) { setDupeModal(false); return true; }
      if (profile) { setProfile(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [profile, dupeModal, merging]);

  function initials(name: string) { return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(); }

  if (!isOwner) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.header}><Text style={s.headerTitle}>Customers</Text></View>
        <View style={s.center}>
          <Ionicons name="lock-closed-outline" size={48} color={GRAY_400} />
          <Text style={[s.emptyText, { marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }]}>
            Access Denied. Only business owners can manage the customer database.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={BRAND} /></View>;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Customers</Text>
        <TouchableOpacity onPress={findDuplicates} accessibilityRole="button" accessibilityLabel="Find duplicate customers">
          <Ionicons name="git-merge-outline" size={22} color={BRAND} />
        </TouchableOpacity>
      </View>
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={GRAY_400} style={{ marginRight: 8 }} />
        <TextInput style={s.searchInput} placeholder="Search by name, email…"
          placeholderTextColor={GRAY_400} value={search} onChangeText={setSearch} />
      </View>
      <FlashList
        data={clients}
        keyExtractor={c => c.id}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>{error ? (error as Error).message : 'No customers found'}</Text></View>}
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={BRAND} style={{ padding: 16 }} /> : null}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => { setExtraClients([]); refetch(); }} tintColor={BRAND} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: c }) => (
          <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={() => openProfile(c)}>
            <View style={s.avatar}><Text style={s.avatarText}>{initials(c.name)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.clientName}>{c.name}</Text>
              <Text style={s.sub}>{c.email}</Text>
              {c.phone && <Text style={s.sub}>{formatPhoneDisplay(c.phone)}</Text>}
              {c.totalVisits !== undefined && <Text style={s.sub}>{c.totalVisits} visit{c.totalVisits !== 1 ? 's' : ''}{c.totalSpentCents ? ` · $${(c.totalSpentCents / 100).toFixed(0)} spent` : ''}</Text>}
              {c.isBlocked && <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626', marginTop: 2 }}>Blocked from booking</Text>}
              {c.tags && c.tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {c.tags.slice(0, 3).map(t => (
                    <View key={t} style={{ backgroundColor: GRAY_100, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: GRAY_500 }}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity style={s.msgBtn} onPress={() => onMessage(c)}>
              <Ionicons name="chatbubble-outline" size={18} color={BRAND} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* Customer profile */}
      {profile && (
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setProfile(null)}>
          <TouchableOpacity style={[s.sheet, { maxHeight: '92%' }]} activeOpacity={1} onPress={() => {}}>
            <View style={s.sheetHandle} />

            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={[s.avatarLg, { marginBottom: 8 }]}>
                <Text style={s.avatarLgText}>{initials(profile.name)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.sheetTitle}>{profile.name}</Text>
                {profile.isBlocked && (
                  <View style={{ backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>Blocked</Text>
                  </View>
                )}
              </View>
              {profile.totalSpentCents ? (
                <Text style={{ fontSize: 13, color: GRAY_500, marginTop: 2 }}>
                  ${(profile.totalSpentCents / 100).toFixed(0)} lifetime · {profile.totalVisits ?? 0} visits
                </Text>
              ) : null}
            </View>

            {/* Tabs */}
            <View style={{ flexDirection: 'row', gap: 0, marginBottom: 14, backgroundColor: GRAY_100, borderRadius: 10, padding: 3 }}>
              {(['info', 'history'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setProfileTab(tab)}
                  style={{ flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8, backgroundColor: profileTab === tab ? '#fff' : 'transparent' }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: profileTab === tab }}
                  accessibilityLabel={tab === 'info' ? 'Client info' : 'Booking history'}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: profileTab === tab ? GRAY_900 : GRAY_400 }}>
                    {tab === 'info' ? 'Info' : 'History'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {profileTab === 'info' && (
                <View>
                  {/* Contact info */}
                  {[
                    { l: 'Email', v: profile.email ?? '—' },
                    { l: 'Phone', v: profile.phone ? formatPhoneDisplay(profile.phone) : '—' },
                    { l: 'Birthday', v: profile.birthday ? new Date(profile.birthday).toLocaleDateString('en-CA', { month: 'long', day: 'numeric' }) : '—' },
                    { l: 'Last visit', v: profile.lastVisit ? new Date(profile.lastVisit).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
                  ].map(({ l, v }) => (
                    <View key={l} style={s.detailRow}>
                      <Text style={s.detailLabel}>{l}</Text>
                      <Text style={s.detailValue}>{v as string}</Text>
                    </View>
                  ))}

                  {/* Notes */}
                  {profile.notes ? (
                    <View style={[s.notesBox, { marginTop: 8 }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: GRAY_500, marginBottom: 4 }}>NOTES</Text>
                      <Text style={s.notesText}>{profile.notes}</Text>
                    </View>
                  ) : null}

                  {/* Tags */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={[s.detailLabel, { marginBottom: 6 }]}>Tags</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {(profile.tags ?? []).map(tag => (
                        <TouchableOpacity key={tag} disabled={updateClientMutation.isPending} onPress={() => removeTag(profile, tag)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BRAND_LT, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND }}>{tag}</Text>
                          <Ionicons name="close" size={12} color={BRAND} />
                        </TouchableOpacity>
                      ))}
                      {(profile.tags ?? []).length === 0 && <Text style={s.sub}>No tags yet</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TextInput style={[s.input, { flex: 1 }]} placeholder="Add a tag (e.g. VIP)" placeholderTextColor={GRAY_400}
                        value={tagInput} onChangeText={setTagInput} autoCapitalize="none" returnKeyType="done" onSubmitEditing={() => addTag(profile)} />
                      <TouchableOpacity style={[s.btnSecondary, { paddingHorizontal: 18, justifyContent: 'center' }]}
                        disabled={updateClientMutation.isPending || !tagInput.trim()} onPress={() => addTag(profile)}>
                        <Text style={s.btnSecondaryText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* CASL consent */}
                  <View style={[s.detailRow, { marginTop: 14, paddingVertical: 12, backgroundColor: GRAY_50, borderRadius: 12, paddingHorizontal: 12 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: GRAY_900 }}>Marketing consent (CASL)</Text>
                      <Text style={{ fontSize: 12, color: GRAY_500, marginTop: 2 }}>
                        {profile.marketingOptOut ? 'Opted out — do not send marketing messages' : 'Opted in — may receive marketing messages'}
                      </Text>
                    </View>
                    <Switch
                      value={!profile.marketingOptOut}
                      onValueChange={() => toggleMarketingConsent(profile)}
                      trackColor={{ true: BRAND, false: GRAY_200 }}
                      thumbColor="#fff"
                      accessibilityLabel="Marketing consent toggle"
                    />
                  </View>

                  {/* Block toggle */}
                  <View style={[s.detailRow, { marginTop: 8, paddingVertical: 12, backgroundColor: profile.isBlocked ? '#FEF2F2' : GRAY_50, borderRadius: 12, paddingHorizontal: 12 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: profile.isBlocked ? '#DC2626' : GRAY_900 }}>
                        {profile.isBlocked ? 'Blocked from booking' : 'Allow online booking'}
                      </Text>
                      <Text style={{ fontSize: 12, color: GRAY_500, marginTop: 2 }}>
                        {profile.isBlocked ? profile.blockedReason ?? 'Client cannot book online' : 'Client can book online'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      disabled={blockingClient}
                      onPress={() => toggleBlock(profile)}
                      style={{ padding: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel={profile.isBlocked ? 'Unblock client' : 'Block client'}
                    >
                      {blockingClient
                        ? <ActivityIndicator size="small" color={BRAND} />
                        : <Ionicons name={profile.isBlocked ? 'lock-open-outline' : 'ban-outline'} size={22} color={profile.isBlocked ? '#059669' : '#DC2626'} />
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {profileTab === 'history' && (
                <View>
                  {historyLoading ? (
                    <ActivityIndicator color={BRAND} style={{ marginTop: 20 }} />
                  ) : profileHistory.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                      <Ionicons name="calendar-outline" size={36} color={GRAY_400} />
                      <Text style={{ fontSize: 14, color: GRAY_500, marginTop: 10 }}>No appointments yet</Text>
                    </View>
                  ) : profileHistory.map(appt => (
                    <View key={appt.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: GRAY_100 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: GRAY_900 }}>{appt.service.name}</Text>
                          <Text style={{ fontSize: 12, color: GRAY_500, marginTop: 2 }}>
                            {new Date(appt.startsAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })} · {appt.staff.user.name}
                          </Text>
                        </View>
                        <View style={{
                          backgroundColor: appt.status === 'COMPLETED' ? '#D1FAE5' : appt.status === 'NO_SHOW' ? '#FEE2E2' : appt.status === 'CANCELLED' ? '#FEF3C7' : GRAY_100,
                          borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: appt.status === 'COMPLETED' ? '#059669' : appt.status === 'NO_SHOW' ? '#DC2626' : appt.status === 'CANCELLED' ? '#D97706' : GRAY_500 }}>
                            {appt.status}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={[s.sheetActions, { marginTop: 12 }]}>
              <TouchableOpacity style={s.btnPrimary} onPress={() => { const c = profile; setProfile(null); onMessage(c); nav.navigate('Messages'); }}>
                <Text style={s.btnPrimaryText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary} onPress={() => { setProfile(null); nav.navigate('Calendar', { screen: 'Book' }); }}>
                <Text style={s.btnSecondaryText}>Book appointment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGhost} onPress={() => setProfile(null)}><Text style={s.btnGhostText}>Close</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Duplicate detection modal */}
      <Modal visible={dupeModal} animationType="slide" onRequestClose={() => { setDupeModal(false); setMerging(null); }}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => { setDupeModal(false); setMerging(null); }} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={GRAY_700} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Duplicate Customers</Text>
            <View style={{ width: 24 }} />
          </View>

          {dupeBusy && !dupeGroups.length ? (
            <View style={s.center}><ActivityIndicator size="large" color={BRAND} /></View>
          ) : merging ? (
            /* Merge detail — pick primary */
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: GRAY_900, marginBottom: 4 }}>Choose the primary record</Text>
              <Text style={{ fontSize: 13, color: GRAY_500, marginBottom: 16 }}>All appointments and history from the others will be moved here. The others will be deleted.</Text>
              {merging.clients.map(c => (
                <TouchableOpacity key={c.id} onPress={() => setPrimaryId(c.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 10,
                    borderWidth: 2, borderColor: primaryId === c.id ? BRAND : GRAY_200, backgroundColor: primaryId === c.id ? BRAND_LT : '#fff' }}
                  accessibilityRole="radio" accessibilityState={{ selected: primaryId === c.id }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: GRAY_900 }}>{c.name}</Text>
                    <Text style={{ fontSize: 12, color: GRAY_500 }}>{c.email}{c.phone ? ` · ${formatPhoneDisplay(c.phone)}` : ''}</Text>
                    <Text style={{ fontSize: 12, color: GRAY_400 }}>{c.appointments} appointment{c.appointments !== 1 ? 's' : ''} · joined {new Date(c.createdAt).toLocaleDateString()}</Text>
                  </View>
                  {primaryId === c.id && <Ionicons name="checkmark-circle" size={22} color={BRAND} />}
                </TouchableOpacity>
              ))}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={[s.btnPrimary, { flex: 1, opacity: !primaryId || dupeBusy ? 0.5 : 1 }]}
                  disabled={!primaryId || dupeBusy} onPress={() => doMerge(merging, primaryId)}
                  accessibilityRole="button" accessibilityLabel="Merge duplicates">
                  {dupeBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Merge</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnSecondary, { flex: 1 }]} onPress={() => setMerging(null)}
                  accessibilityRole="button" accessibilityLabel="Cancel">
                  <Text style={s.btnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {dupeGroups.length === 0 ? (
                <View style={s.center}>
                  <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
                  <Text style={[s.emptyText, { marginTop: 12 }]}>No duplicate customers found.</Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 13, color: GRAY_500, marginBottom: 16 }}>{dupeGroups.length} potential duplicate group{dupeGroups.length !== 1 ? 's' : ''} found.</Text>
                  {dupeGroups.map((group, i) => (
                    <View key={i} style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: GRAY_200, marginBottom: 12, overflow: 'hidden' }}>
                      {group.clients.map((c, ci) => (
                        <View key={c.id} style={{ padding: 12, borderBottomWidth: ci < group.clients.length - 1 ? 1 : 0, borderBottomColor: GRAY_100 }}>
                          <Text style={{ fontWeight: '600', color: GRAY_900 }}>{c.name}</Text>
                          <Text style={{ fontSize: 12, color: GRAY_500 }}>{c.email}{c.phone ? ` · ${formatPhoneDisplay(c.phone)}` : ''}</Text>
                          <Text style={{ fontSize: 12, color: GRAY_400 }}>{c.appointments} appt{c.appointments !== 1 ? 's' : ''}</Text>
                        </View>
                      ))}
                      <TouchableOpacity style={{ padding: 12, backgroundColor: BRAND_LT, alignItems: 'center' }}
                        onPress={() => { setMerging(group); setPrimaryId(group.clients[0]?.id ?? ''); }}
                        accessibilityRole="button" accessibilityLabel="Merge this group">
                        <Text style={{ fontWeight: '700', color: BRAND }}>Merge these customers</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}


export { ClientsScreen };
