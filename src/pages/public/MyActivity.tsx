
import React, { useEffect, useState } from 'react';
import { ArrowRightIcon, AwardIcon, ClockIcon, SearchIcon, UsersIcon } from 'lucide-react';
import { getMyDonations } from '../../services/reliefService';
import { ApiError } from '../../services/http';
import { stageLabel } from '../../data/staticContent';
import { useVolunteerAuth } from '../../contexts/VolunteerAuth';
import { EmptyBlock } from '../../components/StateViews';
import type { TrackedDonation } from '../../types/domain';
import type { PublicRoute } from '../../components/public/PublicNav';
import { getSkills } from '../../services/reliefService';
import type { RegistrationDetails, Skill } from '../../types/domain';

interface MyActivityProps {
  onNavigate: (route: PublicRoute) => void;
}

export function MyActivity({ onNavigate }: MyActivityProps) {
  const { volunteer, shifts, updateProfile, deactivateAccount, sendCode, verifyCode, busy, error: accountError } = useVolunteerAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [profile, setProfile] = useState<RegistrationDetails>({ fullName: '', email: '', phone: '', address: '', emergencyContact: '', emergencyPhone: '', skillIds: [], drivingLicenseNumber: '', drivingLicenseType: '', firstAidQualification: '' });
  const [accountMessage, setAccountMessage] = useState('');
  const [deleteStep, setDeleteStep] = useState<'closed' | 'confirm' | 'code'>('closed');
  const [deleteCode, setDeleteCode] = useState('');
  const [email, setEmail] = useState(volunteer?.email ?? '');
  const [reference, setReference] = useState('');
  const [donations, setDonations] = useState<TrackedDonation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getSkills().then(setSkills).catch(() => setSkills([])); }, []);
  useEffect(() => {
    if (!volunteer) return;
    setProfile((current) => ({ ...current, fullName: volunteer.fullName, email: volunteer.email, phone: volunteer.phone, address: volunteer.address ?? '', emergencyContact: volunteer.emergencyContact ?? '', emergencyPhone: volunteer.emergencyPhone ?? '', drivingLicenseNumber: volunteer.drivingLicenseNumber ?? '', drivingLicenseType: volunteer.drivingLicenseType ?? '', firstAidQualification: volunteer.firstAidQualification ?? '', skillIds: skills.filter((skill) => volunteer.skills.includes(skill.name)).map((skill) => skill.id) }));
  }, [volunteer, skills]);

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault(); setAccountMessage('');
    if (await updateProfile(profile)) setAccountMessage('Your profile was saved.');
  };

  const requestDeactivationCode = async () => {
    if (!volunteer) return;
    const result = await sendCode(volunteer.email);
    if (result.ok) { setDeleteStep('code'); setAccountMessage(result.debugCode ? `Preview verification code: ${result.debugCode}` : 'A verification code was sent to your email.'); }
    else setAccountMessage('Could not send a code. Please try again.');
  };

  const confirmDeactivation = async (event: React.FormEvent) => {
    event.preventDefault(); setAccountMessage('');
    if (!volunteer || !(await verifyCode(volunteer.email, deleteCode))) return;
    if (await deactivateAccount()) { window.alert('Your volunteer account has been deactivated. Historical shift and attendance records are retained.'); onNavigate('home'); return; }
  };

  const lookUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !reference.trim()) return;

    setLoading(true);
    setError(null);
    try {
      setDonations(await getMyDonations(email.trim(), reference.trim()));
    } catch (cause) {
      setDonations(null);
      setError(cause instanceof ApiError ? cause.message : 'Could not load your donations.');
    } finally {
      setLoading(false);
    }
  };

  const distributed = (donations ?? []).filter((donation) => donation.stage === 'distributed').length;
  const completedShifts = shifts.filter((shift) => shift.signupStatus === 'completed');
  const totalHours = completedShifts.reduce((sum, shift) => sum + shift.hours, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {volunteer && <section className="mb-8 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Account settings</p><h2 className="mt-1 text-xl font-extrabold text-ink">Your volunteer profile</h2>
        <form onSubmit={(event) => void saveAccount(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted">Full name<input required value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Phone<input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Address<input value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Emergency contact<input value={profile.emergencyContact} onChange={(event) => setProfile({ ...profile, emergencyContact: event.target.value })} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Emergency phone<input value={profile.emergencyPhone} onChange={(event) => setProfile({ ...profile, emergencyPhone: event.target.value })} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Driving license number<input value={profile.drivingLicenseNumber} onChange={(event) => setProfile({ ...profile, drivingLicenseNumber: event.target.value })} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Driving license type<input value={profile.drivingLicenseType} onChange={(event) => setProfile({ ...profile, drivingLicenseType: event.target.value })} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">First aid qualification<input value={profile.firstAidQualification} onChange={(event) => setProfile({ ...profile, firstAidQualification: event.target.value })} className="mt-1 block w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink" /></label>
          {skills.length > 0 && <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold text-muted">Skills</legend><div className="mt-2 flex flex-wrap gap-2">{skills.map((skill) => <label key={skill.id} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs text-ink"><input type="checkbox" checked={profile.skillIds.includes(skill.id)} onChange={(event) => setProfile({ ...profile, skillIds: event.target.checked ? [...profile.skillIds, skill.id] : profile.skillIds.filter((id) => id !== skill.id) })} />{skill.name}</label>)}</div></fieldset>}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button disabled={busy} className="rounded-lg bg-brand-800 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save profile'}</button>{accountMessage && <span role="status" className="text-xs text-emerald-800">{accountMessage}</span>}{accountError && <span role="alert" className="text-xs text-rose-700">{accountError}</span>}</div>
        </form>
        <div className="mt-6 border-t border-line pt-4"><h3 className="text-sm font-bold text-rose-800">Deactivate account</h3><p className="mt-1 text-xs text-muted">Your account will be signed out and removed from new shifts. Completed shift and attendance records are retained.</p>
          {deleteStep === 'closed' && <button onClick={() => setDeleteStep('confirm')} className="mt-3 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Delete account</button>}
          {deleteStep === 'confirm' && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-ink">Confirm you want to deactivate your account?</span><button onClick={() => void requestDeactivationCode()} disabled={busy} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white">Send confirmation code</button><button onClick={() => setDeleteStep('closed')} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">Cancel</button></div>}
          {deleteStep === 'code' && <form onSubmit={(event) => void confirmDeactivation(event)} className="mt-3 flex flex-wrap items-center gap-2"><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={deleteCode} onChange={(event) => setDeleteCode(event.target.value)} placeholder="6-digit email code" className="rounded-lg border border-line px-3 py-2 text-sm" /><button disabled={busy} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white">{busy ? 'Deleting…' : 'Confirm delete'}</button><button type="button" onClick={() => setDeleteStep('closed')} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">Cancel</button></form>}
        </div>
      </section>}
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">My activity</h1>
      <p className="mt-2 text-sm text-muted">
        Look up a donation with both the reference number from your receipt and the email used when donating. Email alone never reveals donation history.
      </p>

      <form onSubmit={lookUp} className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="flex-1">
          <span className="sr-only">Donation reference number</span>
          <input
            type="text"
            required
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Donation reference (RT-000123)"
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
        </label>
        <label className="flex-1">
          <span className="sr-only">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="Email used for donation"
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-600" />
          
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
          
          <SearchIcon className="h-4 w-4" /> {loading ? 'Loading…' : 'Show my activity'}
        </button>
      </form>

      {error &&
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">{error}</p>
      }

      {donations && donations.length > 0 &&
      <section className="mt-8 rounded-2xl bg-brand-900 p-6 text-white sm:p-8">
          <AwardIcon className="h-6 w-6 text-brand-200" />
          <p className="mt-3 text-4xl font-extrabold tracking-tight">{donations.length}</p>
          <p className="mt-1 text-sm text-brand-100">donation matched to your receipt and email.</p>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-5">
            <div>
              <p className="text-2xl font-bold">{distributed}</p>
              <p className="text-xs text-brand-100">already distributed</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{completedShifts.length}</p>
              <p className="text-xs text-brand-100">volunteer shifts</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalHours} hrs</p>
              <p className="text-xs text-brand-100">time volunteered</p>
            </div>
          </div>
        </section>
      }

      {donations && donations.length === 0 &&
      <div className="mt-8">
          <EmptyBlock message="No donations found for that email address." />
        </div>
      }

      {donations && donations.length > 0 &&
      <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold tracking-tight text-ink">My donations</h2>
            <button
            onClick={() => onNavigate('donate')}
            className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800">
            
              Donate again <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {donations.map((donation) =>
          <li key={donation.reference} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-bold text-muted">{donation.reference}</p>
                    <p className="mt-1 text-base font-bold text-ink">{donation.amount}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {donation.operation} · {donation.date}
                    </p>
                  </div>
                  <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                donation.stage === 'distributed' ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-700'}`
                }>
                
                    {stageLabel[donation.stage]}
                  </span>
                </div>
              </li>
          )}
          </ul>
        </section>
      }

      {volunteer && shifts.length > 0 &&
      <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold tracking-tight text-ink">My volunteer shifts</h2>
            <button
            onClick={() => onNavigate('shifts')}
            className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800">
            
              Open my shifts <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>

          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {shifts.map((shift) =>
          <li key={shift.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <UsersIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{shift.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {shift.location} · {shift.date}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <ClockIcon className="h-3.5 w-3.5" /> {shift.hours} hrs
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold capitalize text-ink">
                  {shift.signupStatus}
                </span>
              </li>
          )}
          </ul>
        </section>
      }
    </div>);

}
