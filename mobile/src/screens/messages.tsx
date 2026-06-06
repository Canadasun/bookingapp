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
  const [threads, setThreads]   = useState<Array<{clientId:string;client:{name:string;email:string};lastMessage:string;fromClient:boolean;read:boolean;unreadCount:number;createdAt:string}>>([]);
  const [selected, setSelected] = useState<Client|null>(null);
  const [msgs, setMsgs]         = useState<Message[]>([]);
  const [reply, setReply]       = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [plan, setPlan]         = useState<string>('FREE');
  const scrollRef = useRef<ScrollView>(null);

  const loadThreads = useCallback(async () => {
    try {
      const [threadData, bizData, unread] = await Promise.all([
        api<any[]>(`/businesses/${bizId()}/messages`),
        api<any>(`/businesses/${bizId()}`).catch(() => ({ plan: 'FREE' })),
        api<{unreadMessages:number}>(`/businesses/${bizId()}/messages/unread-count`).catch(() => ({ unreadMessages:0 })),
      ]);
      setThreads(threadData);
      onUnreadChanged(unread.unreadMessages);
      setPlan(bizData.plan);
    }
    catch {}
    finally { setLoading(false); }
  }, [onUnreadChanged]);
  useEffect(()=>{ loadThreads(); },[loadThreads]);
  useEffect(() => navigation.addListener('focus', loadThreads), [navigation, loadThreads]);
  useEffect(() => {
    const interval = setInterval(loadThreads, 10_000);
    return () => clearInterval(interval);
  }, [loadThreads]);

  useEffect(()=>{
    if (initialClient) { openThread(initialClient); onClearClient(); }
  },[initialClient]);

  async function openThread(c:Client) {
    setSelected(c);
    try {
      const data = await api<Message[]>(`/businesses/${bizId()}/clients/${c.id}/messages`);
      setMsgs(data);
      const unread = await api<{unreadMessages:number}>(`/businesses/${bizId()}/clients/${c.id}/messages/read`,{method:'PATCH'});
      onUnreadChanged(unread.unreadMessages);
      setThreads((prev) => prev.map((thread) => thread.clientId === c.id ? { ...thread, read:true, unreadCount:0 } : thread));
    } catch {}
    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:false}),100);
  }

  async function send() {
    if (!reply.trim()||!selected) return;
    if (plan === 'FREE') {
      Alert.alert('Upgrade Required', 'Messaging is a paid feature. Please upgrade to BASIC or PRO to reply to clients.');
      return;
    }
    setSending(true);
    try {
      await api(`/businesses/${bizId()}/clients/${selected.id}/messages/reply`,{
        method:'POST', body:JSON.stringify({content:reply.trim()}),
      });
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
        <TouchableOpacity onPress={()=>{setSelected(null);loadThreads();}} style={{marginRight:12}}>
          <Ionicons name="arrow-back" size={22} color={GRAY_700}/>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{selected.name}</Text>
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
          {plan === 'FREE' ? (
            <View style={{flex:1, backgroundColor:GRAY_50, borderRadius:12, padding:12, alignItems:'center', borderStyle:'dashed', borderWidth:1, borderColor:GRAY_200}}>
              <Text style={{fontSize:12, color:GRAY_500, textAlign:'center'}}>
                🔒 Messaging is a paid feature. Upgrade to BASIC or PRO to reply to clients.
              </Text>
            </View>
          ) : (
            <>
              <TextInput style={s.composeInput} placeholder="Type a message…" placeholderTextColor={GRAY_400}
                value={reply} onChangeText={setReply} multiline returnKeyType="send" onSubmitEditing={send}/>
              <TouchableOpacity style={[s.sendBtn, (!reply.trim()||sending)&&{opacity:0.4}]}
                disabled={!reply.trim()||sending} onPress={send}>
                <Ionicons name="send" size={18} color="#fff"/>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Messages</Text></View>
      {loading?<ActivityIndicator color={BRAND} style={{marginTop:40}}/>:(
        <FlatList
          data={threads}
          keyExtractor={t=>t.clientId}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No messages yet</Text></View>}
          showsVerticalScrollIndicator={false}
          renderItem={({item:t})=>(
            <TouchableOpacity style={[s.card, t.unreadCount>0 && { borderColor:'#FCA5A5', backgroundColor:'#FEF2F2' }]} activeOpacity={0.7}
              onPress={()=>openThread({id:t.clientId,...t.client})}>
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
