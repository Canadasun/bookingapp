import 'react-native-screens';
import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components';
import { authenticateBiometric } from './src/auth';
import { BRAND, BRAND_LT, SURFACE, GRAY_900, GRAY_500 } from './src/theme';
import { s } from './src/styles';

const queryClient = new QueryClient();

function LockScreen({ onUnlock, onSignOut, unlocking }: { onUnlock: () => void; onSignOut: () => void; unlocking: boolean }) {
  // We keep the internal logic in AuthContext, and just render UI here
  return (
    <SafeAreaView style={[s.screen, { backgroundColor: SURFACE }]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: BRAND_LT, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
          <Ionicons name="lock-closed" size={34} color={BRAND} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: GRAY_900, letterSpacing: -0.4 }}>Pulse is locked</Text>
        <Text style={{ fontSize: 14, color: GRAY_500, textAlign: 'center', lineHeight: 20 }}>Unlock with Biometrics to continue.</Text>
        <TouchableOpacity style={s.btnPrimary} onPress={onUnlock} disabled={unlocking}>
          {unlocking
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnPrimaryText}>Unlock Pulse</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.btnGhost} onPress={onSignOut}>
          <Text style={s.btnGhostText}>Sign out instead</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function AppContent() {
  const { booting, locked, setLocked, logout } = useAuth();
  const [unlocking, setUnlocking] = useState(false);

  const unlock = useCallback(async () => {
    if (unlocking) return;
    setUnlocking(true);
    try {
      if (await authenticateBiometric()) setLocked(false);
    } finally {
      setUnlocking(false);
    }
  }, [setLocked, unlocking]);

  if (booting) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={BRAND} />
        </View>
      </SafeAreaView>
    );
  }

  if (locked) {
    return <LockScreen unlocking={unlocking} onUnlock={unlock} onSignOut={() => { setLocked(false); logout(); }} />;
  }

  return <AppNavigator />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
        urlScheme="pulseappointments"
        merchantIdentifier="merchant.com.pulseappointments.stripe"
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <StatusBar barStyle="dark-content" backgroundColor={SURFACE} />
            <ErrorBoundary>
              <AuthProvider>
                <NavigationContainer>
                  <AppContent />
                </NavigationContainer>
              </AuthProvider>
            </ErrorBoundary>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </StripeProvider>
    </QueryClientProvider>
  );
}
