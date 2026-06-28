import React, { useState, useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenCapture from 'expo-screen-capture';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { BRAND, GRAY_400, GRAY_900, GRAY_100, SURFACE } from '../theme';
import { Client } from '../types';
import { NetworkBanner, ErrorBoundary } from '../components';
import * as SecureStore from 'expo-secure-store';

import { TodayScreen } from '../screens/today';
import { CalendarScreen } from '../screens/calendar';
import { BookScreen } from '../screens/book';
import { CheckoutScreen } from '../screens/checkout';
import { ClientsScreen } from '../screens/clients';
import { MessagesScreen } from '../screens/messages';
import { NotificationsScreen } from '../screens/notifications';
import { MenuScreen } from '../screens/menu';
import { AdminScreen } from '../screens/admin';
import { OnboardingScreen } from '../screens/onboarding';
import { LoginScreen, RegisterScreen, ForgotPasswordScreen, ChangePasswordScreen, ClientPortalScreen } from '../screens/auth';
import { View, Text, SafeAreaView, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const CalStack = createNativeStackNavigator();
const MenuStk = createNativeStackNavigator();

const ONBOARDING_KEY = 'pulse.onboarding.v1';

function CalendarStack() {
  return (
    <CalStack.Navigator screenOptions={{ headerShown: false }}>
      <CalStack.Screen name="CalendarHome">{() => <ErrorBoundary><CalendarScreen /></ErrorBoundary>}</CalStack.Screen>
      <CalStack.Screen name="Book">{() => <ErrorBoundary><BookScreen /></ErrorBoundary>}</CalStack.Screen>
    </CalStack.Navigator>
  );
}

function MenuStack() {
  const { logout } = useAuth();
  return (
    <MenuStk.Navigator screenOptions={{ headerShown: false }}>
      <MenuStk.Screen name="MenuHome">{() => <ErrorBoundary><MenuScreen onLogout={logout} /></ErrorBoundary>}</MenuStk.Screen>
      <MenuStk.Screen name="MenuDetail">{() => <ErrorBoundary><MenuScreen onLogout={logout} /></ErrorBoundary>}</MenuStk.Screen>
    </MenuStk.Navigator>
  );
}

// Handle push notification deep-links while the app is open (foreground).
function usePushDeepLink() {
  const nav = useRef<any>(null);
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      // Navigate to the Calendar tab whenever any booking-related push arrives.
      // The booking screen re-polls on focus, so the user sees the latest state.
      if (data?.appointmentId || data?.type === 'BOOKING_NEW' || data?.type === 'BOOKING_UPDATE') {
        // The navigator ref is exposed by the root Stack — navigate globally.
        try {
          (nav.current as any)?.navigate?.('MainTabs', { screen: 'Calendar' });
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);
  return nav;
}

function MainTabs() {
  const { user, unreadMessages, logout, isOffline, refreshUnreadMessages } = useAuth();
  const [msgClient, setMsgClient] = useState<Client | null>(null);
  const insets = useSafeAreaInsets();
  const barHeight = 60 + Math.max(insets.bottom, 8);
  const canCheckout = user?.role === 'OWNER' || user?.role === 'ADMIN';

  return (
    <>
      <NetworkBanner isOffline={isOffline} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: BRAND,
          tabBarInactiveTintColor: GRAY_400,
          tabBarStyle: {
            backgroundColor: SURFACE,
            borderTopWidth: 0,
            shadowColor: '#000',
            shadowOpacity: 0.10,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -6 },
            elevation: 20,
            height: barHeight,
            paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: 6,
          },
          tabBarItemStyle: { borderRadius: 14, marginHorizontal: 3, marginTop: 4, marginBottom: 4, paddingVertical: 2 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
          tabBarIcon: ({ color, focused }) => {
            const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
              Today:     ['home', 'home-outline'],
              Calendar:  ['calendar', 'calendar-outline'],
              Checkout:  ['card', 'card-outline'],
              Customers: ['people', 'people-outline'],
              Messages:  ['chatbubbles', 'chatbubbles-outline'],
              Alerts:    ['notifications', 'notifications-outline'],
              More:      ['menu', 'menu-outline'],
            };
            const pair = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
            return <Ionicons name={focused ? pair[0] : pair[1]} size={22} color={color} />;
          },
        })}
      >
        {/* Visible tabs: Home · Calendar · Clients · Messages · More.
            Checkout and Alerts stay registered (so nav.navigate('Checkout'/'Alerts')
            still works) but are hidden from the bar — Checkout is reached from the
            Home quick action, Alerts from the Home header bell. Route names are kept
            unchanged so no string-based navigate() call breaks. */}
        <Tab.Screen name="Today" options={{ tabBarLabel: 'Home' }}>
          {() => <ErrorBoundary><TodayScreen /></ErrorBoundary>}
        </Tab.Screen>
        <Tab.Screen name="Calendar">
          {() => <ErrorBoundary><CalendarStack /></ErrorBoundary>}
        </Tab.Screen>
        {canCheckout && (
          <Tab.Screen name="Checkout" options={{ tabBarButton: () => null }}>
            {() => <ErrorBoundary><CheckoutScreen /></ErrorBoundary>}
          </Tab.Screen>
        )}
        <Tab.Screen name="Customers" options={{ tabBarLabel: 'Clients' }}>
          {() => <ErrorBoundary><ClientsScreen onMessage={c => setMsgClient(c)} /></ErrorBoundary>}
        </Tab.Screen>
        <Tab.Screen name="Messages" options={{
          tabBarBadge: unreadMessages > 0 ? (unreadMessages > 99 ? '99+' : unreadMessages) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#DC2626', color: '#fff', fontSize: 10, fontWeight: '800' },
        }}>
          {() => <ErrorBoundary><MessagesScreen initialClient={msgClient} onClearClient={() => setMsgClient(null)} onUnreadChanged={refreshUnreadMessages} /></ErrorBoundary>}
        </Tab.Screen>
        <Tab.Screen name="Alerts" options={{ tabBarButton: () => null }}>
          {() => <ErrorBoundary><NotificationsScreen /></ErrorBoundary>}
        </Tab.Screen>
        <Tab.Screen name="More">
          {() => <ErrorBoundary><MenuStack /></ErrorBoundary>}
        </Tab.Screen>
      </Tab.Navigator>
    </>
  );
}

