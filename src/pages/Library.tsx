import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { LibraryCard } from '../components/LibraryCard';
import { LibraryRow } from '../components/LibraryRow';
import { SkeletonCard } from '../components/SkeletonCard';
import type { Platform } from '../types/steam';
import { hasPsnPlatinum } from '../lib/platforms';

type FilterTab = 'all' | 'inprogress' | 'completed' | 'platinum' | 'notstarted' | 'pinned' | 'dropped';
type SortMode = 'completion' | 'playtime' | 'name' | 'backlog';
type PlatformTab = 'all' | Platform;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'inprogress', label: 'Em Progresso' },
  { key: 'completed', label: '100%' },
  { key: 'platinum', label: 'Platinada' },
  { key: 'notstarted', label: 'Não Iniciado' },
  { key: 'pinned', label: 'Fixados' },
  { key: 'dropped', label: 'Dropados' },
];

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'name', label: 'A-Z' },
  { key: 'completion', label: 'Conclusão %' },
  { key: 'playtime', label: 'Tempo de jogo' },
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
  const { db, toggleBacklog, togglePinned } = useLocalDb();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>(() => (searchParams.get('status') as FilterTab) || 'all');
  const [platform, setPlatform] = useState<PlatformTab>(() => (searchParams.get('platform') as PlatformTab) || 'all');
  const [sort, setSort] = useState<SortMode>('name');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search, filter, platform, sort]);

  function setFilterAndUrl(nextFilter: FilterTab) {
    setFilter(nextFilter);
    const next = new URLSearchParams(searchParams);
    if (nextFilter === 'all') next.delete('status');
    else next.set('status', nextFilter);
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

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Game Library</h1>
          <p className="text-gray-500 text-sm mt-1">
            Todos os seus jogos e conquistas em um só lugar
            <span className="text-gray-600"> · {gamesWithStats.length} jogos</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jogos…"
              className="w-56 bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-violet-600 transition-colors" />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}
            className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-violet-600 cursor-pointer">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="flex rounded-xl border border-gray-800 bg-gray-900 p-1">
            <button onClick={() => setView('grid')} title="Grade"
              className={`grid h-7 w-7 place-items-center rounded-lg transition-colors ${view === 'grid' ? 'bg-violet-600/25 text-violet-200' : 'text-gray-500 hover:text-gray-300'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView('list')} title="Lista"
              className={`grid h-7 w-7 place-items-center rounded-lg transition-colors ${view === 'list' ? 'bg-violet-600/25 text-violet-200' : 'text-gray-500 hover:text-gray-300'}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {PLATFORM_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setPlatformAndUrl(key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              platform === key ? 'bg-gray-800 text-gray-100 shadow-[inset_0_0_0_1px_var(--color-gray-700)]' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'
            }`}>
            {label} <span className="ml-0.5 text-gray-600">({platformCounts[key]})</span>
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5 border-t border-gray-800/70 pt-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setFilterAndUrl(t.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === t.key ? 'bg-violet-600/20 text-violet-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.3)]' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 mb-6 text-sm text-red-400">{error}</div>}

      {loading && filtered.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-600"><p className="text-lg">Nenhum jogo corresponde a este filtro.</p></div>
      ) : view === 'list' ? (
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 divide-y divide-gray-800/70">
          {pageItems.map((g) => (
            <LibraryRow key={g.appid} game={g} completion={completionMap.get(g.appid) ?? null}
              isPinned={db.pinned.includes(String(g.appid))} inBacklog={db.backlog.includes(String(g.appid))}
              isDropped={db.dropped.includes(String(g.appid))}
              onToggleBacklog={toggleBacklog} onTogglePinned={togglePinned} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {pageItems.map((g) => (
            <LibraryCard key={g.appid} game={g} completion={completionMap.get(g.appid) ?? null}
              isPinned={db.pinned.includes(String(g.appid))} inBacklog={db.backlog.includes(String(g.appid))}
              isDropped={db.dropped.includes(String(g.appid))}
              onToggleBacklog={toggleBacklog} onTogglePinned={togglePinned} />
          ))}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="grid h-8 w-8 place-items-center rounded-lg border border-gray-800 text-gray-400 transition-colors hover:border-gray-700 hover:text-gray-200 disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageNumbers(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-gray-600">…</span>
            ) : (
              <button key={p} onClick={() => setPage(p as number)}
                className={`h-8 min-w-8 rounded-lg px-2 text-sm font-semibold transition-colors ${
                  p === page ? 'bg-violet-600/25 text-violet-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.3)]' : 'border border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                }`}>
                {p}
              </button>
            ),
          )}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="grid h-8 w-8 place-items-center rounded-lg border border-gray-800 text-gray-400 transition-colors hover:border-gray-700 hover:text-gray-200 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
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
