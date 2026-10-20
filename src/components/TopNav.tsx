import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, LayoutDashboard, Library, LogOut, Medal, ScrollText, Settings, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSteam } from '../context/SteamContext';
import { THEMES, useTheme } from '../context/ThemeContext';
import type { ThemeMode } from '../context/ThemeContext';
import { PLATFORM_META } from '../lib/platforms';
import type { Platform } from '../types/steam';
import { useUserLevel } from '../hooks/useUserLevel';
import { Logo } from './Logo';
import { LevelChip } from './LevelBadge';

/*
 * Top bar no estilo do launcher: marca + voltar/avançar à esquerda, destinos
 * em pílula, nível e perfil à direita. A sincronização mora na barra de status
 * inferior (StatusBar), sempre visível.
 */
const links = [
  { to: '/', icon: LayoutDashboard, label: 'Painel' },
  { to: '/library', icon: Library, label: 'Biblioteca' },
  { to: '/rankings', icon: Medal, label: 'Rankings' },
  { to: '/sagas', icon: ScrollText, label: 'Sagas' },
  { to: '/plano', icon: CalendarRange, label: 'Plano' },
  { to: '/hall', icon: Trophy, label: 'Hall da Platina' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
] as const;
const platforms: Platform[] = ['steam', 'psn', 'retroachievements'];

export function TopNav() {
  const { user, logout } = useAuth();
  const { configuredPlatforms } = useSteam();
  const { theme, setTheme } = useTheme();
  const { level } = useUserLevel();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;

  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [location.pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setProfileOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  return (
    <header className="topbar no-print">
        <div className="topbar-start">
          <NavLink to="/" aria-label="Zenkuri — Painel" className="brand-link"><Logo size={30} withWordmark={false} /></NavLink>
          <div className="history-nav">
            <button className="icon-btn" aria-label="Voltar" title="Voltar" disabled={historyIndex === 0} onClick={() => navigate(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
            <button className="icon-btn" aria-label="Avançar" title="Avançar" onClick={() => navigate(1)}><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
        </div>
        <nav ref={navRef} className="topbar-nav" aria-label="Navegação principal">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className="topbar-link">
              <Icon aria-hidden="true" size={16} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="topbar-actions">
          {level && <LevelChip level={level} />}
          <div ref={profileRef} className="profile-control" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false);
          }}>
            <button ref={triggerRef} className="profile-trigger" aria-label="Abrir perfil e preferências" aria-expanded={profileOpen} aria-controls="profile-panel" onClick={() => setProfileOpen(!profileOpen)}>
              <span className="profile-avatar">{(user?.displayName ?? 'Z').charAt(0).toUpperCase()}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {profileOpen && <div id="profile-panel" className="popover profile-panel">
              <div className="mb-5">
                <p className="truncate font-semibold text-gray-100">{user?.displayName ?? 'Meu perfil'}</p>
                <p className="mt-1 text-xs text-gray-500">@{user?.username ?? 'local'}</p>
              </div>
              <label className="block text-xs font-medium text-gray-400" htmlFor="profile-theme">Aparência</label>
              <select id="profile-theme" value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)} className="mt-2 w-full rounded-lg border border-gray-800 bg-gray-950 p-2.5 text-sm text-gray-200">
                {THEMES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <p className="mb-3 mt-5 text-xs font-medium text-gray-400">Plataformas</p>
              <ul className="space-y-3">
                {platforms.map((id) => {
                  const connected = configuredPlatforms.includes(id);
                  return <li key={id} className="flex items-center gap-2 text-xs">
                    <img src={PLATFORM_META[id].logo} alt="" className="h-4 w-4 object-contain" />
                    <span className="flex-1 text-gray-300">{PLATFORM_META[id].short}</span>
                    <span className={connected ? 'text-emerald-400' : 'text-gray-500'}>{connected ? 'Conectado' : 'Não configurado'}</span>
                  </li>;
                })}
              </ul>
              <button onClick={logout} className="mt-5 flex min-h-10 w-full items-center gap-2 border-t border-gray-800 pt-3 text-sm text-gray-400 hover:text-red-400"><LogOut size={16} />Sair da conta</button>
            </div>}
          </div>
        </div>
    </header>
  );
}
