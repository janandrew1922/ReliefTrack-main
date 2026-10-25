
import React from 'react';
import {
  ActivityIcon,
  HeartHandshakeIcon,
  PackageIcon,
  TruckIcon,
  UsersIcon,
  ClipboardListIcon } from
'lucide-react';
import type { ActivityItem } from '../types/domain';

/** Keyed on activity_log.module. */
const moduleIcon: Record<string, React.ComponentType<{className?: string;}>> = {
  Donations: HeartHandshakeIcon,
  Volunteers: UsersIcon,
  Shipments: TruckIcon,
  Inventory: PackageIcon,
  Operations: ClipboardListIcon
};

const moduleStyle: Record<string, string> = {
  Donations: 'bg-brand-50 text-brand-700',
  Volunteers: 'bg-sky-50 text-sky-600',
  Shipments: 'bg-indigo-50 text-indigo-600',
  Inventory: 'bg-amber-50 text-amber-600',
  Operations: 'bg-violet-50 text-violet-600'
};

export function ActivityFeed({ activity }: {activity: ActivityItem[];}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-sm font-bold text-ink">Activity log</h2>
      <p className="mt-0.5 text-xs text-muted">Recorded actions from every module</p>

      {activity.length === 0 ?
      <p className="mt-6 text-sm text-muted">No activity recorded yet.</p> :

      <ol className="mt-4 max-h-[360px] space-y-1 overflow-y-auto pr-2">
          {activity.map((item, index) => {
          const Icon = moduleIcon[item.module] ?? ActivityIcon;
          const style = moduleStyle[item.module] ?? 'bg-gray-100 text-muted';
          return (
            <li key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${style}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {index < activity.length - 1 && <span className="my-1 w-px flex-1 bg-line" />}
                </div>
                <div className="min-w-0 pb-4">
                  <p className="text-[13px] font-semibold leading-snug text-ink">{item.action}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.description}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {item.staff ? `${item.staff} · ` : ''}
                    {item.time}
                  </p>
                </div>
              </li>);

        })}
        </ol>
      }
    </section>);

}