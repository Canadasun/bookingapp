import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { GRAY_100, GRAY_400, GRAY_900 } from '../theme';
import { Client } from '../types';
import { NetworkBanner } from '../components';

import { CalendarScreen } from '../screens/calendar';
import { BookScreen } from '../screens/book';
import { CheckoutScreen } from '../screens/checkout';
import { ClientsScreen } from '../screens/clients';
import { MessagesScreen } from '../screens/messages';
import { NotificationsScreen } from '../screens/notifications';
import { MenuScreen } from '../screens/menu';
import { AdminScreen } from '../screens/admin';
import { LoginScreen, RegisterScreen, ForgotPasswordScreen, ChangePasswordScreen, ClientPortalScreen } from '../screens/auth';
import { View, Text, SafeAreaView, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const CalStack = createNativeStackNavigator();
const MenuStk = createNativeStackNavigator();

function CalendarStack() {
  return (
    <CalStack.Navigator screenOptions={{ headerShown: false }}>
      <CalStack.Screen name="CalendarHome" component={CalendarScreen} />
      <CalStack.Screen name="Book" component={BookScreen} />
    </CalStack.Navigator>
  );
}

function MenuStack() {
  const { logout } = useAuth();
  return (
    <MenuStk.Navigator screenOptions={{ headerShown: false }}>
      <MenuStk.Screen name="MenuHome">{(props) => <MenuScreen {...props} onLogout={logout} />}</MenuStk.Screen>
      <MenuStk.Screen name="MenuDetail">{(props) => <MenuScreen {...props} onLogout={logout} />}</MenuStk.Screen>
    </MenuStk.Navigator>
  );
}

function MainTabs() {
  const { user, unreadMessages, logout, isOffline } = useAuth();
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
        tabBarActiveTintColor: GRAY_900,
        tabBarInactiveTintColor: GRAY_400,
        tabBarActiveBackgroundColor: GRAY_100,
        tabBarStyle: {
          backgroundColor: '#fff', borderTopColor: GRAY_100,
          height: barHeight,
          paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: 6,
        },
        tabBarItemStyle: { borderRadius: 16, marginHorizontal: 4, marginTop: 6, marginBottom: 6, paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            Calendar: ['calendar', 'calendar-outline'],
            Checkout: ['card', 'card-outline'],
            Customers: ['people', 'people-outline'],
            Messages: ['chatbubbles', 'chatbubbles-outline'],
            Alerts: ['notifications', 'notifications-outline'],
            Menu: ['menu', 'menu-outline'],
          };
          const pair = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? pair[0] : pair[1]} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Calendar" component={CalendarStack} />
      {canCheckout && <Tab.Screen name="Checkout" component={CheckoutScreen} />}
      <Tab.Screen name="Customers">
        {() => <ClientsScreen onMessage={c => setMsgClient(c)} />}
      </Tab.Screen>
      <Tab.Screen name="Messages" options={{
        tabBarBadge: unreadMessages > 0 ? (unreadMessages > 99 ? '99+' : unreadMessages) : undefined,
        tabBarBadgeStyle: { backgroundColor: '#DC2626', color: '#fff', fontSize: 10, fontWeight: '800' },
      }}>
        {() => <MessagesScreen initialClient={msgClient} onClearClient={() => setMsgClient(null)} onUnreadChanged={() => { }} />}
      </Tab.Screen>
      <Tab.Screen name="Alerts" component={NotificationsScreen} />
      <Tab.Screen name="Menu" component={MenuStack} />
    </Tab.Navigator>
    </>
  );
}

export function AppNavigator() {
  const { token, user, booting, login, logout, configError } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');

  // Final Privacy & Entitlement Audit (Runtime)
  useEffect(() => {
    if (__DEV__) {
      const Constants = require('expo-constants').default;
      const infoPlist = Constants.expoConfig?.ios?.infoPlist;
      const required = ['NSCameraUsageDescription', 'NSFaceIDUsageDescription', 'NSPhotoLibraryUsageDescription'];
      required.forEach(key => {
        if (!infoPlist?.[key]) {
          console.warn(`PRIVACY WARNING: Missing ${key} in app.json. iOS submission will fail.`);
        }
      });
    }
  }, []);

  if (booting) return null;

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

  return <MainTabs />;
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: GRAY_900,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: GRAY_400,
    textAlign: 'center',
    lineHeight: 22,
  },
});
