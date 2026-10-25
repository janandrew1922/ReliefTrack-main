
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VolunteerAuthProvider } from '../../contexts/VolunteerAuth';
import { DriverAuthProvider } from '../../contexts/DriverAuth';
import { PublicNav, type PublicRoute } from '../../components/public/PublicNav';
import { Home } from './Home';
import { Donate } from './Donate';
import { TrackDonation } from './TrackDonation';
import { Volunteer } from './Volunteer';
import { MyActivity } from './MyActivity';
import { LoginPanel } from './LoginPanel';
import { VolunteerShifts } from './VolunteerShifts';
import { DriverPortal } from './DriverPortal';

interface PublicSiteProps {
  onAdminLogin: () => void;
}

const PUBLIC_ROUTE_STORAGE_KEY = 'relieftrack.public.route';
const publicRoutes: PublicRoute[] = ['home', 'donate', 'volunteer', 'track', 'activity', 'login', 'shifts', 'driver'];

function readSavedRoute(): PublicRoute {
  try {
    const saved = window.sessionStorage.getItem(PUBLIC_ROUTE_STORAGE_KEY) as PublicRoute | null;
    return saved && publicRoutes.includes(saved) ? saved : 'home';
  } catch {
    return 'home';
  }
}
function PublicSiteContent({ onAdminLogin }: PublicSiteProps) {
  const [route, setRoute] = useState<PublicRoute>(readSavedRoute);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(PUBLIC_ROUTE_STORAGE_KEY, route);
    } catch {
      // Keep navigation usable when browser storage is unavailable.
    }
  }, [route]);


  const navigate = (next: PublicRoute) => {
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--bg)]">
      <PublicNav active={route} onNavigate={navigate} />

      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {route === 'home' && <Home onNavigate={navigate} />}
            {route === 'donate' && <Donate onNavigate={navigate} />}
            {route === 'volunteer' && <Volunteer onNavigate={navigate} />}
            {route === 'track' && <TrackDonation />}
            {route === 'activity' && <MyActivity onNavigate={navigate} />}
            {route === 'login' && <LoginPanel onNavigate={navigate} onAdminLogin={onAdminLogin} />}
            {route === 'shifts' && <VolunteerShifts onNavigate={navigate} />}
            {route === 'driver' && <DriverPortal onNavigate={navigate} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-line bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-bold text-ink">ReliefTrack</p>
          <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">
            A disaster relief operations and logistics monitoring system. Every donation is tracked from
            drop-off to distribution so donors can see exactly where their help goes.
          </p>
        </div>
      </footer>
    </div>);

}

export function PublicSite({ onAdminLogin }: PublicSiteProps) {
  return (
    <VolunteerAuthProvider>
      <DriverAuthProvider><PublicSiteContent onAdminLogin={onAdminLogin} /></DriverAuthProvider>
    </VolunteerAuthProvider>);

}
