import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FolderInput, Search, X } from 'lucide-react';
import { GameCover } from './GameCover';
import { useT } from '../i18n';
import type { Game, GameCollection } from '../types/steam';

interface LibraryGameRailProps {
  games: Game[];
  collections: GameCollection[];
  collectionOf: Record<string, number>;
  onAssign: (appid: string, collectionId: number | null) => void;
}

interface ContextMenuState {
  game: Game;
  x: number;
  y: number;
}

/** Compact game list for organizing into collections (right-click opens the collection menu). */
export function LibraryGameRail({ games, collections, collectionOf, onAssign }: LibraryGameRailProps) {
  const t = useT('collections');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const visibleGames = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? games.filter((game) => game.name.toLocaleLowerCase().includes(query)) : games;
  }, [games, search]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', closeOnEscape); };
  }, [contextMenu]);

  function openContextMenu(event: MouseEvent, game: Game) {
    event.preventDefault();
    setContextMenu({
      game,
      x: Math.min(event.clientX, window.innerWidth - 252),
      y: Math.min(event.clientY, window.innerHeight - Math.min(432, 92 + collections.length * 34)),
    });
  }

  return (
    <>
      <aside className="lib-rail" aria-label={t('rail.label')}>
        <div className="lib-rail-head">
          <p className="micro mb-2">{t('rail.hint')}</p>
          <label className="search-pill"><Search size={14} aria-hidden="true" /><span className="sr-only">{t('rail.filterLabel')}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('rail.filterPlaceholder')} />
          </label>
        </div>
        <div className="lib-rail-list">
          {visibleGames.map((game) => {
            const collection = collections.find((item) => item.id === collectionOf[String(game.appid)]);
            return (
              <button key={game.appid} className="lib-rail-item" onClick={() => navigate(`/game/${game.appid}`)} onContextMenu={(event) => openContextMenu(event, game)}>
                <GameCover game={game} className="h-6 w-6 shrink-0 rounded-sm bg-gray-850" imgClassName="object-cover" />
                <span>{game.name}</span>
                {collection && <i className="lib-dot" title={collection.name} aria-label={t('rail.collectionOf', { name: collection.name })} />}
              </button>
            );
          })}
        </div>
      </aside>

      {contextMenu && <div role="menu" aria-label={t('menu.label', { name: contextMenu.game.name })} onClick={(event) => event.stopPropagation()}
        className="lib-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
        <div className="lib-menu-head"><p className="truncate text-xs font-semibold text-gray-100">{contextMenu.game.name}</p><p className="micro mt-0.5">{t('menu.add')}</p></div>
        <div className="max-h-72 overflow-y-auto py-1">{collections.map((collection) => {
          const current = collectionOf[String(contextMenu.game.appid)] === collection.id;
          return <button key={collection.id} role="menuitem" aria-current={current} onClick={() => { onAssign(String(contextMenu.game.appid), collection.id); setContextMenu(null); }}>
            <FolderInput className="h-3.5 w-3.5" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{collection.name}</span>{current && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>;
        })}</div>
        {collectionOf[String(contextMenu.game.appid)] && <button role="menuitem" className="danger" onClick={() => { onAssign(String(contextMenu.game.appid), null); setContextMenu(null); }}><X className="h-3.5 w-3.5" aria-hidden="true" /> {t('menu.remove')}</button>}
      </div>}
    </>
  );
}
