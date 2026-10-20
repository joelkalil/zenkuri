import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, History, RefreshCw } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { PLATFORM_META } from '../lib/platforms';
import type { Platform } from '../types/steam';
import { GameCover } from './GameCover';

const PLATFORMS: Platform[] = ['steam', 'psn', 'retroachievements'];

function relativeTime(ts: number | null): string {
  if (!ts) return 'nunca';
  const min = Math.floor((Date.now() - ts) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

/**
 * Barra de status inferior, como a do launcher: "Recentes" à esquerda (jogos
 * das últimas duas semanas), sincronização ao centro e o estado de cada
 * plataforma à direita.
 */
export function StatusBar() {
  const { games, sync, scanning, lastSyncAt, error, configuredPlatforms } = useSteam();
  const [recentOpen, setRecentOpen] = useState(false);
  const recentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  const recent = useMemo(
    () => games
      .filter((game) => (game.playtime_2weeks ?? 0) > 0)
      .sort((a, b) => (b.playtime_2weeks ?? 0) - (a.playtime_2weeks ?? 0))
      .slice(0, 6),
    [games],
  );

  useEffect(() => { setRecentOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!recentOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !recentRef.current?.contains(event.target)) setRecentOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setRecentOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [recentOpen]);

  const syncLabel = scanning ? 'Sincronizando…' : error ? 'Falha na sincronização' : lastSyncAt ? `Sincronizado ${relativeTime(lastSyncAt)}` : 'Sincronizar agora';

  return (
    <footer className="statusbar no-print">
      <div ref={recentRef} className="statusbar-start">
        <button ref={triggerRef} className="statusbar-btn" aria-expanded={recentOpen} aria-controls="recent-panel" onClick={() => setRecentOpen(!recentOpen)}>
          <History size={15} aria-hidden="true" />Recentes<ChevronDown size={13} aria-hidden="true" />
        </button>
        {recentOpen && <div id="recent-panel" className="popover recent-panel">
          <h2>Jogados nas últimas 2 semanas</h2>
          {recent.length === 0
            ? <p className="px-2.5 pb-2 text-xs text-gray-500">Nenhum jogo recente.</p>
            : recent.map((game) => (
              <Link key={game.appid} to={`/game/${game.appid}`} className="recent-item">
                <GameCover game={game} className="h-8 w-14 shrink-0 rounded-md bg-gray-800" imgClassName="object-cover" />
                <span className="min-w-0 flex-1 truncate">{game.name}</span>
              </Link>
            ))}
        </div>}
      </div>
      <button className="statusbar-btn statusbar-sync" onClick={sync} disabled={scanning} title={error ? `Falha na sincronização — ${error}` : 'Sincronizar todas as plataformas'}>
        <RefreshCw size={14} aria-hidden="true" className={`${scanning ? 'animate-spin' : ''} ${error ? 'text-red-400' : 'text-emerald-400'}`} />
        <span aria-live="polite">{syncLabel}</span>
      </button>
      <ul className="statusbar-end" aria-label="Plataformas">
        {PLATFORMS.map((id) => {
          const connected = configuredPlatforms.includes(id);
          return <li key={id} className="status-platform" title={`${PLATFORM_META[id].short}: ${connected ? 'conectado' : 'não configurado'}`}>
            <span className="status-dot" data-on={connected} aria-hidden="true" />
            <img src={PLATFORM_META[id].logo} alt="" className="h-3.5 w-3.5 object-contain" />
            <span>{PLATFORM_META[id].short}</span>
            <span className="sr-only">{connected ? 'conectado' : 'não configurado'}</span>
          </li>;
        })}
      </ul>
    </footer>
  );
}
