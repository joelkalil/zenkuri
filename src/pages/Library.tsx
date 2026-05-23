import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useSteamGames, getCachedCompletion } from '../hooks/useSteamApi';
import { useLocalDb } from '../hooks/useLocalDb';
import { GameCard } from '../components/GameCard';
import { SkeletonCard } from '../components/SkeletonCard';

type FilterTab = 'all' | 'inprogress' | 'completed' | 'notstarted' | 'pinned';
type SortMode = 'completion' | 'playtime' | 'name' | 'backlog';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'notstarted', label: 'Not Started' },
  { key: 'pinned', label: 'Pinned' },
];

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'completion', label: 'Completion %' },
  { key: 'playtime', label: 'Playtime' },
  { key: 'name', label: 'Name' },
  { key: 'backlog', label: 'Backlog Order' },
];

export default function Library() {
  const { games, loading, error } = useSteamGames();
  const { db, toggleBacklog, togglePinned } = useLocalDb();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortMode>('completion');

  const completionMap = useMemo(() => {
    const map = new Map<number, { percent: number; unlocked: number; total: number }>();
    for (const g of games) {
      const c = getCachedCompletion(g.appid);
      if (c) map.set(g.appid, c);
    }
    return map;
  }, [games]);

  const filtered = useMemo(() => {
    let list = games.filter((g) => g.has_community_visible_stats);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }

    if (filter === 'pinned') {
      list = list.filter((g) => db.pinned.includes(String(g.appid)));
    } else if (filter === 'completed') {
      list = list.filter((g) => completionMap.get(g.appid)?.percent === 100);
    } else if (filter === 'inprogress') {
      list = list.filter((g) => {
        const c = completionMap.get(g.appid);
        return c && c.percent > 0 && c.percent < 100;
      });
    } else if (filter === 'notstarted') {
      list = list.filter((g) => {
        const c = completionMap.get(g.appid);
        return !c || c.percent === 0;
      });
    }

    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'playtime') return b.playtime_forever - a.playtime_forever;
      if (sort === 'backlog') {
        const ai = db.backlog.indexOf(String(a.appid));
        const bi = db.backlog.indexOf(String(b.appid));
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      // completion
      const ca = completionMap.get(a.appid)?.percent ?? -1;
      const cb = completionMap.get(b.appid)?.percent ?? -1;
      return cb - ca;
    });

    return list;
  }, [games, completionMap, db.pinned, db.backlog, search, filter, sort]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Game Library</h1>
        <p className="text-gray-500 text-sm mt-1">
          {games.filter((g) => g.has_community_visible_stats).length} games with achievements
        </p>
      </div>

      {/* Filters & search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games…"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-gray-600 transition-colors"
          />
        </div>
        {/* Sort */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-600 shrink-0" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-600 cursor-pointer"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === t.key
                ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 mb-6 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Grid */}
      {loading && filtered.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg">No games match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((g) => (
            <GameCard
              key={g.appid}
              game={g}
              completion={completionMap.get(g.appid) ?? null}
              isPinned={db.pinned.includes(String(g.appid))}
              inBacklog={db.backlog.includes(String(g.appid))}
              onToggleBacklog={toggleBacklog}
              onTogglePinned={togglePinned}
            />
          ))}
        </div>
      )}
    </div>
  );
}
