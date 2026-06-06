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

function ClientsScreen({ onMessage }: { onMessage:(c:Client)=>void }) {
  const nav = useNavigation<any>();
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile]   = useState<Client|null>(null);

  const load = useCallback(async (silent=false, q='') => {
    if (!silent) setLoading(true);
    try {
      const res = await api<{data: Client[]}>(`/businesses/${bizId()}/clients${q?`?search=${encodeURIComponent(q)}`:''}`);
      setClients(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{
    const t = setTimeout(()=>load(true,search),400);
    return ()=>clearTimeout(t);
  },[search, load]);

  // Hardware back closes the open profile instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (profile) { setProfile(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [profile]);

  function initials(name:string){ return name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase(); }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={BRAND}/></View>;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Customers</Text></View>
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={GRAY_400} style={{marginRight:8}}/>
        <TextInput style={s.searchInput} placeholder="Search by name, email…"
          placeholderTextColor={GRAY_400} value={search} onChangeText={setSearch}/>
      </View>
      <FlatList
        data={clients}
        keyExtractor={c=>c.id}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No customers found</Text></View>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true,search);}} tintColor={BRAND}/>}
        showsVerticalScrollIndicator={false}
        renderItem={({item:c})=>(
          <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={()=>setProfile(c)}>
            <View style={s.avatar}><Text style={s.avatarText}>{initials(c.name)}</Text></View>
            <View style={{flex:1}}>
              <Text style={s.clientName}>{c.name}</Text>
              <Text style={s.sub}>{c.email}</Text>
              {c.phone&&<Text style={s.sub}>{c.phone}</Text>}
              {c.totalVisits!==undefined&&<Text style={s.sub}>{c.totalVisits} visit{c.totalVisits!==1?'s':''}</Text>}
            </View>
            <TouchableOpacity style={s.msgBtn} onPress={()=>onMessage(c)}>
              <Ionicons name="chatbubble-outline" size={18} color={BRAND}/>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* Customer profile */}
      {profile && (
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={()=>setProfile(null)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={()=>{}}>
            <View style={s.sheetHandle}/>
            <View style={{ alignItems:'center', marginBottom:16 }}>
              <View style={[s.avatarLg,{ marginBottom:10 }]}><Text style={s.avatarLgText}>{initials(profile.name)}</Text></View>
              <Text style={s.sheetTitle}>{profile.name}</Text>
            </View>
            {[
              { l:'Email', v:profile.email },
              { l:'Phone', v:profile.phone || '—' },
              { l:'Visits', v: profile.totalVisits!==undefined ? String(profile.totalVisits) : '—' },
              { l:'Last visit', v: profile.lastVisit ? new Date(profile.lastVisit).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—' },
            ].map(({l,v})=>(
              <View key={l} style={s.detailRow}>
                <Text style={s.detailLabel}>{l}</Text>
                <Text style={s.detailValue}>{v}</Text>
              </View>
            ))}
            <View style={s.sheetActions}>
              <TouchableOpacity style={s.btnPrimary} onPress={()=>{ const c=profile; setProfile(null); onMessage(c); nav.navigate('Messages'); }}>
                <Text style={s.btnPrimaryText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary} onPress={()=>{ setProfile(null); nav.navigate('Calendar', { screen: 'Book' }); }}>
                <Text style={s.btnSecondaryText}>Book appointment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGhost} onPress={()=>setProfile(null)}><Text style={s.btnGhostText}>Close</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

export { ClientsScreen };
