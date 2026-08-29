import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Network, Database, Clock, Bell, Sparkles,
  FileText, Settings, ShieldAlert, Upload, DatabaseZap,
} from 'lucide-react';
import { useDatasetContext } from '@/hooks/useDatasetContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/network', label: 'Network Analysis', icon: Network },
  { to: '/data', label: 'Data Explorer', icon: Database },
  { to: '/timeline', label: 'Timeline', icon: Clock },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/ai-analysis', label: 'AI Analysis', icon: Sparkles },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/import', label: 'Import Data', icon: Upload },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { dataset } = useDatasetContext();
  const source = dataset?.metadata.source ?? null;

  return (
    <aside className="w-60 shrink-0 bg-ink-900 border-r border-ink-700 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-ink-700">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-accent-600 flex items-center justify-center shrink-0">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">AI Network Intelligence</h1>
            <p className="text-[11px] text-gray-500 leading-tight">Analysis Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-ink-700 space-y-2">
        {source === 'demo' && (
          <div className="flex items-center gap-2 px-2">
            <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-3 h-3 mr-1" />
              DEMO DATA
            </span>
          </div>
        )}
        {source === 'csv' && (
          <div className="flex items-center gap-2 px-2">
            <span className="badge bg-signal-green/15 text-signal-green border border-signal-green/30">
              <DatabaseZap className="w-3 h-3 mr-1" />
              IMPORTED
            </span>
          </div>
        )}
        {source === 'import' && (
          <div className="flex items-center gap-2 px-2">
            <span className="badge bg-accent-500/15 text-accent-400 border border-accent-500/30">
              <Upload className="w-3 h-3 mr-1" />
              IMPORTED
            </span>
          </div>
        )}
        <p className="text-[10px] text-gray-600 px-2 leading-tight">
          {source === 'demo'
            ? 'Synthetic dataset for prototype demonstration only.'
            : 'User-provided data. Analysis results may vary.'}
        </p>
      </div>
    </aside>
  );
}
