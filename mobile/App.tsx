import 'react-native-screens';
import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, SectionList,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform, Modal,
  StatusBar, KeyboardAvoidingView, RefreshControl, BackHandler, Linking, Switch, Share,
} from 'react-native';

// ── Shared modules (extracted from this file into src/) ─────────────────────
import { WEB_URL, API_BASE, BIZ_ID, uploadUri } from './src/config';
import { BRAND, BRAND_LT, GRAY_50, GRAY_100, GRAY_200, GRAY_400, GRAY_500, GRAY_700, GRAY_900, STATUS_COLOR } from './src/theme';
import type { User, Appointment, ServiceCategory, Service, AvailabilityRule, Staff, Slot, BookingSlot, Client, Message, NotificationItem, NotificationDelivery, TaskItem, ServiceDueItem, ClientPortalAppointment, ClientPortalMessageThread, ClientPortalOffer } from './src/types';
import { fmtTime, fmtDur, normalizePhoneClient } from './src/format';
import { setAuth, getAuth, bizId, listeners, persistAuth, loadPersistedAuth, refreshSession } from './src/auth';
import { api, registerPushNotifications } from './src/api';
import { s, cal, co, ms, dst } from './src/styles';
import { ErrorBoundary, Pill, PriceTag, VerifiedPill } from './src/components';
import { CalendarScreen } from './src/screens/calendar';
import { CheckoutScreen } from './src/screens/checkout';
import { BookScreen } from './src/screens/book';
import { ClientsScreen } from './src/screens/clients';
import { MessagesScreen } from './src/screens/messages';
import { NotificationsScreen } from './src/screens/notifications';
import { MenuScreen } from './src/screens/menu';
import { LoginScreen, ForgotPasswordScreen, RegisterScreen, ChangePasswordScreen, ClientPortalScreen } from './src/screens/auth';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

// ── Tab navigator ────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();
const CalStack = createNativeStackNavigator();

// The Calendar tab is a native stack so "+ New appointment" pushes the Book
// screen with a real header + swipe-back, instead of opening a hidden tab that
// had no way back. Headers stay hidden — each screen renders its own.
function CalendarStack() {
  return (
    <CalStack.Navigator screenOptions={{ headerShown: false }}>
      <CalStack.Screen name="CalendarHome" component={CalendarScreen}/>
      <CalStack.Screen name="Book" component={BookScreen}/>
    </CalStack.Navigator>
  );
}

// The Menu tab is a native stack too: MenuHome is the list, MenuDetail renders a
// drill-in chosen by its `view` route param. Same component, two routes — so every
// drill-in (and nested ones) pushes with a header back + swipe-back.
const MenuStk = createNativeStackNavigator();
function MenuStack({ onLogout }: { onLogout: ()=>void }) {
  return (
    <MenuStk.Navigator screenOptions={{ headerShown: false }}>
      <MenuStk.Screen name="MenuHome">{()=><MenuScreen onLogout={onLogout}/>}</MenuStk.Screen>
      <MenuStk.Screen name="MenuDetail">{()=><MenuScreen onLogout={onLogout}/>}</MenuStk.Screen>
    </MenuStk.Navigator>
  );
}

