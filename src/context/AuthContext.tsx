import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  authLogin,
  authLogout,
  authMe,
  authRegister,
  getAuthToken,
  setAuthToken,
  type AuthUser,
} from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  /** true while the persisted session is validated on first load */
  checking: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getAuthToken()) {
      setChecking(false);
      return;
    }
    authMe()
      .then((res) => setUserState(res.user))
      .catch(() => {
        setAuthToken(null);
        setUserState(null);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUserState(null);
    window.addEventListener('zenkuri-unauthorized', onUnauthorized);
    return () => window.removeEventListener('zenkuri-unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authLogin({ username, password });
    setAuthToken(res.token);
    setUserState(res.user);
  }, []);

  const register = useCallback(async (username: string, password: string, displayName?: string) => {
    const res = await authRegister({ username, password, displayName });
    setAuthToken(res.token);
    setUserState(res.user);
  }, []);

  const logout = useCallback(() => {
    authLogout().catch(() => undefined);
    setAuthToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((next: AuthUser) => setUserState(next), []);

  return (
    <AuthContext.Provider value={{ user, checking, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
