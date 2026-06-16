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

function ClientsScreen({ onMessage }: { onMessage: (c: Client) => void }) {
  const { user } = getAuth();
  const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN';
  
  const nav = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState<Client | null>(null);
  const [tagInput, setTagInput] = useState('');

  const { data: clients = [], isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => {
      if (!isOwner) throw new Error('Access denied. Only owners can view the client list.');
      return api<{ data: Client[] }>(`/businesses/${bizId()}/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(res => res.data);
    },
    enabled: isOwner,
  });

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

  // Hardware back closes the open profile instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (profile) { setProfile(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [profile]);

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

  if (isLoading && !isFetching) return <View style={s.center}><ActivityIndicator size="large" color={BRAND} /></View>;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Customers</Text></View>
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
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={BRAND} />}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: c }) => (
          <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={() => setProfile(c)}>
            <View style={s.avatar}><Text style={s.avatarText}>{initials(c.name)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.clientName}>{c.name}</Text>
              <Text style={s.sub}>{c.email}</Text>
              {c.phone && <Text style={s.sub}>{formatPhoneDisplay(c.phone)}</Text>}
              {c.totalVisits !== undefined && <Text style={s.sub}>{c.totalVisits} visit{c.totalVisits !== 1 ? 's' : ''}</Text>}
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
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => { }}>
            <View style={s.sheetHandle} />
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={[s.avatarLg, { marginBottom: 10 }]}><Text style={s.avatarLgText}>{initials(profile.name)}</Text></View>
              <Text style={s.sheetTitle}>{profile.name}</Text>
            </View>
            {[
              { l: 'Email', v: profile.email },
              { l: 'Phone', v: profile.phone ? formatPhoneDisplay(profile.phone) : '—' },
              { l: 'Visits', v: (profile as any).totalVisits !== undefined ? String((profile as any).totalVisits) : '—' },
              { l: 'Last visit', v: (profile as any).lastVisit ? new Date((profile as any).lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
            ].map(({ l, v }) => (
              <View key={l} style={s.detailRow}>
                <Text style={s.detailLabel}>{l}</Text>
                <Text style={s.detailValue}>{v}</Text>
              </View>
            ))}
            <View style={{ marginTop: 10 }}>
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
                <TouchableOpacity style={[s.btnSecondary, { paddingHorizontal: 18, justifyContent: 'center' }]} disabled={updateClientMutation.isPending || !tagInput.trim()} onPress={() => addTag(profile)}>
                  <Text style={s.btnSecondaryText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.sheetActions}>
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
    </SafeAreaView>
  );
}


export { ClientsScreen };
