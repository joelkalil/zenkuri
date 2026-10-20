import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Boxes, Check, ChevronRight, FolderInput, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { GameCover } from './GameCover';
import { LibraryCard } from './LibraryCard';
import type { Game, GameCollection } from '../types/steam';

type Completion = { percent: number; unlocked: number; total: number };

interface CollectionsViewProps {
  games: Game[];
  completionMap: Map<number, Completion>;
  collections: GameCollection[];
  collectionOf: Record<string, number>;
  onCreate: (name: string, gameIds?: string[]) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onAssign: (appid: string, collectionId: number | null) => void;
  showGameRail?: boolean;
}

interface ContextMenuState {
  game: Game;
  x: number;
  y: number;
}

export function CollectionsView({ games, completionMap, collections, collectionOf, onCreate, onRename, onDelete, onAssign, showGameRail = true }: CollectionsViewProps) {
  const navigate = useNavigate();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [gameSearch, setGameSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  const byCollection = useMemo(() => {
    const map = new Map<number, Game[]>();
    for (const game of games) {
      const collectionId = collectionOf[String(game.appid)];
      if (!collectionId) continue;
      const members = map.get(collectionId) ?? [];
      members.push(game);
      map.set(collectionId, members);
    }
    return map;
  }, [games, collectionOf]);

  const visibleGames = useMemo(() => {
    const query = gameSearch.trim().toLocaleLowerCase();
    return query ? games.filter((game) => game.name.toLocaleLowerCase().includes(query)) : games;
  }, [games, gameSearch]);

  function averagePercent(list: Game[]): number {
    const percents = list.map((game) => completionMap.get(game.appid)?.percent).filter((percent): percent is number => percent !== undefined);
    return percents.length === 0 ? 0 : Math.round(percents.reduce((sum, percent) => sum + percent, 0) / percents.length);
  }

  function submitCreate() {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
  }

  function submitRename(id: number) {
    const name = editName.trim();
    if (name) onRename(id, name);
    setEditingId(null);
  }

  function openContextMenu(event: MouseEvent, game: Game) {
    event.preventDefault();
    const menuWidth = 240;
    const menuHeight = Math.min(420, 80 + collections.length * 34);
    setContextMenu({
      game,
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 12),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 12),
    });
  }

  const selectedCollection = collections.find((collection) => collection.id === selectedId);
  const selectedGames = selectedCollection ? byCollection.get(selectedCollection.id) ?? [] : [];

  return (
    <div className="flex min-h-0 flex-col gap-5 lg:flex-row">
      {showGameRail && <aside className="shrink-0 overflow-hidden rounded-xl border border-gray-800 bg-gray-900/65 lg:sticky lg:top-0 lg:h-[calc(100vh-3rem)] lg:w-60">
        <div className="border-b border-gray-800 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-600">Todos os jogos</p>
          <label className="relative block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
            <input value={gameSearch} onChange={(event) => setGameSearch(event.target.value)} placeholder="Filtrar jogos…"
              className="w-full rounded-lg border border-gray-800 bg-gray-950 py-1.5 pl-8 pr-2 text-xs text-gray-200 placeholder-gray-700 focus:border-violet-600 focus:outline-none" />
          </label>
        </div>
        <div className="max-h-48 overflow-y-auto p-1.5 lg:max-h-[calc(100vh-8rem)]">
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
      </aside>}

      <div className="min-w-0 flex-1">
        {selectedCollection ? (
          <section>
            <header className="mb-6 border-b border-gray-800 pb-4">
              <button onClick={() => setSelectedId(null)} className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-200">
                <ArrowLeft className="h-4 w-4" /> Voltar para coleções
              </button>
              <div className="flex flex-wrap items-center gap-3">
                {editingId === selectedCollection.id ? (
                  <div className="flex items-center gap-1.5">
                    <input value={editName} autoFocus onChange={(event) => setEditName(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') submitRename(selectedCollection.id); if (event.key === 'Escape') setEditingId(null); }}
                      className="w-64 rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-lg font-semibold text-gray-100 focus:border-violet-600 focus:outline-none" />
                    <button onClick={() => submitRename(selectedCollection.id)} aria-label="Salvar nome" className="grid h-8 w-8 place-items-center rounded-lg text-emerald-400 hover:bg-gray-800"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingId(null)} aria-label="Cancelar edição" className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-800"><X className="h-4 w-4" /></button>
                  </div>
                ) : <h2 className="heading-editorial text-xl font-semibold text-gray-100">{selectedCollection.name}</h2>}
                <span className="text-sm text-gray-500">{selectedGames.length} {selectedGames.length === 1 ? 'jogo' : 'jogos'}</span>
                <span className="flex-1" />
                {editingId !== selectedCollection.id && <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingId(selectedCollection.id); setEditName(selectedCollection.name); }} aria-label="Renomear coleção" className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-800 hover:text-gray-200"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { onDelete(selectedCollection.id); setSelectedId(null); }} aria-label="Excluir coleção" className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-red-900/30 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>}
              </div>
            </header>
            {selectedGames.length > 0 ? (
              <div className="library-grid">
                {selectedGames.map((game) => <div key={game.appid} onContextMenu={(event) => openContextMenu(event, game)}><LibraryCard game={game} completion={completionMap.get(game.appid)} /></div>)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-800 py-16 text-center"><Boxes className="mx-auto mb-3 h-8 w-8 text-gray-700" /><p className="text-sm text-gray-500">Nenhum jogo dos filtros atuais está nesta coleção.</p></div>
            )}
          </section>
        ) : (
          <div className="space-y-4">
            {collections.length === 0 && <p className="text-sm text-gray-500">Nenhuma coleção ainda. Crie a primeira abaixo ou clique com o botão direito em um jogo.</p>}
            <div className="collections-grid">
              <form className="collection-new" onSubmit={(event) => { event.preventDefault(); submitCreate(); }}>
                <span className="collection-new-mark mx-auto"><Plus className="h-5 w-5" aria-hidden="true" /></span>
                <label className="text-center text-sm font-semibold" htmlFor="new-collection-name">Nova coleção</label>
                <div className="flex gap-2">
                  <input id="new-collection-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nome da coleção…" className="field min-w-0 flex-1" />
                  <button type="submit" disabled={!newName.trim()} className="btn btn-primary h-9 px-3 disabled:opacity-40">Criar</button>
                </div>
              </form>
              {collections.map((collection) => {
                const members = byCollection.get(collection.id) ?? [];
                return (
                  <button key={collection.id} onClick={() => setSelectedId(collection.id)} className="collection-card">
                    <span className="flex w-full items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-semibold text-gray-100">{collection.name}</span>
                        <span className="mt-1 block text-xs text-gray-500">{members.length} {members.length === 1 ? 'jogo' : 'jogos'}{members.length > 0 ? ` · ${averagePercent(members)}% médio` : ''}</span>
                      </span>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                    </span>
                    <span className="collection-card-covers">
                      {Array.from({ length: 4 }).map((_, i) => members[i]
                        ? <GameCover key={members[i].appid} game={members[i]} portrait className="h-full w-full bg-gray-800" imgClassName="object-cover" />
                        : <span key={`empty-${i}`} className="grid place-items-center">{i === 0 && members.length === 0 ? <Boxes className="h-5 w-5 text-gray-600" aria-hidden="true" /> : null}</span>)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {contextMenu && (
        <div role="menu" aria-label={`Coleção de ${contextMenu.game.name}`} onClick={(event) => event.stopPropagation()}
          className="fixed z-50 w-60 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 p-1.5 shadow-2xl shadow-black/60"
          style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="border-b border-gray-800 px-2.5 py-2"><p className="truncate text-xs font-semibold text-gray-200">{contextMenu.game.name}</p><p className="mt-0.5 text-[11px] text-gray-600">Adicionar à coleção</p></div>
          <div className="max-h-72 overflow-y-auto py-1">
            {collections.map((collection) => {
              const current = collectionOf[String(contextMenu.game.appid)] === collection.id;
              return <button key={collection.id} role="menuitem" onClick={() => { onAssign(String(contextMenu.game.appid), collection.id); setContextMenu(null); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${current ? 'bg-violet-600/15 text-violet-300' : 'text-gray-300 hover:bg-gray-800'}`}>
                <FolderInput className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{collection.name}</span>{current && <Check className="h-3.5 w-3.5" />}
              </button>;
            })}
          </div>
          {collectionOf[String(contextMenu.game.appid)] && <button role="menuitem" onClick={() => { onAssign(String(contextMenu.game.appid), null); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg border-t border-gray-800 px-2.5 py-2 text-left text-xs text-red-400 hover:bg-red-900/25"><X className="h-3.5 w-3.5" /> Remover da coleção</button>}
        </div>
      )}
    </div>
  );
}
