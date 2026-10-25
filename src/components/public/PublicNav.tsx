
import { LifeBuoyIcon, LogOutIcon, UserRoundIcon } from 'lucide-react';
import { useVolunteerAuth } from '../../contexts/VolunteerAuth';
import { useDriverAuth } from '../../contexts/DriverAuth';

export type PublicRoute = 'home' | 'donate' | 'volunteer' | 'track' | 'activity' | 'login' | 'shifts' | 'driver';

const links: {id: PublicRoute;label: string;}[] = [
{ id: 'home', label: 'Home' },
{ id: 'donate', label: 'Donate' },
{ id: 'volunteer', label: 'Volunteer' },
{ id: 'track', label: 'Track donation' },
{ id: 'activity', label: 'My activity' }];


interface PublicNavProps {
  active: PublicRoute;
  onNavigate: (route: PublicRoute) => void;
}

export function PublicNav({ active, onNavigate }: PublicNavProps) {
  const { volunteer, signOut } = useVolunteerAuth();
  const { driver, signOut: signOutDriver } = useDriverAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <button onClick={() => onNavigate('home')} className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white">
            <LifeBuoyIcon className="h-5 w-5" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-sm font-bold text-ink">ReliefTrack</span>
            <span className="block text-[11px] text-muted">Help where it is needed</span>
          </span>
        </button>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {links.map((link) =>
          <button
            key={link.id}
            onClick={() => onNavigate(link.id)}
            aria-current={active === link.id ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            active === link.id ? 'bg-brand-50 text-brand-800' : 'text-muted hover:bg-gray-50 hover:text-ink'}`
            }>
            
              {link.label}
            </button>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-3">
          {driver && <button onClick={() => onNavigate('driver')} aria-current={active === 'driver' ? 'page' : undefined} className={`hidden items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold sm:inline-flex ${active === 'driver' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-line text-ink hover:bg-gray-50'}`}>Driver routes</button>}
          {driver && <button onClick={() => { signOutDriver(); onNavigate('home'); }} aria-label="Driver sign out" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:bg-gray-50"><LogOutIcon className="h-4 w-4" /></button>}
          {volunteer ?
          <>
              <button
              onClick={() => onNavigate('shifts')}
              aria-current={active === 'shifts' ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
              active === 'shifts' ? 'bg-brand-50 text-brand-800' : 'text-ink hover:bg-gray-50'}`
              }>
              
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-800">
                  {volunteer.fullName.
                split(' ').
                map((word) => word[0]).
                join('').
                slice(0, 2)}
                </span>
                My shifts
              </button>
              <button
              onClick={() => {
                signOut();
                onNavigate('home');
              }}
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-gray-50 hover:text-ink">
              
                <LogOutIcon className="h-4 w-4" />
              </button>
          </> : null
          }
          {!volunteer && !driver && <button onClick={() => onNavigate('login')} aria-current={active === 'login' ? 'page' : undefined} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-800"><UserRoundIcon className="h-3.5 w-3.5" />Sign in</button>}
        </div>
      </div>

      <nav aria-label="Main mobile" className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
        {links.map((link) =>
        <button
          key={link.id}
          onClick={() => onNavigate(link.id)}
          aria-current={active === link.id ? 'page' : undefined}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
          active === link.id ? 'bg-brand-50 text-brand-800' : 'text-muted'}`
          }>
          
            {link.label}
          </button>
        )}
      </nav>
    </header>);

}
