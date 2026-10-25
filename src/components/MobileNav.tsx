

import { BarChart3Icon, HeartHandshakeIcon, LayoutDashboardIcon, MapIcon, PackageIcon, SettingsIcon, TruckIcon, UsersIcon } from 'lucide-react';

const items = [
{ id: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
{ id: 'volunteers', label: 'Volunteers', icon: UsersIcon },
{ id: 'donations', label: 'Donations', icon: HeartHandshakeIcon },
{ id: 'inventory', label: 'Inventory', icon: PackageIcon },
{ id: 'logistics', label: 'Logistics', icon: TruckIcon },
{ id: 'distribution', label: 'Map', icon: MapIcon },
{ id: 'reports', label: 'Reports', icon: BarChart3Icon },
{ id: 'settings', label: 'Settings', icon: SettingsIcon }];


interface MobileNavProps {
  active: string;
  onSelect: (id: string) => void;
}

export function MobileNav({ active, onSelect }: MobileNavProps) {
  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 backdrop-blur lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-colors ${isActive ? 'text-brand-700' : 'text-muted'}`}
            aria-current={isActive ? 'page' : undefined}>
            
            <Icon className={`h-5 w-5 ${isActive ? 'text-brand-700' : ''}`} />
            <span className="truncate">{item.label}</span>
          </button>);

      })}
    </nav>);

}