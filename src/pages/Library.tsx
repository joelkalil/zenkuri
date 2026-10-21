import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useI18n, useT, type ScopedT } from '../i18n';
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

const TABS: FilterTab[] = ['all', 'inprogress', 'completed', 'platinum', 'notstarted', 'pinned', 'dropped'];

const SORTS: SortMode[] = ['name', 'completion', 'playtime', 'backlog'];

const PLATFORM_TABS: PlatformTab[] = ['all', 'steam', 'psn', 'retroachievements'];

function platformLabel(t: ScopedT<'library'>, key: PlatformTab): string {
  return key === 'all' ? t('platforms.all') : PLATFORM_META[key].label;
}

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
    /* storage unavailable: carry on without restoring */
  }
}

function parseFilter(value: string | null): FilterTab {
  return TABS.find((tab) => tab === value) ?? 'all';
}

function parsePlatform(value: string | null): PlatformTab {
  return PLATFORM_TABS.find((tab) => tab === value) ?? 'all';
}

export default function Library() {
  const t = useT('library');
  const { formatNumber, plural } = useI18n();
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

  /* filter, platform, view and layout come from the URL: the subnav (Games/Collections) changes the route without remounting the page */
  const filter = parseFilter(searchParams.get('status'));
  const platform = parsePlatform(searchParams.get('platform'));
  const isCollections = searchParams.get('view') === 'collections';
  const layout: LibraryLayout = searchParams.get('layout') === 'grid' ? 'grid' : 'list';

  /* any change to search, filter, platform, sort or layout goes back to the first batch (skipped on mount) */
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

  /* saves the scroll position to come back to the same spot after opening a game.
     useLayoutEffect: the cleanup runs on commit, before the next page resets the scroll */
  useLayoutEffect(() => {
    const scroller = findScrollParent(listTopRef.current);
    const target: HTMLElement | Window = scroller === document.scrollingElement ? window : scroller;
    function onScroll() {
      const saved = readSavedView(storageKey);
      writeSavedView(storageKey, { visible: saved?.visible ?? BATCH_SIZE, scrollY: scroller.scrollTop });
    }
    const list = listTopRef.current;
    target.addEventListener('scroll', onScroll, { passive: true });
    /* also capture on click: navigation may happen before the next scroll event */
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

  /** Games after platform and search: basis for the tab counts and the list. */
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
    () => Object.fromEntries(TABS.map((key) => [key, scoped.filter((g) => matchesStatus(g, key)).length])) as Record<FilterTab, number>,
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

  /* restores the scroll exactly once, when the restored rows are already in the DOM */
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
          {isCollections ? t('title.collections') : t('title.library')}
          <small>{filtered.length === gamesWithStats.length ? plural('library.gamesCount', gamesWithStats.length) : plural('library.filteredCount', gamesWithStats.length, { shown: formatNumber(filtered.length) })}</small>
        </h1>
        <div className="lib-tools">
          <label className="search-pill"><Search size={16} aria-hidden="true" /><span className="sr-only">{t('search.label')}</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search.placeholder')} />
          </label>
          {!isCollections && (
            <div className="segmented" role="group" aria-label={t('layout.label')}>
              {([{ key: 'list', label: t('layout.list'), icon: List }, { key: 'grid', label: t('layout.grid'), icon: LayoutGrid }] as const).map(({ key, label, icon: Icon }) => (
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
        <div className="subtabs" role="group" aria-label={t('tabs.label')}>
          {TABS.map((key) => (
            <button key={key} onClick={() => setFilterAndUrl(key)} className="subtab" aria-pressed={filter === key}>
              {t(`tabs.${key}`)}<span className="count">{formatNumber(tabCounts[key])}</span>
            </button>
          ))}
        </div>
      </div>

      {activeFilters > 0 && (
        <div className="lib-filters">
          <span>{t('activeFilters.label')}</span>
          {platform !== 'all' && <span className="active-filter">
            <img src={PLATFORM_META[platform].logo} alt="" />{platformLabel(t, platform)}
            <button onClick={() => setPlatformAndUrl('all')} aria-label={t('activeFilters.removePlatform')}><X size={12} /></button>
          </span>}
          {sort !== 'name' && <span className="active-filter">
            {t('activeFilters.sort', { sort: t(`sorts.${sort}`) })}
            <button onClick={() => setSort('name')} aria-label={t('activeFilters.resetSort')}><X size={12} /></button>
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
          <div className="gallery-empty"><p className="font-display text-lg font-bold text-gray-100">{t('empty.title')}</p><p>{t('empty.hint')}</p><button className="btn btn-secondary" onClick={clearAll}>{t('empty.clear')}</button></div>
        ) : isCollections ? (
          <CollectionsView
            games={filtered} completionMap={completionMap}
            collections={db.collections} collectionOf={db.collectionOf}
            onCreate={createCollection} onRename={renameCollection}
            onDelete={deleteCollection} onAssign={setCollection}
          />
        ) : layout === 'list' ? (
          <div className="lib-table" role="table" aria-label={t('table.label')}>
            <div className="lib-head-row col-head" role="row">
              <span role="columnheader" className="r hide-sm">#</span>
              <span role="columnheader"><span className="sr-only">{t('table.cover')}</span></span>
              <span role="columnheader">{t('table.game')}</span>
              <span role="columnheader" className="hide-sm hide-md">{t('table.platform')}</span>
              <span role="columnheader" className="r hide-sm">{t('table.trophies')}</span>
              <span role="columnheader" className="hide-sm">{t('table.progress')}</span>
              <span role="columnheader" className="r hide-sm hide-md">{t('table.time')}</span>
              <span role="columnheader"><span className="sr-only">{t('table.actions')}</span></span>
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
            <p role="status" aria-live="polite">{plural('library.more.showing', filtered.length, { shown: formatNumber(pageItems.length) })}</p>
            {hasMore && <button className="btn btn-secondary" onClick={loadMore}>{t('more.loadMore')}</button>}
            {hasMore && <div ref={sentinelRef} aria-hidden="true" className="lib-sentinel" />}
          </div>
        )}
      </div>
    </div>
  );
}

/** "Filter and sort" button with a collapsible panel: sort order and platform. */
function FilterSortMenu({ sort, onSort, platform, onPlatform, counts, activeCount, onClear }: {
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  platform: PlatformTab;
  onPlatform: (platform: PlatformTab) => void;
  counts: Record<PlatformTab, number>;
  activeCount: number;
  onClear: () => void;
}) {
  const t = useT('library');
  const { plural } = useI18n();
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
        <SlidersHorizontal size={16} aria-hidden="true" /><span className="tool-btn-label">{t('menu.button')}</span>
        {activeCount > 0 && <span className="tool-badge" aria-label={plural('library.menu.active', activeCount)}>{activeCount}</span>}
      </button>
      {open && <div id="library-filter-panel" className="popover filter-panel" role="dialog" aria-label={t('menu.button')}>
        <header>
          <h2>{t('menu.button')}</h2>
          <button className="link-btn" onClick={onClear} disabled={activeCount === 0}>{t('menu.clearAll')}</button>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('menu.close')}><X size={18} /></button>
        </header>
        <fieldset>
          <legend>{t('menu.sortLegend')}</legend>
          {SORTS.map((item) => (
            <label key={item} className="filter-option">
              <input type="radio" name="library-sort" checked={sort === item} onChange={() => onSort(item)} />
              {t(`sorts.${item}`)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t('menu.platformLegend')}</legend>
          {PLATFORM_TABS.map((item) => (
            <label key={item} className="filter-option">
              <input type="radio" name="library-platform" checked={platform === item} onChange={() => onPlatform(item)} />
              {item !== 'all' && <img src={PLATFORM_META[item].logo} alt="" />}
              {platformLabel(t, item)}<small>{counts[item]}</small>
            </label>
          ))}
        </fieldset>
      </div>}
    </div>
  );
}
