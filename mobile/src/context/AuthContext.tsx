import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { User, Client } from '../types';
import { getAuth, setAuth, persistAuth, loadPersistedAuth, refreshSession, isBiometricEnabled, biometricCapability, bizId, invalidateSessionRefresh } from '../auth';
import { api, registerPushNotifications, unregisterPushNotifications } from '../api';

interface AuthContextType {
  token: string | null;
  user: User | null;
  booting: boolean;
  locked: boolean;
  setLocked: (locked: boolean) => void;
  login: (token: string, refresh: string, user: User) => void;
  logout: () => Promise<void>;
  refreshUnreadMessages: () => Promise<void>;
  unreadMessages: number;
  isOffline: boolean;
  configError: 'MISMATCH' | 'INVALID_BIZ' | null;
  showPrivacyScreen: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [locked, setLocked] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [configError, setConfigError] = useState<'MISMATCH' | 'INVALID_BIZ' | null>(null);
  const [showPrivacyScreen, setShowPrivacyScreen] = useState(false);

  const refreshUnreadMessages = useCallback(async () => {
    const businessId = bizId();
    if (!businessId) return;
    try {
      const result = await api<{ unreadMessages: number }>(`/businesses/${businessId}/messages/unread-count`);
      setUnreadMessages(result.unreadMessages);
    } catch { /* foreground polling is best-effort */ }
  }, []);

  useEffect(() => {
    const checkConfig = async () => {
      // 1. Stripe Key Mismatch Check
      const isProd = !__DEV__;
      const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
      if (isProd && stripeKey.startsWith('pk_test_')) {
        console.error('CRITICAL: Production build detected but using a Stripe TEST key.');
        setConfigError('MISMATCH');
        return;
      }

      // 2. Business ID Check
      const businessId = bizId();
      if (!businessId) {
        console.error('CRITICAL: No EXPO_PUBLIC_BUSINESS_ID found in environment.');
        setConfigError('INVALID_BIZ');
        return;
      }

      // 3. Optional: Verify Business ID against API
      try {
        await api(`/businesses/${businessId}`);
      } catch (err: any) {
        if (err?.status === 404) {
          console.error(`CRITICAL: Business ID "${businessId}" not found on backend.`);
          setConfigError('INVALID_BIZ');
        }
        // Network errors (no status) are ignored — offline startup is allowed.
      }
    };
    checkConfig();
  }, []);

  useEffect(() => {
    const checkNetwork = async () => {
      const state = await Network.getNetworkStateAsync();
      setIsOffline(!state.isConnected);
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const init = async () => {
      const hadRefresh = await loadPersistedAuth();
      if (hadRefresh) {
        const ok = await refreshSession();
        if (!ok) {
          setAuth(null, null, null);
          await persistAuth();
        }
      }
      const a = getAuth();
      setToken(a.token);
      setUser(a.user);
      if (a.token) registerPushNotifications();

      if (a.token && await isBiometricEnabled() && (await biometricCapability()).available) {
        setLocked(true);
      }
      setBooting(false);
    };
    init();
  }, []);

  const wasBackgrounded = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      // Show a privacy overlay as soon as the app enters the inactive/background
      // state so the iOS app switcher screenshot captures the overlay, not live
      // content with client PII or payment data.
      if (next === 'inactive' || next === 'background') {
        setShowPrivacyScreen(true);
        if (next === 'background') wasBackgrounded.current = true;
      } else if (next === 'active') {
        setShowPrivacyScreen(false);
        if (wasBackgrounded.current) {
          wasBackgrounded.current = false;
          const a = getAuth();
          if (a.token && await isBiometricEnabled() && (await biometricCapability()).available) {
            setLocked(true);
          }
        }
      }
    });
    return () => sub.remove();
  }, []);

  const login = (t: string, r: string, u: User) => {
    setAuth(t, u, r);
    setToken(t);
    setUser(u);
    persistAuth();
    registerPushNotifications();
  };

  const logout = async () => {
    invalidateSessionRefresh();
    const unregister = unregisterPushNotifications();
    const serverLogout = api('/auth/logout', { method: 'POST' }).catch(() => { });
    setAuth(null, null, null);
    setToken(null);
    setUser(null);
    await Promise.all([persistAuth(), unregister, serverLogout]);
  };
return (
  <AuthContext.Provider value={{
    token, user, booting, locked, setLocked,
    login, logout, refreshUnreadMessages, unreadMessages,
    isOffline, configError, showPrivacyScreen,
  }}>
    {children}
  </AuthContext.Provider>
);

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
