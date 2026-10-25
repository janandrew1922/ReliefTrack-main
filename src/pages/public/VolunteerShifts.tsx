
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AwardIcon, CalendarIcon, ClockIcon, MapPinIcon, NavigationIcon, QrCodeIcon, XIcon } from 'lucide-react';
import { useVolunteerAuth } from '../../contexts/VolunteerAuth';
import { whatToBring } from '../../data/staticContent';
import type { SignupStatus } from '../../types/domain';
import type { PublicRoute } from '../../components/public/PublicNav';

interface VolunteerShiftsProps {
  onNavigate: (route: PublicRoute) => void;
}

const signupStyle: Record<SignupStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-sky-50 text-sky-700',
  completed: 'bg-brand-50 text-brand-800',
  rejected: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-gray-100 text-muted'
};

export function VolunteerShifts({ onNavigate }: VolunteerShiftsProps) {
  const { volunteer, shifts, cancelShift, busy } = useVolunteerAuth();
  const [showCode, setShowCode] = useState(false);

  if (!volunteer) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Sign in to see your shifts</h1>
        <p className="mt-2 text-sm text-muted">
          Your volunteer number, check-in code, and hours are saved to your account.
        </p>
        <button
          onClick={() => onNavigate('login')}
          className="mt-6 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-800">
          
          Volunteer sign in
        </button>
      </div>);

  }

  const upcoming = shifts.filter(
    (shift) => shift.signupStatus === 'pending' || shift.signupStatus === 'approved'
  );
  const completed = shifts.filter((shift) => shift.signupStatus === 'completed');
  const totalHours = completed.reduce((sum, shift) => sum + shift.hours, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <section className="rounded-2xl bg-brand-900 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-200">Volunteer number</p>
            <p className="mt-1 font-mono text-lg font-bold">#{volunteer.volunteerId}</p>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{volunteer.fullName}</h1>
            <p className="mt-1 text-sm text-brand-100">
              {volunteer.phone} · {volunteer.email}
            </p>
            <p className="mt-1 text-xs capitalize text-brand-200">Account status: {volunteer.status}</p>
          </div>
          <button
            onClick={() => setShowCode(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-900 transition-colors hover:bg-brand-50">
            
            <QrCodeIcon className="h-4 w-4" /> Show check-in code
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-5">
          <div>
            <p className="text-2xl font-bold">{totalHours} hrs</p>
            <p className="text-xs text-brand-100">volunteered</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{completed.length}</p>
            <p className="text-xs text-brand-100">shifts completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{upcoming.length}</p>
            <p className="text-xs text-brand-100">upcoming</p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">Upcoming shifts</h2>
        {upcoming.length === 0 ?
        <div className="mt-4 rounded-2xl border border-line bg-white p-8 text-center">
            <p className="text-sm text-muted">You have no upcoming shifts.</p>
            <button
            onClick={() => onNavigate('volunteer')}
            className="mt-4 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800">
            
              Find a shift
            </button>
          </div> :

        <ul className="mt-4 space-y-3">
            {upcoming.map((shift) =>
          <li key={shift.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-ink">{shift.name}</h3>
                    <p className="mt-0.5 text-sm text-muted">{shift.location}</p>
                  </div>
                  <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${signupStyle[shift.signupStatus]}`}>
                
                    {shift.signupStatus}
                  </span>
                </div>

                <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                  <div className="inline-flex items-center gap-1.5">
                    <MapPinIcon className="h-3.5 w-3.5" /> {shift.city}
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" /> {shift.date}
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <ClockIcon className="h-3.5 w-3.5" /> {shift.window}
                  </div>
                </dl>

                <div className="mt-4 rounded-xl bg-gray-50 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">What to bring</p>
                  <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted">
                    {whatToBring.map((item) =>
                <li key={item}>{item}</li>
                )}
                  </ul>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {shift.coordinates &&
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${shift.coordinates[0]},${shift.coordinates[1]}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800">
                
                      <NavigationIcon className="h-4 w-4" /> Directions to hub
                    </a>
              }
                  <button
                onClick={() => cancelShift(shift.id)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-gray-50 disabled:opacity-60">
                
                    Cancel shift
                  </button>
                </div>
              </li>
          )}
          </ul>
        }
      </section>

      {completed.length > 0 &&
      <section className="mt-10">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Completed shifts</h2>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {completed.map((shift) =>
          <li key={shift.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <AwardIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{shift.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {shift.location} · {shift.date}
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted">{shift.hours} hrs</span>
              </li>
          )}
          </ul>
        </section>
      }

      {showCode &&
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Check-in code">
        
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center">
            <div className="flex items-start justify-between">
              <p className="text-sm font-bold text-ink">Hub check-in code</p>
              <button
              onClick={() => setShowCode(false)}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-gray-100">
              
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid place-items-center rounded-xl bg-gray-50 p-5">
              <QRCodeSVG value={`RT-VOL-${volunteer.volunteerId}`} size={148} bgColor="#f9fafb" fgColor="#0f2e2a" />
            </div>
            <p className="mt-3 font-mono text-sm font-bold text-ink">RT-VOL-{volunteer.volunteerId}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Show this to the hub lead when you arrive so your check-in is recorded.
            </p>
          </div>
        </div>
      }
    </div>);

}