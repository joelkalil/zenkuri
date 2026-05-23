import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Library, Crosshair, Play, Pin, Zap } from 'lucide-react';
import { useSteamGames, getCachedCompletion } from '../hooks/useSteamApi';
import { useLocalDb } from '../hooks/useLocalDb';
import { GameCard } from '../components/GameCard';
import { ProgressBar, completionTextColor } from '../components/ProgressBar';
import { SkeletonCard } from '../components/SkeletonCard';
import { gameCoverUrl } from '../lib/steamApi';

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: React.ElementType; accent: string }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3 hover:border-gray-700 transition-colors`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-100">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { games, loading } = useSteamGames();
  const { db, toggleBacklog, togglePinned } = useLocalDb();

  const gamesWithAchievements = useMemo(
    () => games.filter((g) => g.has_community_visible_stats),
    [games],
  );

  const completionMap = useMemo(() => {
    const map = new Map<number, { percent: number; unlocked: number; total: number }>();
    for (const g of games) {
      const c = getCachedCompletion(g.appid);
      if (c) map.set(g.appid, c);
    }
    return map;
  }, [games]);

  const stats = useMemo(() => {
    const total = gamesWithAchievements.length;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    for (const g of gamesWithAchievements) {
      const c = completionMap.get(g.appid);
      if (!c) { notStarted++; continue; }
      if (c.percent === 100) completed++;
      else if (c.unlocked > 0) inProgress++;
      else notStarted++;
    }
    return { total, completed, inProgress, notStarted };
  }, [gamesWithAchievements, completionMap]);

  const almostDone = useMemo(() => {
    return gamesWithAchievements
      .map((g) => ({ game: g, c: completionMap.get(g.appid) }))
      .filter((x) => x.c && x.c.percent > 0 && x.c.percent < 100)
      .sort((a, b) => (b.c!.percent ?? 0) - (a.c!.percent ?? 0))
      .slice(0, 5);
  }, [gamesWithAchievements, completionMap]);

  const recentlyPlayed = useMemo(() => {
    return [...games]
      .filter((g) => (g.playtime_2weeks ?? 0) > 0)
      .sort((a, b) => (b.playtime_2weeks ?? 0) - (a.playtime_2weeks ?? 0))
      .slice(0, 6);
  }, [games]);

  const pinnedGames = useMemo(() => {
    return db.pinned
      .map((id) => games.find((g) => String(g.appid) === id))
      .filter(Boolean) as typeof games;
  }, [db.pinned, games]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Mission Control</h1>
        <p className="text-gray-500 text-sm mt-1">Your achievement conquest at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="With achievements" value={stats.total} icon={Library} accent="bg-blue-600" />
        <StatCard label="Completed (100%)" value={stats.completed} icon={Trophy} accent="bg-yellow-500" />
        <StatCard label="In progress" value={stats.inProgress} icon={Zap} accent="bg-violet-600" />
        <StatCard label="Not started" value={stats.notStarted} icon={Crosshair} accent="bg-gray-700" />
      </div>

      {/* Almost done — hero section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-gray-100">Almost Done</h2>
          <span className="text-xs text-gray-600 ml-1">— sorted by completion, closest first</span>
        </div>

        {loading && almostDone.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : almostDone.length === 0 ? (
          <div className="bg-gray-900/50 border border-dashed border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-600 text-sm">
              No games with partial progress found in cache.
              <br />
              Visit game detail pages to load achievement data.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {almostDone.map(({ game, c }) => (
              <div
                key={game.appid}
                onClick={() => navigate(`/game/${game.appid}`)}
                className="group relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden cursor-pointer hover:border-emerald-700/50 transition-all hover:shadow-xl hover:shadow-emerald-900/10"
              >
                <img
                  src={gameCoverUrl(game.appid)}
                  alt={game.name}
                  className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs font-semibold text-gray-100 truncate leading-tight">{game.name}</p>
                  <div className="flex items-center justify-between mt-1 mb-1.5">
                    <span className="text-xs text-gray-500">{c!.unlocked}/{c!.total}</span>
                    <span className={`text-xs font-bold font-mono ${completionTextColor(c!.percent)}`}>
                      {c!.percent}%
                    </span>
                  </div>
                  <ProgressBar percent={c!.percent} height="h-1.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pinned + Recently Played side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pinned */}
        {pinnedGames.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Pin className="w-4 h-4 text-violet-400" />
              <h2 className="text-base font-bold text-gray-100">Priority Games</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {pinnedGames.map((g) => (
                <GameCard
                  key={g.appid}
                  game={g}
                  completion={completionMap.get(g.appid) ?? null}
                  isPinned
                  inBacklog={db.backlog.includes(String(g.appid))}
                  onTogglePinned={togglePinned}
                  onToggleBacklog={toggleBacklog}
                  compact
                />
              ))}
            </div>
          </section>
        )}

        {/* Recently Played */}
        {recentlyPlayed.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-bold text-gray-100">Recently Played</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recentlyPlayed.map((g) => (
                <GameCard
                  key={g.appid}
                  game={g}
                  completion={completionMap.get(g.appid) ?? null}
                  isPinned={db.pinned.includes(String(g.appid))}
                  inBacklog={db.backlog.includes(String(g.appid))}
                  onTogglePinned={togglePinned}
                  onToggleBacklog={toggleBacklog}
                  compact
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
