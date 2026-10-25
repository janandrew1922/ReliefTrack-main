
import { ArrowRightIcon, HeartHandshakeIcon, MapPinIcon, SearchIcon, UsersIcon } from 'lucide-react';
import { ReliefMap } from '../../components/ReliefMap';
import { ErrorBlock, LoadingBlock } from '../../components/StateViews';
import { useResource } from '../../hooks/useResource';
import { getNeededItems, getShifts } from '../../services/reliefService';
import { howItWorks, priorityLabel, priorityStyle } from '../../data/staticContent';
import type { PublicRoute } from '../../components/public/PublicNav';

interface HomeProps {
  onNavigate: (route: PublicRoute) => void;
}

export function Home({ onNavigate }: HomeProps) {
  const needs = useResource(getNeededItems);
  const shifts = useResource(getShifts);

  const openSlots = (shifts.data ?? []).
  filter((shift) => shift.status === 'open' || shift.status === 'full').
  reduce((sum, shift) => sum + Math.max(shift.needed - shift.filled, 0), 0);
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const prioritizedNeeds = [...(needs.data ?? [])].filter((need) => need.status !== 'fulfilled').sort((left, right) =>
    priorityOrder[left.priority] - priorityOrder[right.priority] ||
    (right.quantityNeeded - right.quantityReceived) - (left.quantityNeeded - left.quantityReceived)
  );
  const groupedNeeds = Array.from(prioritizedNeeds.reduce((groups, need) => {
    const location = need.location.trim() || 'Location not specified';
    const locationNeeds = groups.get(location) ?? [];
    locationNeeds.push(need);
    groups.set(location, locationNeeds);
    return groups;
  }, new Map<string, typeof prioritizedNeeds>())).sort(([, leftNeeds], [, rightNeeds]) => {
    const priorityDifference = priorityOrder[leftNeeds[0].priority] - priorityOrder[rightNeeds[0].priority];
    if (priorityDifference !== 0) return priorityDifference;
    const leftShortfall = leftNeeds.reduce((sum, need) => sum + Math.max(need.quantityNeeded - need.quantityReceived, 0), 0);
    const rightShortfall = rightNeeds.reduce((sum, need) => sum + Math.max(need.quantityNeeded - need.quantityReceived, 0), 0);
    return rightShortfall - leftShortfall;
  });

  return (
    <div className="space-y-14 pb-16">
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-16">
          <div>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">
              Your help can reach a family today.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
              Donate goods or funds, join a shift near you, and follow exactly where your donation goes — from
              the drop-off center to the family who receives it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate('donate')}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-800">
                
                <HeartHandshakeIcon className="h-4 w-4" /> Donate now
              </button>
              <button
                onClick={() => onNavigate('volunteer')}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink transition-colors hover:bg-gray-50">
                
                <UsersIcon className="h-4 w-4" /> Volunteer
              </button>
              <button
                onClick={() => onNavigate('track')}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50">
                
                <SearchIcon className="h-4 w-4" /> Track my donation
              </button>
            </div>

          </div>

          <img
            src="/85d10986-1e79-4d08-9a63-921b83635322.jpg"
            alt="Volunteers repacking rice and canned goods into relief boxes at a warehouse"
            className="h-full max-h-[440px] w-full rounded-2xl object-cover" />
          
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">What is needed right now</h2>
            <p className="mt-1 text-sm text-muted">Updated by field coordinators as supplies run low.</p>
          </div>
          <button
            onClick={() => onNavigate('donate')}
            className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800">
            
            Donate these items <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6">
          {needs.loading && <LoadingBlock label="Loading needed items" rows={4} />}
          {needs.error && <ErrorBlock message={needs.error} onRetry={needs.reload} />}
          {needs.data && prioritizedNeeds.length === 0 &&
          <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">
              No outstanding needs have been posted yet.
            </p>
          }

          {needs.data && prioritizedNeeds.length > 0 &&
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {groupedNeeds.map(([location, locationNeeds]) =>
              <li key={location} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                  <h3 className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                    <MapPinIcon className="h-4 w-4 text-brand-700" /> {location}
                  </h3>
                  <span className="shrink-0 text-xs font-semibold text-muted">{locationNeeds.length} item{locationNeeds.length === 1 ? '' : 's'} needed</span>
                </div>
                <ul className="divide-y divide-line">
                  {locationNeeds.map((need) => {
                    const shortfall = Math.max(need.quantityNeeded - need.quantityReceived, 0);
                    const percent = need.quantityNeeded > 0 ? Math.min(Math.round(need.quantityReceived / need.quantityNeeded * 100), 100) : 0;
                    return (
                      <li key={need.id} className="py-3 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{need.itemName}</p>
                            <p className="mt-0.5 text-xs text-muted">{need.quantityReceived.toLocaleString()} of {need.quantityNeeded.toLocaleString()} received · <span className="font-semibold text-rose-700">{shortfall.toLocaleString()} still needed</span></p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${priorityStyle[need.priority]}`}>
                            {priorityLabel[need.priority]}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div className={`h-full rounded-full ${percent >= 80 ? 'bg-brand-600' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
              )}
            </ul>
          }
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">Where to bring your donation</h2>
        <p className="mt-1 text-sm text-muted">
          Find the nearest drop-off center, then tap <span className="font-semibold text-ink">Get directions</span>.
        </p>
        <div className="mt-6">
          <ReliefMap kinds={['donation_center', 'warehouse']} heightClassName="h-[420px]" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">How your donation travels</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">
          {howItWorks.map(([title, detail], index) =>
          <li key={title} className="rounded-2xl border border-line bg-white p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-3 text-sm font-bold text-ink">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
            </li>
          )}
        </ol>
      </section>

      {openSlots > 0 &&
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl bg-brand-900 px-6 py-10 text-center sm:px-10">
            <MapPinIcon className="mx-auto h-6 w-6 text-brand-200" />
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white">
              {openSlots} volunteers are still needed
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-brand-100">
              Relief hubs cannot finish today's packing without more hands. A shift is only three to four hours.
            </p>
            <button
            onClick={() => onNavigate('volunteer')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-900 transition-colors hover:bg-brand-50">
            
              <UsersIcon className="h-4 w-4" /> Find a shift near me
            </button>
          </div>
        </section>
      }
    </div>);

}
