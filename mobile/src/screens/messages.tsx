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

function MessagesScreen({ initialClient, onClearClient, onUnreadChanged }: { initialClient:Client|null; onClearClient:()=>void; onUnreadChanged:(count:number)=>void }) {
  const navigation = useNavigation<any>();
  const [threads, setThreads]   = useState<Array<{clientId:string;client:{name:string;email?:string|null};lastMessage:string;fromClient:boolean;read:boolean;unreadCount:number;archived?:boolean;createdAt:string}>>([]);
  const [selected, setSelected] = useState<Client|null>(null);
  const [selectedArchived, setSelectedArchived] = useState(false);
  const [msgs, setMsgs]         = useState<Message[]>([]);
  const [reply, setReply]       = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'all'|'unread'|'archived'>('all');
  const [channel, setChannel]   = useState<'ALL'|'IN_APP'|'SMS'>('ALL');
  const scrollRef = useRef<ScrollView>(null);

  const loadThreads = useCallback(async () => {
    try {
      const filterPart = filter==='unread'?'?unread=true':filter==='archived'?'?archived=true':'?';
      const channelPart = channel !== 'ALL' ? `${filterPart === '?' ? '' : '&'}channel=${channel}` : '';
      const url = `/businesses/${bizId()}/messages${filterPart}${channelPart}`;
      const [threadData, unread] = await Promise.all([
        api<any[]>(url),
        api<{unreadMessages:number}>(`/businesses/${bizId()}/messages/unread-count`).catch(() => ({ unreadMessages:0 })),
      ]);
      setThreads(threadData);
      onUnreadChanged(unread.unreadMessages);
    }
    catch {}
    finally { setLoading(false); }
  }, [onUnreadChanged, filter, channel]);
  useEffect(()=>{
    const timer = setTimeout(loadThreads, 0);
    return () => clearTimeout(timer);
  },[loadThreads]);
  useEffect(() => navigation.addListener('focus', loadThreads), [navigation, loadThreads]);
  useEffect(() => {
    const interval = setInterval(loadThreads, 10_000);
    return () => clearInterval(interval);
  }, [loadThreads]);

  useEffect(()=>{
    if (initialClient) { openThread(initialClient, false); onClearClient(); }
  },[initialClient]);

  async function loadMessages(clientId: string) {
    try {
      const data = await api<Message[]>(`/businesses/${bizId()}/clients/${clientId}/messages`);
      setMsgs(data);
      setTimeout(()=>scrollRef.current?.scrollToEnd({animated:false}),50);
    } catch {}
  }

  async function openThread(c:Client, archived = false) {
    setSelected(c);
    setSelectedArchived(archived);
    try {
      const data = await api<Message[]>(`/businesses/${bizId()}/clients/${c.id}/messages`);
      setMsgs(data);
      const unread = await api<{unreadMessages:number}>(`/businesses/${bizId()}/clients/${c.id}/messages/read`,{method:'PATCH'});
      onUnreadChanged(unread.unreadMessages);
      setThreads((prev) => prev.map((thread) => thread.clientId === c.id ? { ...thread, read:true, unreadCount:0 } : thread));
    } catch {}
    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:false}),100);
  }

  // FIX C: auto-refresh messages while a thread is open
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => loadMessages(selected.id), 5000);
    return () => clearInterval(interval);
  }, [selected]);

  async function send() {
    if (!reply.trim()||!selected) return;
    setSending(true);
    try {
      const res = await api<{sms?:{sent:boolean;reason?:string}}>(`/businesses/${bizId()}/clients/${selected.id}/messages/reply`,{
        method:'POST', body:JSON.stringify({content:reply.trim()}),
      });
      if (res?.sms?.reason === 'send_failed') Alert.alert('Sent in-app', 'The SMS could not be delivered.');
      else if (res?.sms?.reason === 'client_must_text_first') Alert.alert('Sent in-app', 'SMS is available after the client texts first.');
      setReply('');
      const data = await api<Message[]>(`/businesses/${bizId()}/clients/${selected.id}/messages`);
      setMsgs(data);
      setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),50);
    } catch(e){ Alert.alert('Error','Could not send message'); }
    finally { setSending(false); }
  }

  if (selected) return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>{setSelected(null);loadThreads();}} style={{marginRight:12}}
          accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={GRAY_700}/>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{selected.name}</Text>
        <TouchableOpacity onPress={async()=>{try{const next=!selectedArchived;await api(`/businesses/${bizId()}/messages/${selected.id}/archive`,{method:'PATCH',body:JSON.stringify({archived:next})});setSelected(null);loadThreads();}catch(e){Alert.alert(selectedArchived?'Could not restore':'Could not archive',e instanceof Error?e.message:'Please try again.');}}}
          accessibilityRole="button" accessibilityLabel={selectedArchived?'Restore conversation':'Archive conversation'}><Text style={{color:'#DC2626',fontWeight:'700'}}>{selectedArchived?'Restore':'Archive'}</Text></TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={Platform.OS==='ios'?88:0}>
        <ScrollView ref={scrollRef} contentContainerStyle={{padding:16}} showsVerticalScrollIndicator={false}>
          {msgs.length===0&&<Text style={[s.emptyText,{textAlign:'center',marginTop:40}]}>No messages yet</Text>}
          {msgs.map(m=>(
            <View key={m.id} style={[s.bubble, m.fromClient?s.bubbleLeft:s.bubbleRight]}>
              <Text style={[s.bubbleText, m.fromClient?s.bubbleTextLeft:s.bubbleTextRight]}>{m.content}</Text>
              <Text style={s.bubbleTime}>{fmtTime(m.createdAt)}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.composeRow}>
          <>
              <TextInput style={s.composeInput} placeholder="Type a message…" placeholderTextColor={GRAY_400}
                value={reply} onChangeText={setReply} multiline returnKeyType="send" onSubmitEditing={send}/>
              <TouchableOpacity style={[s.sendBtn, (!reply.trim()||sending)&&{opacity:0.4}]}
                disabled={!reply.trim()||sending} onPress={send}
                accessibilityRole="button" accessibilityLabel="Send message">
                <Ionicons name="send" size={18} color="#fff"/>
              </TouchableOpacity>
          </>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Messages</Text></View>
      <View style={{flexDirection:'row',gap:8,paddingHorizontal:16,paddingBottom:8}}>
        {(['all','unread','archived'] as const).map(value=><TouchableOpacity key={value} onPress={()=>setFilter(value)} style={[cal.filterChip,filter===value&&cal.filterChipOn]} accessibilityRole="button" accessibilityLabel={value} accessibilityState={{ selected: filter===value }}><Text style={[cal.filterText,filter===value&&cal.filterTextOn]}>{value}</Text></TouchableOpacity>)}
      </View>
      <View style={{ flexDirection:'row', gap:6, marginBottom:8, paddingHorizontal:16 }}>
        {(['ALL','IN_APP','SMS'] as const).map(c => (
          <TouchableOpacity key={c} onPress={()=>setChannel(c)}
            style={[ms.methodChip, channel===c && ms.methodChipOn]}
            accessibilityRole="button"
            accessibilityLabel={c==='ALL'?'All':c==='IN_APP'?'In-app':'SMS'}
            accessibilityState={{ selected: channel===c }}>
            <Text style={[ms.methodChipText, channel===c && {color:BRAND}]}>
              {c==='ALL'?'All':c==='IN_APP'?'In-app':'SMS'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading?<ActivityIndicator color={BRAND} style={{marginTop:40}}/>:(
        <FlatList
          data={threads}
          keyExtractor={t=>t.clientId}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No messages yet</Text></View>}
          showsVerticalScrollIndicator={false}
          renderItem={({item:t})=>(
            <TouchableOpacity style={[s.card, t.unreadCount>0 && { borderColor:'#FCA5A5', backgroundColor:'#FEF2F2' }]} activeOpacity={0.7}
              onPress={()=>openThread({id:t.clientId,...t.client}, !!t.archived)}
              accessibilityRole="button"
              accessibilityLabel={`Open conversation with ${t.client.name}`}>
              <View style={s.avatar}><Text style={s.avatarText}>{t.client.name.slice(0,2).toUpperCase()}</Text></View>
              <View style={{flex:1}}>
                <View style={s.row}>
                  <Text style={[s.clientName, t.unreadCount>0 && { color:'#991B1B', fontWeight:'800' }]}>{t.client.name}</Text>
                  {t.unreadCount>0&&(
                    <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
                      <Text style={{ color:'#DC2626', fontSize:10, fontWeight:'800' }}>{t.unreadCount} UNREAD</Text>
                      <View style={[s.unreadDot,{ backgroundColor:'#DC2626' }]}/>
                    </View>
                  )}
                </View>
                <Text style={s.sub} numberOfLines={1}>{t.lastMessage}</Text>
              </View>
              <Text style={s.msgTime}>{fmtTime(t.createdAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

export { MessagesScreen };
