import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminLogin, adminLogout, getAdminSession } from '../services/reliefService';
import { ApiError, setCsrfToken } from '../services/http';
import { USE_LOCAL_DATA } from '../services/http';

const STORAGE_KEY = 'relieftrack.admin.session';
const LEGACY_STORAGE_KEY = 'relieftrack.admin';

export interface AdminProfile {
  staffId: string;
  fullName: string;
  email: string;
  role: 'admin' | 'staff' | 'coordinator';
  csrfToken?: string;
}

interface AdminAuthValue {
  admin: AdminProfile | null;
  restoring: boolean;
  busy: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

function readStoredAdmin(): AdminProfile | null {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AdminProfile : null;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(() => USE_LOCAL_DATA ? readStoredAdmin() : null);
  const [restoring, setRestoring] = useState(!USE_LOCAL_DATA);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (USE_LOCAL_DATA) return;
    let cancelled = false;
    getAdminSession().then((result) => {
      if (!cancelled) {
        setAdmin(result.admin);
        setCsrfToken(result.admin.csrfToken ?? null);
      }
    }).catch(() => {
      if (!cancelled) setAdmin(null);
    }).finally(() => {
      if (!cancelled) setRestoring(false);
    });
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await adminLogin(email, password);
      setAdmin(result.admin);
      setCsrfToken(result.admin.csrfToken ?? null);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      if (USE_LOCAL_DATA) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result.admin));
      else window.sessionStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(() => {
    void adminLogout();
    setCsrfToken(null);
    setAdmin(null);
    setError(null);
    if (USE_LOCAL_DATA) window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setCsrfToken(null);
      setAdmin(null);
      setError('Your staff session expired. Please sign in again.');
      if (USE_LOCAL_DATA) window.sessionStorage.removeItem(STORAGE_KEY);
    };
    window.addEventListener('relieftrack:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('relieftrack:unauthorized', handleUnauthorized);
  }, []);

  const value = useMemo(() => ({ admin, restoring, busy, error, signIn, signOut }), [admin, restoring, busy, error, signIn, signOut]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return context;
}
