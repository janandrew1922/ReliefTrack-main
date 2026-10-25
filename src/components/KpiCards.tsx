
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUpIcon, UsersIcon, HeartHandshakeIcon, PackageIcon, HomeIcon } from 'lucide-react';
import type { Kpi } from '../types/domain';

const iconMap: Record<string, React.ComponentType<{className?: string;}>> = {
  volunteers: UsersIcon,
  donations: HeartHandshakeIcon,
  packs: PackageIcon,
  families: HomeIcon
};

export function KpiCards({ kpis }: {kpis: Kpi[];}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => {
        const Icon = iconMap[kpi.id] ?? PackageIcon;
        return (
          <motion.div
            key={kpi.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' }}
            className="rounded-2xl border border-line bg-white p-5">
            
            <div className="flex items-center justify-between">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-brand-50 text-brand-700">
                <Icon className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 bg-brand-50 rounded-full px-2 py-1">
                <TrendingUpIcon className="w-3.5 h-3.5" />
                {kpi.delta}
              </span>
            </div>
            <p className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{kpi.value}</p>
            <p className="text-sm font-medium text-ink mt-0.5">{kpi.label}</p>
            <p className="text-xs text-muted mt-0.5">{kpi.sub}</p>
          </motion.div>);

      })}
    </div>);

}