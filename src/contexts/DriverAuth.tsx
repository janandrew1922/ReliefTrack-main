import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { driverLogin, driverLogout, getDriverSession } from '../services/reliefService';
import { deleteDriverAccount, updateDriverProfile } from '../services/reliefService';
import { ApiError, setCsrfToken } from '../services/http';
import { USE_LOCAL_DATA } from '../services/http';
import type { DriverProfile } from '../types/domain';

const STORAGE_KEY = 'relieftrack.driver.session';
type DriverSession = DriverProfile & { csrfToken?: string };
interface DriverAuthValue { driver: DriverSession | null; restoring: boolean; busy: boolean; error: string | null; signIn: (email: string, password: string) => Promise<boolean>; signOut: () => void; updateProfile: (profile: Pick<DriverProfile, 'fullName' | 'phone' | 'drivingLicenseNumber' | 'drivingLicenseType'>) => Promise<boolean>; deleteAccount: (password: string) => Promise<boolean>; }
const DriverAuthContext = createContext<DriverAuthValue | null>(null);

function readStoredDriver(): DriverSession | null {
  try { const raw = window.sessionStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as DriverSession : null; } catch { return null; }
}

export function DriverAuthProvider({ children }: { children: React.ReactNode }) {
  const [driver, setDriver] = useState<DriverSession | null>(() => USE_LOCAL_DATA ? readStoredDriver() : null);
  const [restoring, setRestoring] = useState(!USE_LOCAL_DATA);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (USE_LOCAL_DATA) return;
    let cancelled = false;
    getDriverSession().then(({ driver: session }) => {
      if (!cancelled) { setDriver(session); setCsrfToken(session.csrfToken ?? null); }
    }).catch(() => { if (!cancelled) setDriver(null); }).finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setBusy(true); setError(null);
    try {
      const result = await driverLogin(email, password);
      setDriver(result.driver); setCsrfToken(result.driver.csrfToken ?? null);
      if (USE_LOCAL_DATA) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result.driver));
      return true;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not sign in. Please try again.');
      return false;
    } finally { setBusy(false); }
  }, []);

  const signOut = useCallback(() => {
    void driverLogout(); setCsrfToken(null); setDriver(null); setError(null);
    if (USE_LOCAL_DATA) window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateProfile = useCallback(async (profile: Pick<DriverProfile, 'fullName' | 'phone' | 'drivingLicenseNumber' | 'drivingLicenseType'>) => {
    setBusy(true); setError(null);
    try {
      const result = await updateDriverProfile(profile);
      setDriver((current) => current ? { ...current, ...result.driver } : current);
      return true;
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Could not save your profile.'); return false; }
    finally { setBusy(false); }
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    setBusy(true); setError(null);
    try { await deleteDriverAccount(password); signOut(); return true; }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Could not deactivate your account.'); return false; }
    finally { setBusy(false); }
  }, [signOut]);

  const value = useMemo(() => ({ driver, restoring, busy, error, signIn, signOut, updateProfile, deleteAccount }), [driver, restoring, busy, error, signIn, signOut, updateProfile, deleteAccount]);
  return <DriverAuthContext.Provider value={value}>{children}</DriverAuthContext.Provider>;
}

export function useDriverAuth() {
  const context = useContext(DriverAuthContext);
  if (!context) throw new Error('useDriverAuth must be used within DriverAuthProvider');
  return context;
}
