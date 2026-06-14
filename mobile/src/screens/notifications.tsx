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

function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all'|'unread'>('all');

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try { setItems(await api<NotificationItem[]>('/notifications')); }
    catch(e){ Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load notifications'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function open(item: NotificationItem) {
    if (!item.read) {
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, read:true } : n));
      await api(`/notifications/${item.id}/read`, { method:'POST' }).catch(() => {});
    }
    if (item.linkUrl) Alert.alert(item.title, item.body || 'Open this item from the web dashboard for the linked detail.');
  }

  async function markAll() {
    setItems(prev => prev.map(n => ({ ...n, read:true })));
    await api('/notifications/read-all', { method:'POST' }).catch(() => {});
  }

  function clearHistory() {
    Alert.alert('Clear alert history?', 'This permanently removes all alerts from this account.', [
      { text:'Cancel', style:'cancel' },
      { text:'Clear', style:'destructive', onPress:async() => {
        try {
          await api('/notifications', { method:'DELETE' });
          setItems([]);
        } catch (e) {
          Alert.alert('Could not clear alerts', e instanceof Error ? e.message : 'Please try again.');
        }
      }},
    ]);
  }

  const unread = items.filter(n => !n.read).length;
  const visible = filter === 'unread' ? items.filter(n => !n.read) : items;
  const iconFor = (kind: NotificationItem['kind']) =>
    kind === 'PAYMENT' ? 'card-outline' :
    kind === 'SYSTEM' ? 'shield-checkmark-outline' :
    kind === 'BOOKING_NEW' ? 'calendar-outline' : 'chatbubble-ellipses-outline';

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={BRAND}/></View>;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Alerts</Text>
        <View style={{ flexDirection:'row', gap:12 }}>
          {unread > 0 && (
            <TouchableOpacity onPress={markAll}>
              <Text style={{ color:BRAND, fontSize:12, fontWeight:'700' }}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {items.length > 0 && (
            <TouchableOpacity onPress={clearHistory}>
              <Text style={{ color:'#DC2626', fontSize:12, fontWeight:'700' }}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={{ flexDirection:'row', gap:8, paddingHorizontal:16, paddingTop:12 }}>
        {(['all','unread'] as const).map(k => (
          <TouchableOpacity key={k} onPress={()=>setFilter(k)}
            style={{ paddingHorizontal:14, paddingVertical:8, borderRadius:99, backgroundColor:filter===k?BRAND:GRAY_100 }}>
            <Text style={{ fontSize:12, fontWeight:'700', color:filter===k?'#fff':GRAY_700 }}>
              {k === 'all' ? `All (${items.length})` : `Unread (${unread})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={visible}
        keyExtractor={i=>i.id}
        contentContainerStyle={[s.listContent, visible.length===0 && { flexGrow:1, justifyContent:'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={BRAND}/>}
        ListEmptyComponent={<Text style={s.emptyText}>No alerts to show.</Text>}
        renderItem={({item})=>{
          const urgentMessage = item.title.startsWith('Urgent:');
          return (
          <TouchableOpacity style={[s.card, !item.read && { borderColor:urgentMessage?'#FCA5A5':BRAND_LT, backgroundColor:urgentMessage?'#FEF2F2':'#FFFBF6' }]} onPress={()=>open(item)}>
            <View style={{ width:36, height:36, borderRadius:12, backgroundColor:item.read?GRAY_100:urgentMessage?'#FEE2E2':BRAND_LT, alignItems:'center', justifyContent:'center' }}>
              <Ionicons name={urgentMessage?'chatbubble-ellipses':iconFor(item.kind) as any} size={18} color={item.read?GRAY_500:urgentMessage?'#DC2626':BRAND}/>
            </View>
            <View style={s.cardBody}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <Text style={[s.clientName, { flex:1 }, urgentMessage&&!item.read&&{ color:'#991B1B', fontWeight:'800' }]} numberOfLines={1}>{item.title}</Text>
                {!item.read && (
                  <View style={{ width:8, height:8, borderRadius:4, backgroundColor:urgentMessage?'#DC2626':BRAND }}/>
                )}
              </View>
              {!!item.body && <Text style={s.sub} numberOfLines={2}>{item.body}</Text>}
              <Text style={s.dateText}>{new Date(item.createdAt).toLocaleDateString([], { month:'short', day:'numeric' })} {fmtTime(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}}
      />
    </SafeAreaView>
  );
}

export { NotificationsScreen };
