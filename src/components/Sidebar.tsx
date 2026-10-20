import { NavLink } from 'react-router-dom';
import { CalendarRange, ChevronLeft, ChevronRight, LayoutDashboard, Library, LogOut, Medal, Palette, ScrollText, Settings, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useSteam } from '../context/SteamContext';
import { useAuth } from '../context/AuthContext';
import { THEMES, useTheme } from '../context/ThemeContext';
import type { ThemeMode } from '../context/ThemeContext';
import type { Platform } from '../types/steam';
import { PLATFORM_META } from '../lib/platforms';
import { Logo } from './Logo';
import { SyncRing } from './SyncRing';
import { LevelBadge } from './LevelBadge';
import { useUserLevel } from '../hooks/useUserLevel';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Painel' },
  { to: '/library', icon: Library, label: 'Biblioteca' },
  { to: '/rankings', icon: Medal, label: 'Rankings' },
  { to: '/sagas', icon: ScrollText, label: 'Sagas' },
  { to: '/plano', icon: CalendarRange, label: 'Plano' },
  { to: '/hall', icon: Trophy, label: 'Hall da Platina' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
];

const platformOrder: Platform[] = ['steam', 'psn', 'retroachievements'];

/*
  Trilho recolhido: todo item (nav, plataforma, tema, sync, nível, avatar) ocupa
  o mesmo quadrado de 40px centralizado, e todo ícone mede 18px. É o que mantém
  a coluna alinhada — sem isso cada bloco herdava um padding próprio.
*/
const RAIL_SLOT = 'mx-auto h-10 w-10 shrink-0 justify-center';
const ICON = 'h-[18px] w-[18px] shrink-0';

export function Sidebar() {
  const { configuredPlatforms } = useSteam();
  const { user, logout } = useAuth();
  const { level } = useUserLevel();
  const { theme, setTheme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('zenkuri.sidebar.collapsed') === 'true');

  function toggleCollapsed() {
    setCollapsed((current) => {
      localStorage.setItem('zenkuri.sidebar.collapsed', String(!current));
      return !current;
    });
  }

  return (
    <aside className={`relative hidden md:flex flex-col shrink-0 bg-gray-950 border-r border-gray-800/80 h-screen sticky top-0 transition-[width] duration-200 ${collapsed ? 'w-20' : 'w-60'}`}>
      <button onClick={toggleCollapsed} title={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        className="absolute -right-3 top-7 z-10 grid h-6 w-6 place-items-center rounded-full border border-gray-800 bg-gray-900 text-gray-500 shadow-md transition-colors hover:border-gray-700 hover:text-gray-200">
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
      {/* Logo */}
      {/* Expandida, a marca começa na mesma coluna dos ícones do nav (12px do
          container + 12px do item), e não numa margem própria. */}
      <div className={`py-5 ${collapsed ? 'flex justify-center px-3' : 'px-6'}`}>
        <Logo size={40} withWordmark={false} />
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-xl text-sm font-medium transition-colors ${
                collapsed ? RAIL_SLOT : 'gap-3 px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-violet-600/15 text-violet-300 ring-1 ring-inset ring-violet-500/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/60'
              }`
            }
          >
            <Icon className={ICON} />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Platforms */}
      <div className="mt-7 px-3">
        {/* Recolhida, a legenda "Plataformas" some — o filete assume o papel de
            separar as plataformas (informativas) dos links de navegação. */}
        {collapsed && <div className="mx-auto mb-3 h-px w-6 bg-gray-800" />}
        <div className={`mb-2 flex items-center ${collapsed ? 'justify-center' : 'justify-between px-3'}`}>
          {!collapsed && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Plataformas</p>}
          {collapsed ? (
            <button onClick={toggleTheme} aria-label="Trocar tema visual"
              title={`Tema: ${THEMES.find((item) => item.id === theme)?.label}. Clique para trocar.`}
              className={`flex items-center rounded-xl text-gray-500 transition-colors hover:bg-gray-800/60 hover:text-gray-200 ${RAIL_SLOT}`}>
              <Palette className={ICON} />
            </button>
          ) : (
            <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)} aria-label="Tema visual"
              className="max-w-28 cursor-pointer rounded-md border border-gray-800 bg-gray-900 px-1.5 py-1 text-[10px] font-semibold text-gray-400 hover:border-gray-700 focus:border-violet-600">
              {THEMES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          )}
        </div>
        <ul className={collapsed ? 'space-y-1' : 'space-y-0.5'}>
          {platformOrder.map((id) => {
            const connected = configuredPlatforms.includes(id);
            const meta = PLATFORM_META[id];
            const status = connected ? 'Conectado' : 'Não configurado';
            return (
              <li key={id} title={`${meta.label} — ${status}`}
                className={`flex items-center rounded-xl ${collapsed ? RAIL_SLOT : 'gap-3 px-3 py-1.5'}`}>
                {/* Steam e PSN são quadrados; o RA é 1.82:1. Limitar os três pela
                    largura deixaria o RA com metade da massa visual dos outros, então
                    a altura é que manda (18px) e a largura corre até 24px, transbordando
                    de leve a caixa. Assim as três marcas têm área óptica equivalente. */}
                <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                  <img src={meta.logo} alt="" className={`h-[18px] w-auto max-w-[24px] object-contain ${connected ? '' : 'grayscale opacity-40'}`} />
                  {collapsed && <span
                    className={`absolute -bottom-0.5 -right-1 h-1.5 w-1.5 rounded-full ring-2 ring-gray-950 ${connected ? 'bg-emerald-500' : 'bg-gray-700'}`}
                  />}
                </span>
                {!collapsed && <span className={`flex-1 truncate text-[13px] font-medium ${connected ? 'text-gray-200' : 'text-gray-400'}`}>{meta.short}</span>}
                {!collapsed && <span
                  className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_6px_var(--color-emerald-500)]' : 'bg-gray-700'}`}
                />}
                {/* O ponto verde é cor pura: o estado precisa existir em texto também. */}
                <span className="sr-only">{status}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer: sync ring + profile */}
      <div className={`mt-auto px-3 py-4 ${collapsed ? 'space-y-1' : 'space-y-3'}`}>
        <SyncRing compact={collapsed} />
        {collapsed && level && <LevelBadge level={level} compact />}
        <div className={`flex items-center rounded-xl ${collapsed ? RAIL_SLOT : 'gap-2.5 px-3 py-2'}`}>
          <span
            title={`@${user?.username ?? 'local'}`}
            className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white ${collapsed ? 'h-8 w-8' : 'h-9 w-9'}`}
          >
            {(user?.displayName ?? 'Z').charAt(0).toUpperCase()}
          </span>
          {!collapsed && <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-gray-200">{user?.displayName ?? 'Meu perfil'}</p>
            {level
              ? <div className="mt-1"><LevelBadge level={level} /></div>
              : <p className="truncate text-xs text-gray-400">@{user?.username ?? 'local'}</p>}
          </div>}
          {!collapsed && <button
            onClick={logout}
            title="Sair"
            aria-label="Sair"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200"
          >
            <LogOut className={ICON} />
          </button>}
        </div>
        {/* Recolhida, sair só era possível expandindo antes — o trilho ganha o botão. */}
        {collapsed && <button
          onClick={logout}
          title="Sair"
          aria-label="Sair"
          className={`flex items-center rounded-xl text-gray-500 transition-colors hover:bg-gray-800/60 hover:text-gray-200 ${RAIL_SLOT}`}
        >
          <LogOut className={ICON} />
        </button>}
      </div>
    </aside>
  );
}
