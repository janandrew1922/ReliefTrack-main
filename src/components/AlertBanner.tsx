import { useState } from 'react';
import { AlertTriangleIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import type { Alert } from '../types/domain';

const tone: Record<Alert['priority'], {box: string;icon: string;title: string;body: string;}> = {
  critical: { box: 'border-rose-200 bg-rose-50', icon: 'text-rose-600', title: 'text-rose-800', body: 'text-rose-700' },
  high: { box: 'border-amber-200 bg-amber-50', icon: 'text-amber-600', title: 'text-amber-800', body: 'text-amber-700' },
  medium: { box: 'border-sky-200 bg-sky-50', icon: 'text-sky-600', title: 'text-sky-800', body: 'text-sky-700' },
  low: { box: 'border-line bg-gray-50', icon: 'text-muted', title: 'text-ink', body: 'text-muted' }
};

export function AlertBanner({ alerts }: {alerts: Alert[];}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const visible = (alerts ?? []).filter((alert) => !dismissed.includes(alert.id));

  if (visible.length === 0) return null;

  const criticalCount = visible.filter((alert) => alert.priority === 'critical').length;
  const otherCount = visible.length - criticalCount;
  const summaryTone = criticalCount > 0 ? tone.critical : visible.some((alert) => alert.priority === 'high') ? tone.high : tone.medium;

  return (
    <section className={`overflow-hidden rounded-xl border ${summaryTone.box}`} aria-label="Operational alerts">
      <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
        <AlertTriangleIcon className={`h-4 w-4 shrink-0 ${summaryTone.icon}`} />
        <p className={`min-w-0 flex-1 text-xs font-semibold ${summaryTone.title}`}>
          {criticalCount > 0 ? `${criticalCount} critical alert${criticalCount === 1 ? '' : 's'}` : 'Operational alerts'}
          {otherCount > 0 && <span className={`font-normal ${summaryTone.body}`}> · {otherCount} other</span>}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-white/70 ${summaryTone.title}`}>
          {expanded ? 'Hide alerts' : 'View alerts'}
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && <div className="space-y-2 border-t border-line p-3">
        {visible.map((alert) => {
          const style = tone[alert.priority] ?? tone.low;
          return (
            <div key={alert.id} className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 ${style.box}`}>
              <AlertTriangleIcon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${style.title}`}>{alert.title}</p>
                <p className={`mt-0.5 text-xs leading-relaxed ${style.body}`}>{alert.message}</p>
                <p className={`mt-1 text-[10px] font-medium uppercase tracking-wide ${style.body}`}>
                  {alert.type} · {alert.time}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed((current) => [...current, alert.id])}
                aria-label={`Dismiss ${alert.title}`}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/60 ${style.icon}`}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>}
    </section>
  );
}