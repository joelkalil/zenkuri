import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { findScrollParent, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { LibraryCard } from '../components/LibraryCard';
import { LibraryRow } from '../components/LibraryRow';
import { SkeletonCard } from '../components/SkeletonCard';
import { CollectionsView } from '../components/CollectionsView';
import type { Game, Platform } from '../types/steam';
import { hasPsnPlatinum, PLATFORM_META } from '../lib/platforms';
import '../styles/biblioteca.css';

type FilterTab = 'all' | 'inprogress' | 'completed' | 'platinum' | 'notstarted' | 'pinned' | 'dropped';
type SortMode = 'completion' | 'playtime' | 'name' | 'backlog';
type PlatformTab = 'all' | Platform;
type LibraryLayout = 'list' | 'grid';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'inprogress', label: 'Em progresso' },
  { key: 'completed', label: '100%' },
  { key: 'platinum', label: 'Platinas' },
  { key: 'notstarted', label: 'Não iniciados' },
  { key: 'pinned', label: 'Fixados' },
  { key: 'dropped', label: 'Abandonados' },
];

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'name', label: 'Alfabética (A–Z)' },
  { key: 'completion', label: 'Conclusão (maior primeiro)' },
  { key: 'playtime', label: 'Tempo jogado' },
  { key: 'backlog', label: 'Ordem da fila' },
];

const PLATFORM_TABS: { key: PlatformTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'steam', label: 'Steam' },
  { key: 'psn', label: 'PlayStation' },
  { key: 'retroachievements', label: 'RetroAchievements' },
];

const BATCH_SIZE = 48;
const STORAGE_PREFIX = 'zk-lib-visible:';

interface SavedView { visible: number; scrollY: number }

function readSavedView(key: string): SavedView | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { visible, scrollY } = parsed as Partial<SavedView>;
    if (typeof visible !== 'number' || typeof scrollY !== 'number') return null;
    return { visible: Math.max(BATCH_SIZE, visible), scrollY };
  } catch {
    return null;
  }
}

function writeSavedView(key: string, view: SavedView) {
  try {
    sessionStorage.setItem(key, JSON.stringify(view));
  } catch {
    /* armazenamento indisponível: segue sem restauração */
  }
}

const numberFormat = new Intl.NumberFormat('pt-BR');

function parseFilter(value: string | null): FilterTab {
  return TABS.find((tab) => tab.key === value)?.key ?? 'all';
}

