import { useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CircleSlash, Clock3, Crosshair, Library, Medal, Play, Pin, Target, Trophy, Zap } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { GameCard } from '../components/GameCard';
import { ProgressBar, completionTextColor } from '../components/ProgressBar';
import { SkeletonCard } from '../components/SkeletonCard';
import { GameCover } from '../components/GameCover';
import { PLATFORM_META, type PlatformFilter, type ViewMode, platformLabel, platformStats } from '../lib/platforms';
import type { Game } from '../types/steam';

function StatCell({
  label,
  value,
  icon: Icon,
  image,
  accentText,
  valueClass = 'text-gray-100',
  hint,
  span = false,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: ElementType;
  image?: string;
  accentText: string;
  valueClass?: string;
  hint: string;
  span?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col gap-3 bg-gray-900 p-4 text-left transition-colors hover:bg-gray-800/40 focus:outline-none focus-visible:bg-gray-800/40 ${span ? 'col-span-2 sm:col-span-1' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800/70 ${accentText}`}>
          {image ? <img src={image} alt="" className="h-[18px] w-[18px] object-contain" /> : <Icon className="h-[18px] w-[18px]" />}
        </span>
        <ChevronRight className="h-4 w-4 -translate-x-1 text-gray-600 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
      <div>
        <p className={`text-[1.75rem] font-bold leading-none tabular-nums ${valueClass}`}>{value}</p>
        <p className="mt-1.5 text-sm font-medium text-gray-300">{label}</p>
        <p className="mt-0.5 truncate text-xs text-gray-600">{hint}</p>
      </div>
    </button>
  );
}

function platformQuery(platform: PlatformFilter) {
  return platform === 'all' ? '' : `&platform=${platform}`;
}

function MetricPill({
  label,
  value,
  color,
  icon,
  iconClassName = '',
  iconNode,
}: {
  label: string;
  value: string | number;
  color: string;
  icon?: string;
  iconClassName?: string;
  iconNode?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3">
      {icon && <img src={icon} alt="" className={`h-8 w-8 object-contain ${iconClassName}`} />}
      {iconNode && <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-gray-300">{iconNode}</div>}
      <div className="min-w-0">
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="mt-0.5 text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function PlatformSpecificPanel({ platform, games }: { platform: PlatformFilter; games: Game[] }) {
  const stats = platformStats(games);
  const [showTotals, setShowTotals] = useState(false);

  if (platform === 'psn') {
    const trophyRows = [
      ['Platinum', stats.psn.earned.platinum, stats.psn.total.platinum, 'text-slate-200', '/trophies/platinum.png'],
      ['Gold', stats.psn.earned.gold, stats.psn.total.gold, 'text-yellow-400', '/trophies/gold.png'],
      ['Silver', stats.psn.earned.silver, stats.psn.total.silver, 'text-gray-300', '/trophies/silver.png'],
      ['Bronze', stats.psn.earned.bronze, stats.psn.total.bronze, 'text-orange-400', '/trophies/bronze.png'],
    ] as const;
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-100">PSN Trophy Case</h2>
          <div className="flex rounded-lg border border-gray-800 bg-gray-950 p-1">
            <button
              onClick={() => setShowTotals(false)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                !showTotals ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              Earned
            </button>
            <button
              onClick={() => setShowTotals(true)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                showTotals ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              Total
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {trophyRows.map(([label, earned, total, color, icon]) => (
            <MetricPill key={label} label={label} value={showTotals ? `${earned}/${total}` : earned} color={color} icon={icon} />
          ))}
        </div>
      </section>
    );
  }

  if (platform === 'steam') {
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-3 text-base font-bold text-gray-100">Steam Achievement View</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricPill label="Perfect games" value={stats.steam.perfectGames} color="text-emerald-400" icon="/trophies/achievement-100.png" />
          <MetricPill label="Achievements" value={`${stats.steam.unlocked}/${stats.steam.total}`} color="text-sky-400" icon="/trophies/achievement-100.png" iconClassName="grayscale opacity-70" />
          <MetricPill label="Recent playtime" value={`${Math.round(stats.steam.recentMinutes / 60)}h`} color="text-violet-400" iconNode={<Clock3 className="h-4 w-4" />} />
          <MetricPill label="Steam targets" value={games.length} color="text-gray-200" iconNode={<Target className="h-4 w-4" />} />
        </div>
      </section>
    );
  }

  if (platform === 'retroachievements') {
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-3 text-base font-bold text-gray-100">RetroAchievements View</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricPill label="Mastered games" value={stats.retroachievements.masteredGames} color="text-emerald-400" />
          <MetricPill label="Hardcore unlocks" value={`${stats.retroachievements.hardcoreUnlocked}/${stats.retroachievements.hardcoreTotal}`} color="text-amber-400" />
          <MetricPill label="Tracked sets" value={games.length} color="text-gray-200" />
          <MetricPill label="Completion" value={`${stats.retroachievements.hardcoreTotal > 0 ? Math.round((stats.retroachievements.hardcoreUnlocked / stats.retroachievements.hardcoreTotal) * 100) : 0}%`} color="text-violet-400" />
        </div>
      </section>
    );
  }

  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { games, gamesWithStats, loading, completionMap } = useSteam();
  const { db, toggleBacklog, togglePinned } = useLocalDb();
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('common');

  const scopedGames = useMemo(
    () => games.filter((game) => platform === 'all' || game.platform === platform),
    [games, platform],
  );

  const scopedGamesWithStats = useMemo(
    () => gamesWithStats.filter((game) => platform === 'all' || game.platform === platform),
    [gamesWithStats, platform],
  );

  const stats = useMemo(() => {
    let completed = 0, inProgress = 0, notStarted = 0;
    for (const g of scopedGamesWithStats) {
      if (db.dropped.includes(String(g.appid))) continue;
      const c = completionMap.get(g.appid);
      if (!c) { notStarted++; continue; }
      if (c.percent === 100) completed++;
      else if (c.unlocked > 0) inProgress++;
      else notStarted++;
    }
    const platformSpecific = platformStats(scopedGamesWithStats);
    return {
      total: scopedGamesWithStats.length,
      completed,
      inProgress,
      notStarted,
      dropped: db.dropped.filter((id) => scopedGamesWithStats.some((game) => String(game.appid) === id)).length,
      platinums: platformSpecific.psn.earned.platinum,
    };
  }, [scopedGamesWithStats, completionMap, db.dropped]);

  const almostDone = useMemo(() => {
    return scopedGamesWithStats
      .map((g) => ({ game: g, c: completionMap.get(g.appid) }))
      .filter((x) => x.c && x.c.percent > 0 && x.c.percent < 100 && !db.dropped.includes(String(x.game.appid)))
      .sort((a, b) => b.c!.percent - a.c!.percent)
      .slice(0, 8);
  }, [scopedGamesWithStats, completionMap, db.dropped]);

  const recentlyPlayed = useMemo(
    () =>
      [...games]
        .filter((game) => platform === 'all' || game.platform === platform)
        .filter((g) => (g.playtime_2weeks ?? 0) > 0)
        .sort((a, b) => (b.playtime_2weeks ?? 0) - (a.playtime_2weeks ?? 0))
        .slice(0, 6),
    [games, platform],
  );

  const pinnedGames = useMemo(
    () => db.pinned.map((id) => scopedGames.find((g) => String(g.appid) === id)).filter(Boolean) as typeof games,
    [db.pinned, scopedGames],
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Mission Control</h1>
            <p className="text-gray-500 text-sm mt-1">{platformLabel(platform, true)} insights at a glance</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'steam', 'psn', 'retroachievements'] as PlatformFilter[]).map((item) => (
              <button
                key={item}
                onClick={() => {
                  setPlatform(item);
                  if (item === 'all') setViewMode('common');
                }}
                className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                  platform === item ? 'border-violet-500 bg-violet-600/15 text-violet-300' : 'border-gray-800 bg-gray-900 text-gray-500 hover:text-gray-200'
                }`}
              >
                {item !== 'all' && <img src={PLATFORM_META[item].logo} alt="" className="h-4 w-4 object-contain" />}
                {platformLabel(item)}
              </button>
            ))}
            <div className="flex rounded-lg border border-gray-800 bg-gray-900 p-1">
              {(['common', 'platform'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  disabled={mode === 'platform' && platform === 'all'}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    viewMode === mode ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-200 disabled:opacity-40'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-800 bg-gray-800 sm:grid-cols-5">
        <StatCell label="Targets" value={stats.total} icon={Library} accentText="text-gray-300" hint="Synced with achievements" onClick={() => navigate(`/library?status=all${platformQuery(platform)}`)} />
        <StatCell label="100%" value={stats.completed} icon={Trophy} image="/trophies/achievement-100.png" accentText="text-emerald-400" valueClass="text-emerald-400" hint="Fully completed" onClick={() => navigate(`/library?status=completed${platformQuery(platform)}`)} />
        <StatCell label="Platinums" value={stats.platinums} icon={Medal} image="/trophies/platinum.png" accentText="text-amber-400" valueClass="text-amber-400" hint="PSN platinum trophies" onClick={() => navigate('/library?status=platinum&platform=psn')} />
        <StatCell label="In progress" value={stats.inProgress} icon={Zap} accentText="text-violet-400" hint="Started, not done" onClick={() => navigate(`/library?status=inprogress${platformQuery(platform)}`)} />
        <StatCell label="Dropped" value={stats.dropped} icon={CircleSlash} accentText="text-gray-500" valueClass={stats.dropped > 0 ? 'text-gray-100' : 'text-gray-500'} hint="Manual flag" span onClick={() => navigate(`/library?status=dropped${platformQuery(platform)}`)} />
      </div>

      {viewMode === 'platform' && <PlatformSpecificPanel platform={platform} games={scopedGamesWithStats} />}

      {/* Almost Done */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-gray-100">Almost Done</h2>
          <span className="text-xs text-gray-600 ml-1">— closest to 100%</span>
        </div>

        {loading && almostDone.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : almostDone.length === 0 ? (
          <div className="bg-gray-900/50 border border-dashed border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-600 text-sm">Scanning your library… check back in a moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {almostDone.map(({ game, c }) => (
              <div
                key={game.appid}
                onClick={() => navigate(`/game/${game.appid}`)}
                className="group relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden cursor-pointer hover:border-emerald-700/50 transition-all hover:shadow-xl hover:shadow-emerald-900/10"
              >
                <GameCover
                  game={game}
                  className="w-full h-32"
                  imgClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs font-semibold text-white truncate leading-tight">{game.name}</p>
                  <div className="flex items-center justify-between mt-1 mb-1.5">
                    <span className="text-xs text-white/70">{c!.unlocked}/{c!.total}</span>
                    <span className={`text-xs font-bold font-mono ${completionTextColor(c!.percent)}`}>{c!.percent}%</span>
                  </div>
                  <ProgressBar percent={c!.percent} height="h-1.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {pinnedGames.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Pin className="w-4 h-4 text-violet-400" />
              <h2 className="text-base font-bold text-gray-100">Priority Games</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {pinnedGames.map((g) => (
                <GameCard key={g.appid} game={g} completion={completionMap.get(g.appid) ?? null}
                  isPinned inBacklog={db.backlog.includes(String(g.appid))}
                  isDropped={db.dropped.includes(String(g.appid))}
                  onTogglePinned={togglePinned} onToggleBacklog={toggleBacklog} compact />
              ))}
            </div>
          </section>
        )}

        {recentlyPlayed.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-bold text-gray-100">Recently Played</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {recentlyPlayed.map((g) => (
                <GameCard key={g.appid} game={g} completion={completionMap.get(g.appid) ?? null}
                  isPinned={db.pinned.includes(String(g.appid))} inBacklog={db.backlog.includes(String(g.appid))}
                  isDropped={db.dropped.includes(String(g.appid))}
                  onTogglePinned={togglePinned} onToggleBacklog={toggleBacklog} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
