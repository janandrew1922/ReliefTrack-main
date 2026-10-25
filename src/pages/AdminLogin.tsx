import React, { useState } from 'react';
import { ArrowRightIcon, KeyRoundIcon, LifeBuoyIcon, MailIcon, ShieldCheckIcon } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuth';

interface AdminLoginProps {
  onBackToPublic: () => void;
  onSignedIn?: () => void;
}

export function AdminLogin({ onBackToPublic, onSignedIn }: AdminLoginProps) {
  const { signIn, busy, error } = useAdminAuth();
  const isLocalDemo = import.meta.env.VITE_DATA_MODE !== 'api';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await signIn(email.trim(), password)) onSignedIn?.();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <button onClick={onBackToPublic} className="mb-8 flex items-center gap-2 text-sm font-bold text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white">
            <LifeBuoyIcon className="h-5 w-5" />
          </span>
          ReliefTrack
        </button>

        <section className="rounded-2xl border border-line bg-white p-7 shadow-sm sm:p-9">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <ShieldCheckIcon className="h-5 w-5" />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Operations portal</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Staff sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Sign in with your ReliefTrack staff account to access the operations dashboard.
          </p>

          {isLocalDemo && <p role="status" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">Local demo mode: changes are stored in this browser. Demo accounts are for development only.</p>}

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-ink">Email address</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-3 focus-within:ring-2 focus-within:ring-brand-600">
                <MailIcon className="h-4 w-4 shrink-0 text-muted" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@relieftrack.com"
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-ink">Password</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-3 focus-within:ring-2 focus-within:ring-brand-600">
                <KeyRoundIcon className="h-4 w-4 shrink-0 text-muted" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
              </div>
            </label>

            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Signing in...' : 'Sign in to dashboard'}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 border-t border-line pt-5 text-center text-xs text-muted">
            <button onClick={onBackToPublic} className="font-bold text-brand-700 hover:text-brand-800">Return to donor site</button>
          </p>
        </section>
      </div>
    </main>
  );
}
