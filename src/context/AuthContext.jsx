import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'songisathi.auth';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Where each role lands after auth.
export function homeForRole(user) {
  if (!user) return '/';
  switch (user.role) {
    case 'GHOTOK': return '/dashboard';
    case 'ADMIN': return '/admin';
    case 'GUARDIAN': return '/guardian';
    case 'CANDIDATE': return '/guardian';
    default: return '/';
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadStored);

  const persist = useCallback((next) => {
    setSession(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const signin = useCallback(async (payload) => {
    const data = await api.signin(payload);
    persist(data);
    return data.user;
  }, [persist]);

  const signup = useCallback(async (payload) => {
    const data = await api.signup(payload);
    persist(data);
    return data.user;
  }, [persist]);

  const logout = useCallback(() => persist(null), [persist]);

  const value = useMemo(
    () => ({ user: session?.user || null, token: session?.token || null, signin, signup, logout }),
    [session, signin, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
