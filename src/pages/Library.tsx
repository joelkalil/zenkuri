import { useEffect, useRef, useState, useMemo } from 'react';
import type { ElementType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Boxes, CheckCircle2, ChevronLeft, ChevronRight, Circle, LayoutGrid, List, Pin, Search, SlidersHorizontal, Trophy, X, XCircle } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { LibraryCard } from '../components/LibraryCard';
import { LibraryRow } from '../components/LibraryRow';
import { SkeletonCard } from '../components/SkeletonCard';
import { CollectionsView } from '../components/CollectionsView';
import { LibraryGameRail } from '../components/LibraryGameRail';
import type { Platform } from '../types/steam';
import { hasPsnPlatinum, PLATFORM_META } from '../lib/platforms';

type FilterTab = 'all' | 'inprogress' | 'completed' | 'platinum' | 'notstarted' | 'pinned' | 'dropped';
type SortMode = 'completion' | 'playtime' | 'name' | 'backlog';
type PlatformTab = 'all' | Platform;

const TABS: { key: FilterTab; label: string; icon?: ElementType; color?: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'inprogress', label: 'Em progresso', icon: Activity, color: 'text-sky-400' },
  { key: 'completed', label: '100%', icon: CheckCircle2, color: 'text-emerald-400' },
  { key: 'platinum', label: 'Platina', icon: Trophy, color: 'text-amber-400' },
  { key: 'notstarted', label: 'Não iniciados', icon: Circle, color: 'text-gray-400' },
  { key: 'pinned', label: 'Fixados', icon: Pin, color: 'text-violet-400' },
  { key: 'dropped', label: 'Abandonados', icon: XCircle, color: 'text-red-400' },
];

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'name', label: 'Alfabética (A–Z)' },
  { key: 'completion', label: 'Conclusão (maior primeiro)' },
  { key: 'playtime', label: 'Tempo jogado' },
  { key: 'backlog', label: 'Ordem do backlog' },
];

const PLATFORM_TABS: { key: PlatformTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'steam', label: 'Steam' },
  { key: 'psn', label: 'PlayStation' },
  { key: 'retroachievements', label: 'RetroAchievements' },
];