export function AppNavigator() {
  const { token, user, booting, login, logout, configError, showPrivacyScreen } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  usePushDeepLink();

  // Check if onboarding has been completed.
  useEffect(() => {
    if (!token || !user || user.role !== 'OWNER') { setOnboardingChecked(true); return; }
    SecureStore.getItemAsync(ONBOARDING_KEY)
      .then(val => {
        if (!val) setShowOnboarding(true);
        setOnboardingChecked(true);
      })
      .catch(() => setOnboardingChecked(true));
  }, [token, user]);

  // Privacy usage string check (dev only).
  useEffect(() => {
    if (__DEV__) {
      const Constants = require('expo-constants').default;
      const infoPlist = Constants.expoConfig?.ios?.infoPlist;
      const required = ['NSCameraUsageDescription', 'NSFaceIDUsageDescription', 'NSPhotoLibraryUsageDescription'];
      required.forEach(key => {
        if (!infoPlist?.[key]) console.warn(`PRIVACY WARNING: Missing ${key} in app.json.`);
      });
    }
  }, []);

  // Prevent in-app screenshots when authenticated.
  useEffect(() => {
    if (token) {
      ScreenCapture.preventScreenCaptureAsync('main');
    } else {
      ScreenCapture.allowScreenCaptureAsync('main');
    }
  }, [token]);

  if (booting || (token && !onboardingChecked)) return null;

  if (configError) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Configuration Error</Text>
        <Text style={styles.errorText}>
          {configError === 'MISMATCH'
            ? 'Production build detected but using a Stripe TEST key. Please update EAS environment variables.'
            : 'The business ID configured for this app is invalid or could not be found. Please check your deployment settings.'}
        </Text>
      </SafeAreaView>
    );
  }

  if (!token) {
    if (authView === 'register') return <RegisterScreen onRegistered={login} onBack={() => setAuthView('login')} />;
    if (authView === 'forgot') return <ForgotPasswordScreen onBack={() => setAuthView('login')} />;
    return <LoginScreen onLogin={login} onRegister={() => setAuthView('register')} onForgot={() => setAuthView('forgot')} />;
  }

  if (user?.mustResetPassword) return <ChangePasswordScreen onDone={logout} />;
  if (user?.role === 'CLIENT') return <ClientPortalScreen onLogout={logout} />;
  if (user?.role === 'ADMIN') return <AdminScreen onLogout={logout} />;

  if (showOnboarding) {
    return (
      <OnboardingScreen
        onComplete={async () => {
          await SecureStore.setItemAsync(ONBOARDING_KEY, 'done').catch(() => {});
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <>
      <MainTabs />
      {showPrivacyScreen && (
        <View style={styles.privacyOverlay} pointerEvents="none">
          <Ionicons name="shield-checkmark" size={56} color="#7C3AED" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  privacyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  errorScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff',
  },
  errorTitle: { fontSize: 22, fontWeight: '700', color: GRAY_900, marginTop: 16, marginBottom: 8 },
  errorText: { fontSize: 15, color: GRAY_400, textAlign: 'center', lineHeight: 22 },
});
