import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { User, Client } from '../types';
import { getAuth, setAuth, persistAuth, loadPersistedAuth, refreshSession, isBiometricEnabled, biometricCapability, bizId } from '../auth';
import { api, registerPushNotifications } from '../api';

interface AuthContextType {
  token: string | null;
  user: User | null;
  booting: boolean;
  locked: boolean;
  setLocked: (locked: boolean) => void;
  login: (token: string, refresh: string, user: User) => void;
  logout: () => void;
  refreshUnreadMessages: () => Promise<void>;
  unreadMessages: number;
  isOffline: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [locked, setLocked] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  const refreshUnreadMessages = useCallback(async () => {
    const businessId = bizId();
    if (!businessId) return;
    try {
      const result = await api<{ unreadMessages: number }>(`/businesses/${businessId}/messages/unread-count`);
      setUnreadMessages(result.unreadMessages);
    } catch { /* foreground polling is best-effort */ }
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
      if (next === 'background') {
        wasBackgrounded.current = true;
      } else if (next === 'active' && wasBackgrounded.current) {
        wasBackgrounded.current = false;
        const a = getAuth();
        if (a.token && await isBiometricEnabled() && (await biometricCapability()).available) {
          setLocked(true);
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

  const logout = () => {
    api('/auth/logout', { method: 'POST' }).catch(() => { });
    setAuth(null, null, null);
    setToken(null);
    setUser(null);
    persistAuth();
  };

  return (
    <AuthContext.Provider value={{
      token, user, booting, locked, setLocked,
      login, logout, refreshUnreadMessages, unreadMessages
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
