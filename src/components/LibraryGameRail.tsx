import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FolderInput, Search, X } from 'lucide-react';
import { GameCover } from './GameCover';
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

export function LibraryGameRail({ games, collections, collectionOf, onAssign }: LibraryGameRailProps) {
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
      <aside className="shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-gray-900/65 xl:sticky xl:top-0 xl:h-[calc(100vh-3rem)] xl:w-64">
        <div className="border-b border-gray-800 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-600">Todos os jogos</p>
          <label className="relative block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar jogos…"
              className="w-full rounded-lg border border-gray-800 bg-gray-950 py-1.5 pl-8 pr-2 text-xs text-gray-200 placeholder-gray-700 focus:border-violet-600 focus:outline-none" />
          </label>
        </div>
        <div className="max-h-48 overflow-y-auto p-1.5 xl:max-h-[calc(100vh-8rem)]">
          {visibleGames.map((game) => {
            const collection = collections.find((item) => item.id === collectionOf[String(game.appid)]);
            return (
              <button key={game.appid} onClick={() => navigate(`/game/${game.appid}`)} onContextMenu={(event) => openContextMenu(event, game)}
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-gray-800 focus-visible:bg-gray-800">
                <GameCover game={game} className="h-6 w-6 shrink-0 rounded-sm bg-gray-800" imgClassName="object-cover" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-400 group-hover:text-gray-100">{game.name}</span>
                {collection && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" title={collection.name} />}
              </button>
            );
          })}
        </div>
      </aside>

      {contextMenu && <div role="menu" aria-label={`Coleção de ${contextMenu.game.name}`} onClick={(event) => event.stopPropagation()}
        className="fixed z-50 w-60 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 p-1.5 shadow-2xl shadow-black/60" style={{ left: contextMenu.x, top: contextMenu.y }}>
        <div className="border-b border-gray-800 px-2.5 py-2"><p className="truncate text-xs font-semibold text-gray-200">{contextMenu.game.name}</p><p className="mt-0.5 text-[11px] text-gray-600">Adicionar à coleção</p></div>
        <div className="max-h-72 overflow-y-auto py-1">{collections.map((collection) => {
          const current = collectionOf[String(contextMenu.game.appid)] === collection.id;
          return <button key={collection.id} role="menuitem" onClick={() => { onAssign(String(contextMenu.game.appid), collection.id); setContextMenu(null); }}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${current ? 'bg-violet-600/15 text-violet-300' : 'text-gray-300 hover:bg-gray-800'}`}>
            <FolderInput className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">{collection.name}</span>{current && <Check className="h-3.5 w-3.5" />}
          </button>;
        })}</div>
        {collectionOf[String(contextMenu.game.appid)] && <button role="menuitem" onClick={() => { onAssign(String(contextMenu.game.appid), null); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg border-t border-gray-800 px-2.5 py-2 text-left text-xs text-red-400 hover:bg-red-900/25"><X className="h-3.5 w-3.5" /> Remover da coleção</button>}
      </div>}
    </>
  );
}
