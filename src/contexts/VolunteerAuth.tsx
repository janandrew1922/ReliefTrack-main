
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  cancelShift as cancelShiftRequest,
  getMyShifts,
  joinShift as joinShiftRequest,
  registerVolunteer,
  requestLoginCode,
  verifyLoginCode,
  getVolunteerSession,
  volunteerLogout } from
'../services/reliefService';
import { deactivateVolunteerAccount, updateVolunteerProfile } from '../services/reliefService';
import { ApiError } from '../services/http';
import { USE_LOCAL_DATA } from '../services/http';
import type { JoinedShift, RegistrationDetails, VolunteerProfile } from '../types/domain';

const STORAGE_KEY = 'relieftrack.volunteer.session';
const LEGACY_STORAGE_KEY = 'relieftrack.volunteer';

interface VolunteerAuthValue {
  volunteer: VolunteerProfile | null;
  restoring: boolean;
  shifts: JoinedShift[];
  busy: boolean;
  error: string | null;
  register: (details: RegistrationDetails, shiftId?: string) => Promise<boolean>;
  sendCode: (email: string) => Promise<SendCodeResult>;
  verifyCode: (email: string, code: string) => Promise<boolean>;
  signOut: () => void;
  joinShift: (shiftId: string) => Promise<boolean>;
  cancelShift: (shiftId: string) => Promise<void>;
  updateProfile: (details: RegistrationDetails) => Promise<boolean>;
  deactivateAccount: () => Promise<boolean>;
  hasJoined: (shiftId: string) => boolean;
}

export type SendCodeResult =
| {ok: true;debugCode?: string;}
| {ok: false;};

const VolunteerAuthContext = createContext<VolunteerAuthValue | null>(null);

function readStoredProfile(): VolunteerProfile | null {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as VolunteerProfile : null;
  } catch {
    return null;
  }
}

export function VolunteerAuthProvider({ children }: {children: React.ReactNode;}) {
  const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(() => USE_LOCAL_DATA ? readStoredProfile() : null);
  const [restoring, setRestoring] = useState(!USE_LOCAL_DATA);
  const [shifts, setShifts] = useState<JoinedShift[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback((profile: VolunteerProfile | null) => {
    setVolunteer(profile);
    try {
      if (profile) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));else
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {

      /* storage unavailable — session only */}
  }, []);

  useEffect(() => {
    if (USE_LOCAL_DATA) return;
    let cancelled = false;
    getVolunteerSession().then((result) => {
      if (cancelled) return;
      persist(result.volunteer);
      setShifts(result.shifts);
    }).catch(() => {
      if (!cancelled) persist(null);
    }).finally(() => {
      if (!cancelled) setRestoring(false);
    });
    return () => { cancelled = true; };
  }, [persist]);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const register = useCallback(
    async (details: RegistrationDetails, shiftId?: string) => {
      const result = await run(() => registerVolunteer({ ...details, shiftId }));
      if (!result) return false;
      persist(result.volunteer);
      setShifts(result.shifts);
      return true;
    },
    [run, persist]
  );

  const sendCode = useCallback(
    async (email: string) => {
      const result = await run(() => requestLoginCode(email));
      return result?.sent ? { ok: true, ...(result.debugCode ? { debugCode: result.debugCode } : {}) } : { ok: false };
    },
    [run]
  );

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const result = await run(() => verifyLoginCode(email, code));
      if (!result) return false;
      persist(result.volunteer);
      setShifts(result.shifts);
      return true;
    },
    [run, persist]
  );

  const signOut = useCallback(() => {
    if (!USE_LOCAL_DATA) void volunteerLogout();
    persist(null);
    setShifts([]);
    setError(null);
  }, [persist]);

  const joinShift = useCallback(
    async (shiftId: string) => {
      if (!volunteer) return false;
      const result = await run(() => joinShiftRequest(volunteer.volunteerId, shiftId));
      if (!result) return false;
      setShifts(result);
      return true;
    },
    [run, volunteer]
  );

  const cancelShift = useCallback(
    async (shiftId: string) => {
      if (!volunteer) return;
      const result = await run(() => cancelShiftRequest(volunteer.volunteerId, shiftId));
      if (result) setShifts(result);
    },
    [run, volunteer]
  );

  const updateProfile = useCallback(async (details: RegistrationDetails) => {
    const result = await run(() => updateVolunteerProfile(details));
    if (!result) return false;
    persist(result.volunteer);
    return true;
  }, [run, persist]);

  const deactivateAccount = useCallback(async () => {
    const result = await run(() => deactivateVolunteerAccount());
    if (!result) return false;
    persist(null); setShifts([]);
    return true;
  }, [run, persist]);

  // Restore the signed-in volunteer's shifts after a page refresh.
  useEffect(() => {
    if (!volunteer) return;
    let cancelled = false;
    getMyShifts(volunteer.volunteerId).
    then((result) => {
      if (!cancelled) setShifts(result);
    }).
    catch(() => {

      /* keep the current list if the server is unreachable */});
    return () => {
      cancelled = true;
    };
  }, [volunteer?.volunteerId]);

  const value = useMemo<VolunteerAuthValue>(
    () => ({
      volunteer,
      restoring,
      shifts,
      busy,
      error,
      register,
      sendCode,
      verifyCode,
      signOut,
      joinShift,
      cancelShift,
      updateProfile,
      deactivateAccount,
      hasJoined: (shiftId: string) =>
      shifts.some((shift) => shift.id === shiftId && shift.signupStatus !== 'cancelled')
    }),
    [volunteer, restoring, shifts, busy, error, register, sendCode, verifyCode, signOut, joinShift, cancelShift, updateProfile, deactivateAccount]
  );

  return <VolunteerAuthContext.Provider value={value}>{children}</VolunteerAuthContext.Provider>;
}

export function useVolunteerAuth() {
  const context = useContext(VolunteerAuthContext);
  if (!context) throw new Error('useVolunteerAuth must be used inside VolunteerAuthProvider');
  return context;
}
