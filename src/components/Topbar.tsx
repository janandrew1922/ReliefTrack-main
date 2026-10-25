

import { useState } from 'react';
import { useAdminAuth } from '../contexts/AdminAuth';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon, LogOutIcon, PlusIcon } from 'lucide-react';
import { getAlerts } from '../services/reliefService';
import { useResource } from '../hooks/useResource';

interface TopbarProps {
  title: string;
  subtitle: string;
  onNavigate?: (id: string) => void;
  onNewOperation?: () => void;
}

export function Topbar({ title, subtitle, onNavigate, onNewOperation }: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const alerts = useResource(getAlerts);
  const { admin, signOut } = useAdminAuth();
  const unreadCount = (alerts.data ?? []).filter((alert) => !alert.isRead).length;

  const navigateForAlert = (type: string) => {
    if (type === 'inventory') onNavigate?.('inventory');
    else if (type === 'volunteer') onNavigate?.('volunteers');
    else if (type === 'shipment') onNavigate?.('logistics');
    else onNavigate?.('overview');
    setShowNotifications(false);
  };

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 h-16 px-5 md:px-7 border-b border-line bg-white/85 backdrop-blur">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-600" aria-hidden="true" />
          <h1 className="text-[15px] font-bold text-ink truncate">{title}</h1>
        </div>
        <p className="text-xs text-muted mt-0.5 hidden sm:block">{subtitle}</p>
      </div>

      <button onClick={() => setShowNotifications((visible) => !visible)} aria-label="Show notifications" aria-expanded={showNotifications} className="relative ml-auto grid place-items-center w-10 h-10 rounded-lg border border-line bg-white hover:bg-gray-50 transition-colors">
        <BellIcon className="w-[18px] h-[18px] text-muted" />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">{unreadCount}</span>}
      </button>

      <AnimatePresence>
        {showNotifications &&
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-5 top-14 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink">Notifications</p>
              <p className="mt-0.5 text-[11px] text-muted">Updates from relief operations</p>
            </div>
            {unreadCount > 0 && <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">{unreadCount} new</span>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.loading && <p className="px-4 py-5 text-xs text-muted">Loading notifications...</p>}
            {alerts.error && <p role="alert" className="px-4 py-5 text-xs text-rose-700">Could not load notifications.</p>}
            {!alerts.loading && !alerts.error && (alerts.data ?? []).length === 0 && <p className="px-4 py-5 text-xs text-muted">You are all caught up.</p>}
            {(alerts.data ?? []).map((alert) =>
            <button
              key={alert.id}
              onClick={() => navigateForAlert(alert.type)}
              className="w-full border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50">
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.priority === 'critical' || alert.priority === 'high' ? 'bg-rose-500' : 'bg-brand-500'}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-ink">{alert.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">{alert.message}</span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">{alert.time}</span>
                </span>
              </div>
            </button>
            )}
          </div>
        </motion.div>}
      </AnimatePresence>

      <button onClick={onNewOperation} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-brand-700 text-white text-sm font-semibold px-3.5 py-2.5 hover:bg-brand-800 transition-colors">
        <PlusIcon className="w-4 h-4" />
        New operation
      </button>

      <div className="flex items-center gap-2 pl-1">
        <div aria-label={admin?.fullName ?? 'Staff member'} className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 ring-2 ring-brand-50">
          {(admin?.fullName ?? 'Staff').split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="hidden xl:block leading-tight">
          <p className="max-w-32 truncate text-[13px] font-semibold text-ink">{admin?.fullName ?? 'Staff'}</p>
          <p className="text-[11px] capitalize text-muted">{admin?.role ?? 'Staff'} workspace</p>
        </div>
      </div>
      <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-gray-50 hover:text-ink">
        <LogOutIcon className="h-[18px] w-[18px]" />
      </button>
    </header>);

}
