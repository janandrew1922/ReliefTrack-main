
import { useState } from 'react';
import { CalendarIcon, CheckCircle2Icon, ClockIcon, MapPinIcon, NavigationIcon, UsersIcon } from 'lucide-react';
import { VolunteerSignupModal } from '../../components/public/VolunteerSignupModal';
import { ErrorBlock, LoadingBlock } from '../../components/StateViews';
import { useVolunteerAuth } from '../../contexts/VolunteerAuth';
import { useResource } from '../../hooks/useResource';
import { getShifts, getSkills } from '../../services/reliefService';
import { whatToBring } from '../../data/staticContent';
import type { Shift } from '../../types/domain';
import type { PublicRoute } from '../../components/public/PublicNav';

interface VolunteerProps {
  onNavigate: (route: PublicRoute) => void;
}

export function Volunteer({ onNavigate }: VolunteerProps) {
  const { volunteer, hasJoined } = useVolunteerAuth();
  const { data, loading, error, reload } = useResource(getShifts);
  const skills = useResource(getSkills);
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selected, setSelected] = useState<Shift | null>(null);

  const openShifts = (data ?? []).filter((shift) => shift.status === 'open' || shift.status === 'full');
  const shifts = openShifts.filter((shift) =>
    (!onlyUrgent || shift.needed > 0 && shift.filled / shift.needed < 0.6) &&
    (!selectedSkill || (shift.requiredSkills ?? []).includes(selectedSkill))
  );
  const openSlots = openShifts.reduce((sum, shift) => sum + Math.max(shift.needed - shift.filled, 0), 0);
  const selectedSkillSlots = selectedSkill
    ? openShifts.filter((shift) => (shift.requiredSkills ?? []).includes(selectedSkill))
      .reduce((sum, shift) => sum + Math.max(shift.needed - shift.filled, 0), 0)
    : openSlots;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Volunteer for a shift</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Relief hubs need people to sort, pack, and distribute goods. Most shifts run for four hours.
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5">
          <input
            type="checkbox"
            checked={onlyUrgent}
            onChange={(event) => setOnlyUrgent(event.target.checked)}
            className="h-4 w-4 accent-brand-700" />
          
          <span className="text-xs font-semibold text-ink">Show only understaffed shifts</span>
        </label>
      </div>

      {volunteer &&
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 px-4 py-3">
          <p className="flex-1 text-sm text-brand-900">
            Signed in as <span className="font-bold">{volunteer.fullName}</span> ·{' '}
            <span className="font-mono text-xs">Volunteer #{volunteer.volunteerId}</span>
          </p>
          <button
          onClick={() => onNavigate('shifts')}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand-800">
          
            View my shifts
          </button>
        </div>
      }

      <section className="mt-7 border-y border-line py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">Strengths needed</h2>
          <p className="text-sm font-semibold text-rose-700">{selectedSkillSlots} {selectedSkill ? `${selectedSkill.toLowerCase()} ` : ''}volunteer slot{selectedSkillSlots === 1 ? '' : 's'} open</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {(skills.data ?? []).map((skill) => {
            const needed = openShifts.filter((shift) => (shift.requiredSkills ?? []).includes(skill.name)).reduce((sum, shift) => sum + Math.max(shift.needed - shift.filled, 0), 0);
            return (
              <button key={skill.id} onClick={() => { setSelectedSkill(selectedSkill === skill.name ? '' : skill.name); setOnlyUrgent(false); }} aria-pressed={selectedSkill === skill.name} title={skill.description} className={`rounded-full border px-4 py-2.5 text-sm font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${selectedSkill === skill.name ? 'border-brand-800 bg-brand-800 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-brand-500 hover:bg-brand-50'}`}>
                {skill.name} · {needed} needed
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          {loading && <LoadingBlock label="Loading available shifts" rows={3} />}
          {error && <ErrorBlock message={error} onRetry={reload} />}

          {shifts.map((shift) => {
            const percent = shift.needed > 0 ? Math.min(Math.round(shift.filled / shift.needed * 100), 100) : 0;
            const short = Math.max(shift.needed - shift.filled, 0);
            const joined = hasJoined(shift.id);
            const urgent = percent < 60;

            return (
              <article key={shift.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-ink">{shift.name}</h2>
                      {urgent &&
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold uppercase text-rose-700">
                          Understaffed
                        </span>
                      }
                    </div>
                    <p className="mt-1 text-sm text-muted">{shift.location}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs font-semibold text-ink">
                    {shift.filled}/{shift.needed}
                    <span className="mt-0.5 block font-normal text-muted">joined</span>
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

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${urgent ? 'bg-rose-500' : 'bg-brand-600'}`}
                    style={{ width: `${percent}%` }} />
                  
                </div>
                {short > 0 &&
                <p className={`mt-2 text-xs font-semibold ${urgent ? 'text-rose-600' : 'text-amber-600'}`}>
                    {short} more volunteer{short === 1 ? '' : 's'} needed
                  </p>
                }

                <div className="mt-4 flex flex-wrap gap-2">
                  {joined ?
                  <button
                    onClick={() => onNavigate('shifts')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-4 py-2.5 text-sm font-bold text-brand-800">
                    
                      <CheckCircle2Icon className="h-4 w-4" /> Joined — view details
                    </button> :

                  <button
                    onClick={() => setSelected(shift)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800">
                    
                      <UsersIcon className="h-4 w-4" /> Join this shift
                    </button>
                  }
                  {shift.coordinates &&
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${shift.coordinates[0]},${shift.coordinates[1]}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-gray-50">
                    
                      <NavigationIcon className="h-4 w-4" /> Directions
                    </a>
                  }
                </div>
              </article>);

          })}

          {data && shifts.length === 0 &&
          <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">
              {onlyUrgent ?
            'No understaffed shifts right now. Uncheck the filter to see all open shifts.' :
            'No open shifts have been posted yet. Please check back soon.'}
            </p>
          }
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-sm font-bold text-ink">What to bring</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
              {whatToBring.map((item) =>
              <li key={item}>{item}</li>
              )}
            </ul>
          </div>

          {!volunteer &&
          <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-sm font-bold text-ink">Already registered?</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Sign in with your email to see your shifts, check-in code, and hours logged.
              </p>
              <button
              onClick={() => onNavigate('login')}
              className="mt-3 rounded-lg border border-line px-3.5 py-2 text-xs font-bold text-ink transition-colors hover:bg-gray-50">
              
                Volunteer sign in
              </button>
            </div>
          }
        </div>
      </div>

      <VolunteerSignupModal
        shift={selected}
        selectedSkill={selectedSkill}
        onClose={() => setSelected(null)}
        onRegistered={() => {
          setSelected(null);
          onNavigate('shifts');
        }} />
      
    </div>);

}
