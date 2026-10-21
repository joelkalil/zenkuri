import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { ArrowLeft, Check, ChevronRight, FolderInput, Pencil, Plus, Trash2, X } from 'lucide-react';
import { GameCover } from './GameCover';
import { LibraryCard } from './LibraryCard';
import { LibraryGameRail } from './LibraryGameRail';
import { AutoCollectionsSection } from './AutoCollectionsSection';
import { useAutoCollections } from '../hooks/useAutoCollections';
import type { Game, GameCollection } from '../types/steam';

type Completion = { percent: number; unlocked: number; total: number };
type CollectionsSection = 'mine' | 'franchises' | 'companies';

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
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [section, setSection] = useState<CollectionsSection>('mine');
  const auto = useAutoCollections();

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

  const manualView = (
    <div className="lib-collections">
      {showGameRail && <LibraryGameRail games={games} collections={collections} collectionOf={collectionOf} onAssign={onAssign} />}

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
                      className="w-64 field !h-9 !text-lg font-semibold" />
                    <button onClick={() => submitRename(selectedCollection.id)} aria-label="Salvar nome" className="icon-btn text-zk-complete"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingId(null)} aria-label="Cancelar edição" className="icon-btn"><X className="h-4 w-4" /></button>
                  </div>
                ) : <h2 className="font-display text-2xl font-bold text-gray-100">{selectedCollection.name}</h2>}
                <span className="text-sm text-gray-500">{selectedGames.length} {selectedGames.length === 1 ? 'jogo' : 'jogos'}</span>
                <span className="flex-1" />
                {editingId !== selectedCollection.id && <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingId(selectedCollection.id); setEditName(selectedCollection.name); }} aria-label="Renomear coleção" className="icon-btn"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { onDelete(selectedCollection.id); setSelectedId(null); }} aria-label="Excluir coleção" className="icon-btn hover:!text-zk-danger"><Trash2 className="h-4 w-4" /></button>
                </div>}
              </div>
            </header>
            {selectedGames.length > 0 ? (
              <div className="library-grid">
                {selectedGames.map((game) => <div key={game.appid} onContextMenu={(event) => openContextMenu(event, game)}><LibraryCard game={game} completion={completionMap.get(game.appid)} /></div>)}
              </div>
            ) : (
              <p className="py-12 text-sm text-gray-500">Nenhum jogo dos filtros atuais está nesta coleção.</p>
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
                        ? <GameCover key={members[i].appid} game={members[i]} portrait className="h-full w-full bg-gray-850" imgClassName="object-cover" />
                        : <span key={`empty-${i}`} className="grid place-items-center">{i === 0 && members.length === 0 ? <span className="font-display text-lg font-black text-gray-700" aria-hidden="true">全</span> : null}</span>)}
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
          className="lib-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="lib-menu-head"><p className="truncate text-xs font-semibold text-gray-100">{contextMenu.game.name}</p><p className="micro mt-0.5">Adicionar à coleção</p></div>
          <div className="max-h-72 overflow-y-auto py-1">
            {collections.map((collection) => {
              const current = collectionOf[String(contextMenu.game.appid)] === collection.id;
              return <button key={collection.id} role="menuitem" aria-current={current} onClick={() => { onAssign(String(contextMenu.game.appid), collection.id); setContextMenu(null); }}>
                <FolderInput className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{collection.name}</span>{current && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>;
            })}
          </div>
          {collectionOf[String(contextMenu.game.appid)] && <button role="menuitem" className="danger" onClick={() => { onAssign(String(contextMenu.game.appid), null); setContextMenu(null); }}><X className="h-3.5 w-3.5" aria-hidden="true" /> Remover da coleção</button>}
        </div>
      )}
    </div>
  );

  const sections: { key: CollectionsSection; label: string; count: number }[] = [
    { key: 'mine', label: 'Minhas', count: collections.length },
    { key: 'franchises', label: 'Franquias', count: auto.data.franchises.length },
    { key: 'companies', label: 'Empresas', count: auto.data.companies.length },
  ];

  return (
    <div className="space-y-4">
      <div className="subtabs border-b border-gray-800" role="group" aria-label="Tipo de coleção">
        {sections.map(({ key, label, count }) => (
          <button key={key} onClick={() => setSection(key)} className="subtab" aria-pressed={section === key}>
            {label}<span className="count">{count}</span>
          </button>
        ))}
      </div>
      {section === 'mine' && manualView}
      {section === 'franchises' && (
        <AutoCollectionsSection number="02" title="Franquias" kind="franchise" collections={auto.data.franchises}
          games={games} completionMap={completionMap} loading={auto.loading} error={auto.error} />
      )}
      {section === 'companies' && (
        <AutoCollectionsSection number="03" title="Empresas" kind="company" collections={auto.data.companies}
          games={games} completionMap={completionMap} loading={auto.loading} error={auto.error} />
      )}
    </div>
  );
}
