
import React, { useState } from 'react';
import { ArrowRightIcon, KeyRoundIcon, MailIcon, ShieldCheckIcon } from 'lucide-react';
import { useVolunteerAuth } from '../../contexts/VolunteerAuth';
import type { PublicRoute } from '../../components/public/PublicNav';

interface VolunteerLoginProps {
  onNavigate: (route: PublicRoute) => void;
}

export function VolunteerLogin({ onNavigate }: VolunteerLoginProps) {
  const { sendCode, verifyCode, busy, error } = useVolunteerAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'identify' | 'verify'>('identify');

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await sendCode(email);
    if (result.ok) setStage('verify');
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await verifyCode(email, code)) onNavigate('shifts');
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-line bg-white p-7">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <ShieldCheckIcon className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Volunteer sign in</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {stage === 'identify' ?
          'Enter the email address you used when you registered.' :
          `We sent a 6-digit code to ${email}. Enter it below.`}
        </p>

        {stage === 'identify' ?
        <form onSubmit={requestCode} className="mt-6">
            <label className="block">
              <span className="text-xs font-bold text-ink">Email address</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-3 focus-within:ring-2 focus-within:ring-brand-600">
                <MailIcon className="h-4 w-4 shrink-0 text-muted" />
                <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
                className="w-full bg-transparent py-2.5 text-sm outline-none" />
              
              </div>
            </label>

            {error &&
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>
          }

            <button
            type="submit"
            disabled={busy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
            
              {busy ? 'Sending…' : 'Send verification code'} <ArrowRightIcon className="h-4 w-4" />
            </button>
          </form> :

        <form onSubmit={signIn} className="mt-6">
            <label className="block">
              <span className="text-xs font-bold text-ink">6-digit code</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-3 focus-within:ring-2 focus-within:ring-brand-600">
                <KeyRoundIcon className="h-4 w-4 shrink-0 text-muted" />
                <input
                required
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                className="w-full bg-transparent py-2.5 font-mono text-lg tracking-widest outline-none" />
              
              </div>
            </label>

            {error &&
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>
          }

            <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
            
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button
            type="button"
            onClick={() => setStage('identify')}
            className="mt-3 w-full text-xs font-semibold text-muted hover:text-ink">
            
              Use a different email
            </button>
          </form>
        }

        <p className="mt-6 border-t border-line pt-5 text-center text-xs text-muted">
          Not registered yet?{' '}
          <button onClick={() => onNavigate('volunteer')} className="font-bold text-brand-700 hover:text-brand-800">
            Join a shift to sign up
          </button>
        </p>
      </div>
    </div>);

}