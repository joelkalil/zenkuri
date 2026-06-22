import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Library, ListOrdered, Moon, Settings, Sun } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useTheme } from '../context/ThemeContext';
import type { Platform } from '../types/steam';
import { PLATFORM_META } from '../lib/platforms';
import { Logo } from './Logo';
import { SyncRing } from './SyncRing';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/backlog', icon: ListOrdered, label: 'Backlog' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const platformOrder: Platform[] = ['steam', 'psn', 'retroachievements'];

export function Sidebar() {
  const { configuredPlatforms } = useSteam();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-gray-950/80 border-r border-gray-800/80 h-screen sticky top-0 backdrop-blur-sm">
      {/* Logo */}
      <div className="px-5 py-5">
        <Logo size={32} />
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600/20 text-violet-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/60'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Platforms */}
      <div className="mt-7 px-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600">Plataformas</p>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-600 hover:text-gray-300 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="space-y-0.5">
          {platformOrder.map((id) => {
            const connected = configuredPlatforms.includes(id);
            const meta = PLATFORM_META[id];
            return (
              <div key={id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <img src={meta.logo} alt="" className={`max-h-4 max-w-4 object-contain ${connected ? '' : 'grayscale opacity-40'}`} />
                </span>
                <span className={`flex-1 truncate text-[13px] font-medium ${connected ? 'text-gray-300' : 'text-gray-600'}`}>{meta.short}</span>
                <span
                  title={connected ? 'Conectado' : 'Não configurado'}
                  className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_6px_var(--color-emerald-500)]' : 'bg-gray-700'}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: sync ring + profile */}
      <div className="mt-auto px-4 py-4 space-y-3">
        <SyncRing />
        <div className="flex items-center gap-2.5 rounded-xl px-1 py-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
            Z
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-gray-200">Meu perfil</p>
            <p className="truncate text-xs text-gray-600">Conta local</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
