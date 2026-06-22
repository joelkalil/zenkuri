import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Library, ListOrdered, Loader2, Moon, RefreshCw, Settings, Sun, Trophy } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useTheme } from '../context/ThemeContext';
import type { Platform } from '../types/steam';
import { PLATFORM_META } from '../lib/platforms';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/backlog', icon: ListOrdered, label: 'Backlog' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const platforms: { id: Platform; active: string }[] = [
  { id: 'steam', active: 'bg-sky-500/10 border-sky-500/30' },
  { id: 'psn', active: 'bg-blue-500/10 border-blue-500/30' },
  { id: 'retroachievements', active: 'bg-amber-500/10 border-amber-500/30' },
];

export function Sidebar() {
  const { scanning, scanProgress, sync, configuredPlatforms } = useSteam();
  const { theme, toggleTheme } = useTheme();
  const pct = scanProgress.total > 0 ? Math.round((scanProgress.done / scanProgress.total) * 100) : 0;

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-gray-950 border-r border-gray-800 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shrink-0">
          <Trophy className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-100 leading-tight">Platina</p>
          <p className="text-xs text-gray-600 leading-tight">Achievement Tracker</p>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {platforms.map(({ id, active }) => {
              const synced = configuredPlatforms.includes(id);
              const meta = PLATFORM_META[id];
              return (
                <span
                  key={id}
                  title={synced ? `${meta.label} synced` : `${meta.label} not configured`}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                    synced ? active : 'border-gray-800 bg-gray-900 text-gray-700'
                  }`}
                >
                  <img
                    src={meta.logo}
                    alt=""
                    className={`max-h-4 max-w-4 object-contain ${synced ? '' : 'grayscale opacity-35'}`}
                  />
                </span>
              );
            })}
          </div>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-gray-500 hover:text-gray-200 hover:border-gray-700 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600/15 text-violet-300 border border-violet-600/20'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer: scan progress OR sync button */}
      <div className="px-4 py-4 border-t border-gray-800 space-y-3">
        {scanning ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Scanning…
              </span>
              <span className="text-gray-600 font-mono">{scanProgress.done}/{scanProgress.total}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
              <div className="h-1 bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <button
            onClick={sync}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors border border-gray-800 hover:border-gray-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync platforms
          </button>
        )}
        <p className="text-xs text-gray-600 leading-relaxed">
          {scanProgress.total > 0 && !scanning
            ? `${scanProgress.total} games indexed in SQLite.`
            : 'Data saved in local SQLite.'}
        </p>
      </div>
    </aside>
  );
}