// The tab bar lives inside the SafeAreaProvider so it can read the bottom inset.
// Without this the bar sat flush at height:64 and its targets overlapped the home
// indicator — "extreme down, hard to reach". We lift it above the inset and give
// the row more height + breathing room so every tab is an easy tap.
function MainTabs({ msgClient, setMsgClient, onLogout }: {
  msgClient: Client|null;
  setMsgClient: (c:Client|null)=>void;
  onLogout: ()=>void;
}) {
  const insets = useSafeAreaInsets();
  const barHeight = 60 + Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: GRAY_900,
        tabBarInactiveTintColor: GRAY_400,
        // Active tab = rounded grey pill behind the icon + label.
        tabBarActiveBackgroundColor: GRAY_100,
        tabBarStyle: {
          backgroundColor:'#fff', borderTopColor:GRAY_100,
          height: barHeight,
          paddingTop:8, paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal:6,
        },
        tabBarItemStyle: { borderRadius:16, marginHorizontal:4, marginTop:6, marginBottom:6, paddingVertical:2 },
        tabBarLabelStyle: { fontSize:11, fontWeight:'600' },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string,[string,string]> = {
            Calendar:['calendar','calendar-outline'], Checkout:['card','card-outline'],
            Customers:['people','people-outline'], Messages:['chatbubbles','chatbubbles-outline'],
            Alerts:['notifications','notifications-outline'], Menu:['menu','menu-outline'],
          };
          const pair = icons[route.name] ?? ['ellipse','ellipse-outline'];
          return <Ionicons name={(focused ? pair[0] : pair[1]) as any} size={24} color={color}/>;
        },
      })}
    >
      <Tab.Screen name="Calendar" component={CalendarStack}/>
      <Tab.Screen name="Checkout" component={CheckoutScreen}/>
      <Tab.Screen name="Customers">
        {()=><ClientsScreen onMessage={c=>setMsgClient(c)}/>}
      </Tab.Screen>
      <Tab.Screen name="Messages">
        {()=><MessagesScreen initialClient={msgClient} onClearClient={()=>setMsgClient(null)}/>}
      </Tab.Screen>
      <Tab.Screen name="Alerts" component={NotificationsScreen}/>
      <Tab.Screen name="Menu">
        {()=><MenuStack onLogout={onLogout}/>}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [token, setToken]             = useState<string|null>(null);
  const [user, setUser]               = useState<User|null>(null);
  const [msgClient, setMsgClient]     = useState<Client|null>(null);
  const [_, forceRender]              = useState(0);
  const [booting, setBooting]         = useState(true);
  const [authView, setAuthView]       = useState<'login'|'register'|'forgot'>('login');

  useEffect(()=>{ const unsub=()=>forceRender(n=>n+1); listeners.add(unsub); return ()=>{ listeners.delete(unsub); }; },[]);

  // Restore a persisted session on cold start. The stored access token may be
  // expired (15m), so refresh it via the saved refresh token (7d). If that
  // fails, clear the session and fall through to the login screen.
  useEffect(()=>{ (async()=>{
    const hadRefresh = await loadPersistedAuth();
    if (hadRefresh) {
      const ok = await refreshSession();
      if (!ok) { setAuth(null,null,null); await persistAuth(); }
    }
    const a = getAuth(); setToken(a.token); setUser(a.user);
    setBooting(false);
    registerPushNotifications();
  })(); },[]);

  function handleLogin(t:string, r:string, u:User) { setAuth(t,u,r); setToken(t); setUser(u); persistAuth(); registerPushNotifications(); }
  function handleLogout() { setAuth(null,null,null); setToken(null); setUser(null); persistAuth(); }

  if (booting) return (
    <ErrorBoundary>
      <SafeAreaView style={s.screen}>
        <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
          <ActivityIndicator color={BRAND}/>
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );

  if (!token) return (
    <ErrorBoundary>
      {authView === 'register'
        ? <RegisterScreen onRegistered={handleLogin} onBack={()=>setAuthView('login')}/>
        : authView === 'forgot'
        ? <ForgotPasswordScreen onBack={()=>setAuthView('login')}/>
        : <LoginScreen onLogin={handleLogin} onRegister={()=>setAuthView('register')} onForgot={()=>setAuthView('forgot')}/>}
    </ErrorBoundary>
  );

  // Forced first-login password reset (staff invites + bootstrap admin).
  if (user?.mustResetPassword) return (
    <ErrorBoundary>
      <ChangePasswordScreen onDone={handleLogout}/>
    </ErrorBoundary>
  );

  if (user?.role === 'CLIENT') return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#fff"/>
        <ClientPortalScreen onLogout={handleLogout}/>
      </SafeAreaProvider>
    </ErrorBoundary>
  );

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff"/>
      <NavigationContainer>
        <MainTabs msgClient={msgClient} setMsgClient={setMsgClient} onLogout={handleLogout}/>
      </NavigationContainer>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

