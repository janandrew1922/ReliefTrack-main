import { useState } from 'react';
import { ShieldCheckIcon, TruckIcon, UserRoundIcon } from 'lucide-react';
import { AdminLogin } from '../AdminLogin';
import { VolunteerLogin } from './VolunteerLogin';
import { DriverPortal } from './DriverPortal';
import type { PublicRoute } from '../../components/public/PublicNav';

type LoginRole = 'volunteer' | 'driver' | 'admin';

const roles: { id: LoginRole; label: string; description: string; Icon: typeof UserRoundIcon }[] = [
  { id: 'volunteer', label: 'Volunteer', description: 'Sign in with an email code', Icon: UserRoundIcon },
  { id: 'driver', label: 'Driver', description: 'Open your assigned routes', Icon: TruckIcon },
  { id: 'admin', label: 'Admin', description: 'Manage relief operations', Icon: ShieldCheckIcon },
];

export function LoginPanel({ onNavigate, onAdminLogin }: { onNavigate: (route: PublicRoute) => void; onAdminLogin: () => void }) {
  const [role, setRole] = useState<LoginRole>('volunteer');

  if (role === 'driver') return <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
    <button type="button" onClick={() => setRole('volunteer')} className="mb-4 text-sm font-semibold text-brand-700 hover:text-brand-800">← Choose another account type</button>
    <DriverPortal onNavigate={onNavigate} />
  </section>;

  return <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">ReliefTrack access</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Choose who is signing in</h1>
      <p className="mt-2 text-sm text-muted">Select your account type to continue to the right portal.</p>
    </div>
    <div role="tablist" aria-label="Choose account type" className="mt-7 grid gap-3 sm:grid-cols-3">
      {roles.map(({ id, label, description, Icon }) => <button key={id} type="button" role="tab" aria-selected={role === id} onClick={() => setRole(id)} className={`rounded-xl border p-4 text-left transition-colors ${role === id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-line bg-white hover:bg-gray-50'}`}>
        <Icon className={`h-5 w-5 ${role === id ? 'text-brand-700' : 'text-muted'}`} />
        <span className="mt-3 block text-sm font-bold text-ink">{label}</span>
        <span className="mt-1 block text-xs text-muted">{description}</span>
      </button>)}
    </div>
    <div role="tabpanel" className="mt-5 rounded-2xl border border-line bg-white shadow-sm">
      {role === 'volunteer' && <VolunteerLogin onNavigate={onNavigate} />}
      {role === 'admin' && <AdminLogin onBackToPublic={() => onNavigate('home')} onSignedIn={onAdminLogin} />}
    </div>
  </section>;
}