function parsePlatform(value: string | null): PlatformTab {
  return PLATFORM_TABS.find((tab) => tab.key === value)?.key ?? 'all';
}

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { gamesWithStats, loading, error, completionMap } = useSteam();
  const { db, toggleBacklog, togglePinned, createCollection, renameCollection, deleteCollection, setCollection } = useLocalDb();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('name');
  const storageKey = STORAGE_PREFIX + searchParams.toString();
  const [restored] = useState(() => readSavedView(storageKey));
  const [visibleCount, setVisibleCount] = useState(restored?.visible ?? BATCH_SIZE);
  const pendingScrollRef = useRef<number | null>(restored?.scrollY ?? null);
  const listTopRef = useRef<HTMLDivElement>(null);

  /* filtro, plataforma, visão e layout vêm da URL: o subnav (Jogos/Coleções) muda a rota sem remontar a página */
  const filter = parseFilter(searchParams.get('status'));
  const platform = parsePlatform(searchParams.get('platform'));
  const isCollections = searchParams.get('view') === 'collections';
  const layout: LibraryLayout = searchParams.get('layout') === 'grid' ? 'grid' : 'list';

  /* qualquer mudança de busca, filtro, plataforma, ordem ou layout volta ao primeiro lote (sem rodar na montagem) */
  const resetKey = `${search}|${filter}|${platform}|${sort}|${layout}`;
  const lastResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    setVisibleCount(BATCH_SIZE);
    if (listTopRef.current && listTopRef.current.getBoundingClientRect().top < 0) {
      listTopRef.current.scrollIntoView({ block: 'start' });
    }
  }, [resetKey]);

  /* guarda o scroll para voltar ao mesmo ponto depois de abrir um jogo.
     useLayoutEffect: o cleanup roda no commit, antes de o scroll ser zerado pela página seguinte */
  useLayoutEffect(() => {
    const scroller = findScrollParent(listTopRef.current);
    const target: HTMLElement | Window = scroller === document.scrollingElement ? window : scroller;
    function onScroll() {
      const saved = readSavedView(storageKey);
      writeSavedView(storageKey, { visible: saved?.visible ?? BATCH_SIZE, scrollY: scroller.scrollTop });
    }
    const list = listTopRef.current;
    target.addEventListener('scroll', onScroll, { passive: true });
    /* captura também no clique: a navegação pode ocorrer antes do próximo evento de scroll */
    list?.addEventListener('click', onScroll, true);
    return () => {
      target.removeEventListener('scroll', onScroll);
      list?.removeEventListener('click', onScroll, true);
    };
  }, [storageKey]);

  useEffect(() => {
    writeSavedView(storageKey, { visible: visibleCount, scrollY: pendingScrollRef.current ?? findScrollParent(listTopRef.current).scrollTop });
  }, [storageKey, visibleCount]);

  function updateParams(change: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    change(next);
    setSearchParams(next, { replace: true });
  }

  function setFilterAndUrl(nextFilter: FilterTab) {
    updateParams((next) => (nextFilter === 'all' ? next.delete('status') : next.set('status', nextFilter)));
  }

  function setLayoutAndUrl(nextLayout: LibraryLayout) {
    updateParams((next) => (nextLayout === 'grid' ? next.set('layout', 'grid') : next.delete('layout')));
  }

  function setPlatformAndUrl(nextPlatform: PlatformTab) {
    updateParams((next) => (nextPlatform === 'all' ? next.delete('platform') : next.set('platform', nextPlatform)));
  }

  const platformCounts = useMemo(() => {
    const counts: Record<PlatformTab, number> = { all: gamesWithStats.length, steam: 0, psn: 0, retroachievements: 0 };
    for (const game of gamesWithStats) {
      if (game.platform) counts[game.platform] += 1;
    }
    return counts;
  }, [gamesWithStats]);

  const matchesStatus = useMemo(() => {
    const isDropped = (g: Game) => db.dropped.includes(String(g.appid));
    return (g: Game, tab: FilterTab): boolean => {
      const c = completionMap.get(g.appid);
      switch (tab) {
        case 'pinned': return db.pinned.includes(String(g.appid));
        case 'dropped': return isDropped(g);
        case 'platinum': return hasPsnPlatinum(g) && !isDropped(g);
        case 'completed': return c?.percent === 100 && !isDropped(g);
        case 'inprogress': return Boolean(c && c.percent > 0 && c.percent < 100) && !isDropped(g);
        case 'notstarted': return (!c || c.percent === 0) && !isDropped(g);
        default: return true;
      }
    };
  }, [completionMap, db.pinned, db.dropped]);

  /** Jogos após plataforma e busca: base das contagens das abas e da lista. */
  const scoped = useMemo(() => {
    let list = gamesWithStats;
    if (platform !== 'all') list = list.filter((g) => g.platform === platform);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    return list;
  }, [gamesWithStats, platform, search]);

  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map(({ key }) => [key, scoped.filter((g) => matchesStatus(g, key)).length])) as Record<FilterTab, number>,
    [scoped, matchesStatus],
  );

  const filtered = useMemo(() => {
    const list = scoped.filter((g) => matchesStatus(g, filter));
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
  }, [scoped, matchesStatus, filter, completionMap, db.backlog, sort]);

  const pageItems = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function loadMore() {
    setVisibleCount((count) => Math.min(count + BATCH_SIZE, filtered.length));
  }

  const sentinelRef = useInfiniteScroll({ onLoadMore: loadMore, rearmKey: visibleCount });

  /* restaura o scroll uma única vez, quando as linhas restauradas já estão no DOM */
  useLayoutEffect(() => {
    if (pendingScrollRef.current === null || pageItems.length === 0) return;
    findScrollParent(listTopRef.current).scrollTo({ top: pendingScrollRef.current });
    pendingScrollRef.current = null;
  }, [pageItems.length]);

  const activeFilters = (platform !== 'all' ? 1 : 0) + (sort !== 'name' ? 1 : 0);

  function clearAll() {
    setSearch('');
    setSort('name');
    setSearchParams(isCollections ? { view: 'collections' } : {}, { replace: true });
  }

  return (
    <div className="page biblioteca">
      <header className="lib-head">
        <h1 className="lib-title">
          {isCollections ? 'Coleções' : 'Biblioteca'}
          <small>{filtered.length === gamesWithStats.length ? `${numberFormat.format(gamesWithStats.length)} jogos` : `${numberFormat.format(filtered.length)} de ${numberFormat.format(gamesWithStats.length)} jogos`}</small>
        </h1>
        <div className="lib-tools">
          <label className="search-pill"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar na biblioteca</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na biblioteca…" />
          </label>
          {!isCollections && (
            <div className="segmented" role="group" aria-label="Visualização da biblioteca">
              {([{ key: 'list', label: 'Lista', icon: List }, { key: 'grid', label: 'Grade', icon: LayoutGrid }] as const).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setLayoutAndUrl(key)} aria-pressed={layout === key} aria-label={label} title={label}>
                  <Icon size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          <FilterSortMenu
            sort={sort} onSort={setSort}
            platform={platform} onPlatform={setPlatformAndUrl}
            counts={platformCounts} activeCount={activeFilters}
            onClear={() => { setSort('name'); setPlatformAndUrl('all'); }}
          />
        </div>
      </header>

      <div className="lib-tabs">
        <div className="subtabs" role="group" aria-label="Filtrar por status">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilterAndUrl(key)} className="subtab" aria-pressed={filter === key}>
              {label}<span className="count">{numberFormat.format(tabCounts[key])}</span>
            </button>
          ))}
        </div>
      </div>

      {activeFilters > 0 && (
        <div className="lib-filters">
          <span>Filtros:</span>
          {platform !== 'all' && <span className="active-filter">
            <img src={PLATFORM_META[platform].logo} alt="" />{PLATFORM_TABS.find((item) => item.key === platform)?.label}
            <button onClick={() => setPlatformAndUrl('all')} aria-label="Remover filtro de plataforma"><X size={12} /></button>
          </span>}
          {sort !== 'name' && <span className="active-filter">
            Ordem: {SORTS.find((item) => item.key === sort)?.label}
            <button onClick={() => setSort('name')} aria-label="Voltar à ordem alfabética"><X size={12} /></button>
          </span>}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-zk-danger">{error}</p>}

      <div className="min-w-0" ref={listTopRef}>
        {loading && filtered.length === 0 ? (
          <div className="library-grid">
            {Array.from({ length: 14 }).map((_, i) => <SkeletonCard key={i} portrait />)}
          </div>
        ) : filtered.length === 0 && !isCollections ? (
          <div className="gallery-empty"><p className="font-display text-lg font-bold text-gray-100">Nenhum jogo corresponde a este filtro.</p><p>Tente outro nome, plataforma ou status.</p><button className="btn btn-secondary" onClick={clearAll}>Limpar filtros</button></div>
        ) : isCollections ? (
          <CollectionsView
            games={filtered} completionMap={completionMap}
            collections={db.collections} collectionOf={db.collectionOf}
            onCreate={createCollection} onRename={renameCollection}
            onDelete={deleteCollection} onAssign={setCollection}
          />
        ) : layout === 'list' ? (
          <div className="lib-table" role="table" aria-label="Jogos da biblioteca">
            <div className="lib-head-row col-head" role="row">
              <span role="columnheader" className="r hide-sm">#</span>
              <span role="columnheader"><span className="sr-only">Capa</span></span>
              <span role="columnheader">Jogo</span>
              <span role="columnheader" className="hide-sm hide-md">Plat.</span>
              <span role="columnheader" className="r hide-sm">Troféus</span>
              <span role="columnheader" className="hide-sm">Progresso</span>
              <span role="columnheader" className="r hide-sm hide-md">Tempo</span>
              <span role="columnheader"><span className="sr-only">Ações</span></span>
            </div>
            {pageItems.map((g, index) => (
              <LibraryRow key={g.appid} game={g} rank={index + 1} completion={completionMap.get(g.appid) ?? null}
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

        {!isCollections && filtered.length > 0 && (
          <div className="lib-more">
            <p role="status" aria-live="polite">Mostrando {numberFormat.format(pageItems.length)} de {numberFormat.format(filtered.length)} jogos</p>
            {hasMore && <button className="btn btn-secondary" onClick={loadMore}>Carregar mais</button>}
            {hasMore && <div ref={sentinelRef} aria-hidden="true" className="lib-sentinel" />}
          </div>
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
