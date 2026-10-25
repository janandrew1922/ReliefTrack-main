
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MobileNav } from './components/MobileNav';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './pages/Dashboard';
import { PanelPage, type PanelId } from './pages/PanelPage';
import { PublicSite } from './pages/public/PublicSite';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuth';
import { NewOperationModal } from './components/NewOperationModal';
import { isLocalStorageAvailable } from './services/localApi';

type ActivePage = 'overview' | PanelId;
type AppView = 'donor' | 'staff';
const VIEW_STORAGE_KEY = 'relieftrack.app.view';
const PAGE_STORAGE_KEY = 'relieftrack.staff.page';
const activePages: ActivePage[] = ['overview', 'volunteers', 'donations', 'inventory', 'logistics', 'distribution', 'reports', 'settings', 'verification'];

function readSavedView(fallback: AppView): AppView {
  try {
    const saved = window.sessionStorage.getItem(VIEW_STORAGE_KEY);
    return saved === 'staff' || saved === 'donor' ? saved : fallback;
  } catch {
    return fallback;
  }
}

function readSavedPage(): ActivePage {
  try {
    const saved = window.sessionStorage.getItem(PAGE_STORAGE_KEY) as ActivePage | null;
    return saved && activePages.includes(saved) ? saved : 'overview';
  } catch {
    return 'overview';
  }
}

const pageMeta: Record<ActivePage, {title: string;subtitle: string;}> = {
  overview: { title: 'Operations Overview', subtitle: 'Live data from the ReliefTrack database' },
  volunteers: { title: 'Volunteers & Shifts', subtitle: 'Staffing needs and sign-up status across every hub' },
  donations: { title: 'Donations', subtitle: 'Cash, goods, and active drop-off locations' },
  inventory: { title: 'Inventory', subtitle: 'Stock on hand against minimum stock levels' },
  logistics: { title: 'Logistics', subtitle: 'Vehicle assignments and shipment status' },
  distribution: { title: 'Distribution Map', subtitle: 'Relief sites, donation centers, warehouses, and vehicles' },
  reports: { title: 'Reports', subtitle: 'Transparent activity and accountability snapshots' },
  settings: { title: 'Settings', subtitle: 'Operation preferences, alerts, and map controls' },
  verification: { title: 'Verification', subtitle: 'Review volunteer skill verification photos' }
};

interface AppProps {
  experience?: 'donor' | 'staff';
}

export function App({ experience = 'donor' }: AppProps) {
  return (
    <AdminAuthProvider>
      <AppContent experience={experience} />
    </AdminAuthProvider>
  );
}

function AppContent({ experience = 'donor' }: AppProps) {
  const [view, setView] = useState<AppView>(() => readSavedView(experience));
  const [active, setActive] = useState<ActivePage>(readSavedPage);
  const { admin, restoring } = useAdminAuth();
  const [showNewOperation, setShowNewOperation] = useState(false);
  const [dashboardVersion, setDashboardVersion] = useState(0);
  const [localStorageReady, setLocalStorageReady] = useState(true);

  useEffect(() => {
    if (import.meta.env.VITE_DATA_MODE !== 'api') setLocalStorageReady(isLocalStorageAvailable());
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(VIEW_STORAGE_KEY, view);
      window.sessionStorage.setItem(PAGE_STORAGE_KEY, active);
    } catch {
      // Keep navigation usable when browser storage is unavailable.
    }
  }, [view, active]);
  const storageWarning = !localStorageReady &&
  <div role="alert" className="fixed bottom-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 shadow-lg">
    Browser storage is unavailable. Local demo changes will not persist.
  </div>;

  const content = useMemo(() => {
    if (active === 'overview') return <Dashboard key={dashboardVersion} />;
    return <PanelPage panel={active} />;
  }, [active, dashboardVersion]);

  if (!admin) {
    if (view === 'staff' && restoring) return <main className="grid min-h-screen place-items-center text-sm font-medium text-muted">Restoring staff session…</main>;
    return <>{storageWarning}<PublicSite onAdminLogin={() => setView('staff')} /></>;
  }

  if (view === 'donor') return <>{storageWarning}<PublicSite onAdminLogin={() => setView('staff')} /></>;

  const select = (id: string) => {
    if (id === 'public') {
      setView('donor');
      return;
    }
    setActive(id as ActivePage);
  };

  return (
    <div className="flex w-full min-h-screen bg-[var(--bg)] text-ink pb-16 lg:pb-0">
      {storageWarning}
      <Sidebar active={active} onSelect={select} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar title={pageMeta[active].title} subtitle={pageMeta[active].subtitle} onNavigate={select} onNewOperation={() => setShowNewOperation(true)} />
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileNav active={active} onSelect={select} />
      {showNewOperation && <NewOperationModal onClose={() => setShowNewOperation(false)} onCreated={() => { setShowNewOperation(false); setActive('overview'); setDashboardVersion((version) => version + 1); }} />}
    </div>);

}
