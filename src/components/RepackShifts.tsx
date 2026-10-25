
import { UsersIcon } from 'lucide-react';
import { getShifts } from '../services/reliefService';
import { useResource } from '../hooks/useResource';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './StateViews';

export function RepackShifts() {
  const { data, loading, error, reload } = useResource(getShifts);

  const open = (data ?? []).filter((shift) => shift.status === 'open' || shift.status === 'full');

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-sm font-bold text-ink">Volunteer shifts</h2>
      <p className="mt-0.5 text-xs text-muted">Approved sign-ups against required volunteers</p>

      <div className="mt-4">
        {loading && <LoadingBlock label="Loading shifts" rows={3} />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
        {data && open.length === 0 && <EmptyBlock message="No open shifts scheduled." />}

        {open.length > 0 &&
        <div className="space-y-3">
            {open.map((shift) => {
            const percent = shift.needed > 0 ? Math.min(Math.round(shift.filled / shift.needed * 100), 100) : 0;
            const short = Math.max(shift.needed - shift.filled, 0);
            return (
              <div key={shift.id} className="rounded-xl border border-line p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{shift.name}</p>
                    <span className="shrink-0 text-[11px] font-medium text-muted">{shift.window}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {shift.location} · {shift.date}
                  </p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                      className={`h-full rounded-full ${percent >= 80 ? 'bg-brand-600' : 'bg-amber-500'}`}
                      style={{ width: `${percent}%` }} />
                    
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                      <UsersIcon className="h-3.5 w-3.5 text-muted" />
                      {shift.filled}/{shift.needed}
                    </span>
                  </div>
                  {short > 0 &&
                <p className="mt-1.5 text-[11px] font-medium text-amber-600">{short} more volunteers needed</p>
                }
                </div>);

          })}
          </div>
        }
      </div>
    </section>);

}