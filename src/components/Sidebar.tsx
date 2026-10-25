
import React from 'react';
import {
  LayoutDashboardIcon,
  UsersIcon,
  HeartHandshakeIcon,
  PackageIcon,
  TruckIcon,
  MapIcon,
  BarChart3Icon,
  SettingsIcon,
  CheckCircle2Icon,
  LifeBuoyIcon,
  GlobeIcon } from
'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{className?: string;}>;
  badge?: string;
}

const primaryNav: NavItem[] = [
{ id: 'overview', label: 'Operations Overview', icon: LayoutDashboardIcon },
{ id: 'volunteers', label: 'Volunteers & Shifts', icon: UsersIcon },
{ id: 'donations', label: 'Donations', icon: HeartHandshakeIcon },
{ id: 'inventory', label: 'Inventory', icon: PackageIcon },
{ id: 'logistics', label: 'Logistics', icon: TruckIcon },
{ id: 'distribution', label: 'Distribution Map', icon: MapIcon },
{ id: 'reports', label: 'Reports', icon: BarChart3Icon }];


interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-white lg:flex">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-line">
        <div className="grid place-items-center w-9 h-9 rounded-xl bg-brand-700 text-white">
          <LifeBuoyIcon className="w-5 h-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-ink">ReliefTrack</p>
          <p className="text-[11px] text-muted">Operations Command</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Primary">
        {primaryNav.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ?
              'bg-brand-50 text-brand-800' :
              'text-muted hover:bg-gray-50 hover:text-ink'}`
              }>
              
              <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-brand-700' : ''}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge &&
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-brand-700 text-white' : 'bg-gray-100 text-muted'}`
                }>
                
                  {item.badge}
                </span>
              }
            </button>);

        })}
      </nav>

      <div className="p-3 border-t border-line space-y-1">
        <button onClick={() => onSelect('public')} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-gray-50 hover:text-ink">
          <GlobeIcon className="w-[18px] h-[18px]" />
          View donor site
        </button>
        <button onClick={() => onSelect('verification')} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active === 'verification' ? 'bg-brand-50 text-brand-800' : 'text-muted hover:bg-gray-50 hover:text-ink'}`}>
          <CheckCircle2Icon className={`w-[18px] h-[18px] ${active === 'verification' ? 'text-brand-700' : ''}`} />
          Verification
        </button>
        <button onClick={() => onSelect('settings')} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active === 'settings' ? 'bg-brand-50 text-brand-800' : 'text-muted hover:bg-gray-50 hover:text-ink'}`}>
          <SettingsIcon className={`w-[18px] h-[18px] ${active === 'settings' ? 'text-brand-700' : ''}`} />
          Settings
        </button>
        <div className="mt-2 rounded-xl bg-brand-900 p-3.5 text-white">
          <p className="text-[13px] font-semibold">Field coverage</p>
          <p className="text-[11px] text-brand-100 mt-0.5">See every site, hub, and vehicle on one map.</p>
          <button onClick={() => onSelect('distribution')} className="mt-2.5 w-full rounded-lg bg-white text-brand-900 text-xs font-semibold py-1.5 hover:bg-brand-50 transition-colors">
            Open live map
          </button>
        </div>
      </div>
    </aside>);

}
