import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSteam } from '../context/SteamContext';
import { THEMES, useTheme } from '../context/ThemeContext';
import { PLATFORM_META } from '../lib/platforms';
import type { Platform } from '../types/steam';
import { GameCover } from './GameCover';

const PLATFORMS: Platform[] = ['steam', 'psn', 'retroachievements'];
const PLATFORM_NAME: Record<Platform, string> = {
  steam: 'Steam',
  psn: 'PlayStation Network',
  retroachievements: 'RetroAchievements',
};

interface ProfileMenuProps {
  /** chamado ao navegar por um link do menu (fecha popover/folha) */
  onNavigate: () => void;
}

/**
 * Conteúdo do menu de perfil, compartilhado entre o popover (desktop) e a
 * folha inferior (mobile): conta, Ajustes, Aparência, Plataformas, Recentes e
 * Sair.
 */
export function ProfileMenu({ onNavigate }: ProfileMenuProps) {
  const { user, logout } = useAuth();
  const { games, configuredPlatforms } = useSteam();
  const { theme, setTheme } = useTheme();
  const [recentOpen, setRecentOpen] = useState(false);

  const recent = useMemo(
    () => games
      .filter((game) => (game.playtime_2weeks ?? 0) > 0)
      .sort((a, b) => (b.playtime_2weeks ?? 0) - (a.playtime_2weeks ?? 0))
      .slice(0, 6),
    [games],
  );

  return (
    <>
      <div className="menu-section">
        <p className="truncate font-display text-base font-bold text-gray-100">{user?.displayName ?? 'Meu perfil'}</p>
        <p className="mt-0.5 text-xs text-gray-500">@{user?.username ?? 'local'}</p>
      </div>
      <div className="menu-list">
        <Link to="/settings" className="menu-item" onClick={onNavigate}>Ajustes</Link>
        <Link to="/settings?tab=connections" className="menu-item" onClick={onNavigate}>Conexões</Link>
      </div>
      <div className="menu-section" role="radiogroup" aria-label="Aparência">
        <p className="menu-label" aria-hidden="true">Aparência</p>
        {THEMES.map((item) => (
          <label key={item.id} className="radio-row">
            <input type="radio" name="theme" value={item.id} checked={theme === item.id} onChange={() => setTheme(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      <div className="menu-section">
        <p className="menu-label">Plataformas</p>
        <ul>
          {PLATFORMS.map((id) => {
            const connected = configuredPlatforms.includes(id);
            return (
              <li key={id} className="platform-row">
                <img src={PLATFORM_META[id].logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                <span className="min-w-0 flex-1 truncate">{PLATFORM_NAME[id]}</span>
                {connected ? (
                  <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="status-dot" data-on="true" aria-hidden="true" />conectado</span>
                ) : (
                  <Link to="/settings?tab=connections" onClick={onNavigate} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-100">
                    <span className="status-dot" aria-hidden="true" />não configurado
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="menu-list">
        <button type="button" className="menu-item justify-between" aria-expanded={recentOpen} aria-controls="recent-list" onClick={() => setRecentOpen(!recentOpen)}>
          Recentes
          <ChevronDown size={14} aria-hidden="true" className={recentOpen ? 'rotate-180' : ''} />
        </button>
        {recentOpen && (
          <div id="recent-list" className="pb-1">
            {recent.length === 0
              ? <p className="px-4 py-2 text-xs text-gray-500">Nenhum jogo nas últimas 2 semanas.</p>
              : recent.map((game) => (
                <Link key={game.appid} to={`/game/${game.appid}`} className="recent-item" onClick={onNavigate}>
                  <GameCover game={game} className="h-8 w-14 shrink-0 rounded-sm bg-gray-800" imgClassName="object-cover" />
                  <span className="min-w-0 flex-1 truncate">{game.name}</span>
                </Link>
              ))}
          </div>
        )}
      </div>
      <div className="menu-list">
        <button type="button" className="menu-item" data-tone="danger" onClick={logout}>Sair da conta</button>
      </div>
    </>
  );
}