const PAGE_SIZE = 24;

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { gamesWithStats, loading, error, completionMap } = useSteam();
  const { db, toggleBacklog, togglePinned, createCollection, renameCollection, deleteCollection, setCollection } = useLocalDb();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>(() => (searchParams.get('status') as FilterTab) || 'all');
  const [platform, setPlatform] = useState<PlatformTab>(() => (searchParams.get('platform') as PlatformTab) || 'all');
  const [sort, setSort] = useState<SortMode>('name');
  const [view, setView] = useState<'grid' | 'list' | 'collections'>(() => (searchParams.get('view') === 'collections' ? 'collections' : 'grid'));
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search, filter, platform, sort]);

  function setFilterAndUrl(nextFilter: FilterTab) {
    setFilter(nextFilter);
    const next = new URLSearchParams(searchParams);
    if (nextFilter === 'all') next.delete('status');
    else next.set('status', nextFilter);
    setSearchParams(next, { replace: true });
  }

  function setViewAndUrl(nextView: 'grid' | 'list' | 'collections') {
    setView(nextView);
    const next = new URLSearchParams(searchParams);
    if (nextView === 'collections') next.set('view', 'collections');
    else next.delete('view');
    setSearchParams(next, { replace: true });
  }

  function setPlatformAndUrl(nextPlatform: PlatformTab) {
    setPlatform(nextPlatform);
    const next = new URLSearchParams(searchParams);
    if (nextPlatform === 'all') next.delete('platform');
    else next.set('platform', nextPlatform);
    setSearchParams(next, { replace: true });
  }

  const platformCounts = useMemo(() => {
    const counts: Record<PlatformTab, number> = { all: gamesWithStats.length, steam: 0, psn: 0, retroachievements: 0 };
    for (const game of gamesWithStats) {
      if (game.platform) counts[game.platform] += 1;
    }
    return counts;
  }, [gamesWithStats]);

  const filtered = useMemo(() => {
    let list = [...gamesWithStats];

    if (platform !== 'all') {
      list = list.filter((g) => g.platform === platform);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }

    if (filter === 'pinned') {
      list = list.filter((g) => db.pinned.includes(String(g.appid)));
    } else if (filter === 'dropped') {
      list = list.filter((g) => db.dropped.includes(String(g.appid)));
    } else if (filter === 'platinum') {
      list = list.filter((g) => hasPsnPlatinum(g) && !db.dropped.includes(String(g.appid)));
    } else if (filter === 'completed') {
      list = list.filter((g) => completionMap.get(g.appid)?.percent === 100 && !db.dropped.includes(String(g.appid)));
    } else if (filter === 'inprogress') {
      list = list.filter((g) => { const c = completionMap.get(g.appid); return c && c.percent > 0 && c.percent < 100 && !db.dropped.includes(String(g.appid)); });
    } else if (filter === 'notstarted') {
      list = list.filter((g) => { const c = completionMap.get(g.appid); return (!c || c.percent === 0) && !db.dropped.includes(String(g.appid)); });
    }

    return list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'playtime') return b.playtime_forever - a.playtime_forever;
      if (sort === 'backlog') {
        const ai = db.backlog.indexOf(String(a.appid)), bi = db.backlog.indexOf(String(b.appid));
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return (completionMap.get(b.appid)?.percent ?? -1) - (completionMap.get(a.appid)?.percent ?? -1);
    });
  }, [gamesWithStats, completionMap, db.pinned, db.dropped, db.backlog, search, filter, platform, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilters = (platform !== 'all' ? 1 : 0) + (sort !== 'name' ? 1 : 0);

  function clearAll() {
    setSearch('');
    setFilter('all');
    setPlatform('all');
    setSort('name');
    setSearchParams(view === 'collections' ? { view: 'collections' } : {}, { replace: true });
  }

  return (
    <div className="library-page">
      <h1 className="sr-only">Biblioteca</h1>
      <div className="library-toolbar">
        <div className="subtabs" role="group" aria-label="Filtrar por status">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilterAndUrl(key)} className="subtab" aria-pressed={filter === key}>{label}</button>
          ))}
        </div>
        <div className="library-tools">
          <label className="search-pill"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar na biblioteca</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na biblioteca" />
          </label>
          <div className="segmented" role="group" aria-label="Visualização da biblioteca">
            {([{ key: 'grid', label: 'Grade', icon: LayoutGrid }, { key: 'list', label: 'Lista', icon: List }, { key: 'collections', label: 'Coleções', icon: Boxes }] as const).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setViewAndUrl(key)} aria-pressed={view === key} aria-label={label} title={label}>
                <Icon size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
          <FilterSortMenu
            sort={sort} onSort={setSort}
            platform={platform} onPlatform={setPlatformAndUrl}
            counts={platformCounts} activeCount={activeFilters}
            onClear={() => { setSort('name'); setPlatformAndUrl('all'); }}
          />
        </div>
      </div>

      <div className="library-summary">
        <span>{filtered.length === gamesWithStats.length ? `${gamesWithStats.length} jogos` : `${filtered.length} de ${gamesWithStats.length} jogos`}</span>
        {platform !== 'all' && <span className="active-filter">
          <img src={PLATFORM_META[platform].logo} alt="" />{PLATFORM_TABS.find((item) => item.key === platform)?.label}
          <button onClick={() => setPlatformAndUrl('all')} aria-label="Remover filtro de plataforma"><X size={12} /></button>
        </span>}
        {sort !== 'name' && <span className="active-filter">
          {SORTS.find((item) => item.key === sort)?.label}
          <button onClick={() => setSort('name')} aria-label="Voltar à ordem alfabética"><X size={12} /></button>
        </span>}
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-800/30 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>}

      {view !== 'collections' && <details className="library-organizer">
        <summary>Organizar jogos em coleções</summary>
        <LibraryGameRail games={filtered} collections={db.collections} collectionOf={db.collectionOf} onAssign={setCollection} />
      </details>}
      <div className="min-w-0">

      {loading && filtered.length === 0 ? (
        <div className="library-grid">
          {Array.from({ length: 14 }).map((_, i) => <SkeletonCard key={i} portrait />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="gallery-empty"><Search size={28} aria-hidden="true" /><p className="text-lg font-medium text-gray-200">Nenhum jogo corresponde a este filtro.</p><p>Tente outro nome, plataforma ou status.</p><button className="btn btn-secondary" onClick={clearAll}>Limpar filtros</button></div>
      ) : view === 'collections' ? (
        <CollectionsView
          games={filtered} completionMap={completionMap}
          collections={db.collections} collectionOf={db.collectionOf}
          onCreate={createCollection} onRename={renameCollection}
          onDelete={deleteCollection} onAssign={setCollection}
          showGameRail={false}
        />
      ) : view === 'list' ? (
        <div className="library-list">
          {pageItems.map((g) => (
            <LibraryRow key={g.appid} game={g} completion={completionMap.get(g.appid) ?? null}
              isPinned={db.pinned.includes(String(g.appid))} inBacklog={db.backlog.includes(String(g.appid))}
              isDropped={db.dropped.includes(String(g.appid))}
              onToggleBacklog={toggleBacklog} onTogglePinned={togglePinned} />
          ))}
        </div>
      ) : (
        <div className="library-grid">
          {pageItems.map((g) => (
            <LibraryCard key={g.appid} game={g} completion={completionMap.get(g.appid) ?? null}
              isPinned={db.pinned.includes(String(g.appid))} inBacklog={db.backlog.includes(String(g.appid))}
              isDropped={db.dropped.includes(String(g.appid))}
              onToggleBacklog={toggleBacklog} onTogglePinned={togglePinned} />
          ))}
        </div>
      )}

      {view !== 'collections' && filtered.length > PAGE_SIZE && (
        <nav className="pager" aria-label="Paginação">
          <button aria-label="Página anterior" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="mx-auto h-4 w-4" />
          </button>
          {pageNumbers(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`}>…</span>
            ) : (
              <button key={p} aria-label={`Página ${p}`} aria-current={p === page ? 'page' : undefined} onClick={() => setPage(p as number)}>{p}</button>
            ),
          )}
          <button aria-label="Próxima página" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="mx-auto h-4 w-4" />
          </button>
        </nav>
      )}
      </div>
    </div>
  );
}

/** Botão "Filtrar e ordenar" com painel recolhível — ordenação e plataforma. */
function FilterSortMenu({ sort, onSort, platform, onPlatform, counts, activeCount, onClear }: {
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  platform: PlatformTab;
  onPlatform: (platform: PlatformTab) => void;
  counts: Record<PlatformTab, number>;
  activeCount: number;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !wrapRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="tool-wrap">
      <button ref={triggerRef} className="tool-btn" aria-expanded={open} aria-controls="library-filter-panel" onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={16} aria-hidden="true" /><span className="tool-btn-label">Filtrar e ordenar</span>
        {activeCount > 0 && <span className="tool-badge" aria-label={`${activeCount} ajustes ativos`}>{activeCount}</span>}
      </button>
      {open && <div id="library-filter-panel" className="popover filter-panel" role="dialog" aria-label="Filtrar e ordenar">
        <header>
          <h2>Filtrar e ordenar</h2>
          <button className="link-btn" onClick={onClear} disabled={activeCount === 0}>Limpar tudo</button>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18} /></button>
        </header>
        <fieldset>
          <legend>Ordenar</legend>
          {SORTS.map((item) => (
            <label key={item.key} className="filter-option">
              <input type="radio" name="library-sort" checked={sort === item.key} onChange={() => onSort(item.key)} />
              {item.label}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Plataforma</legend>
          {PLATFORM_TABS.map((item) => (
            <label key={item.key} className="filter-option">
              <input type="radio" name="library-platform" checked={platform === item.key} onChange={() => onPlatform(item.key)} />
              {item.key !== 'all' && <img src={PLATFORM_META[item.key].logo} alt="" />}
              {item.label}<small>{counts[item.key]}</small>
            </label>
          ))}
        </fieldset>
      </div>}
    </div>
  );
}

/** Compact page list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 12 */
function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}
