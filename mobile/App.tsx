import 'react-native-screens';
import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useState, useCallback, useEffect } from 'react';
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
import { BRAND, BRAND_LT, GRAY_900, GRAY_500 } from './src/theme';
import { s } from './src/styles';

const queryClient = new QueryClient();

function LockScreen({ onUnlock, onSignOut }: { onUnlock: () => void; onSignOut: () => void }) {
  const { locked } = useAuth();
  // We keep the internal logic in AuthContext, and just render UI here
  return (
    <SafeAreaView style={s.screen}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: BRAND_LT, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="lock-closed" size={34} color={BRAND} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: GRAY_900 }}>Pulse is locked</Text>
        <Text style={{ fontSize: 14, color: GRAY_500, textAlign: 'center' }}>Unlock with Biometrics to continue.</Text>
        <TouchableOpacity style={s.btnPrimary} onPress={onUnlock}>
          <Text style={s.btnPrimaryText}>Unlock Pulse</Text>
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
    return <LockScreen onUnlock={() => setLocked(false)} onSignOut={() => { setLocked(false); logout(); }} />;
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
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
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
