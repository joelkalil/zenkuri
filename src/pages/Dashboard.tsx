import { useEffect, useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, CheckCircle2, ChevronRight, Clock3, Crosshair, Gem, LayoutGrid, MoreVertical, Pin, Target, Trophy, XCircle } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { fetchRarestUnlocked } from '../lib/api';
import type { UnlockItem } from '../types/steam';
import { ProgressBar, completionColor, completionTextColor } from '../components/ProgressBar';
import { SkeletonCard } from '../components/SkeletonCard';
import { GameCover } from '../components/GameCover';
import { PLATFORM_META, type PlatformFilter, type ViewMode, platformLabel, platformStats } from '../lib/platforms';
import type { Game } from '../types/steam';

/** One connected cell inside the metrics strip: inline icon + label, big value, hint. */
function StatCell({
  label,
  value,
  icon: Icon,
  accentText,
  valueClass = 'text-gray-100',
  hint,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: ElementType;
  accentText: string;
  valueClass?: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 p-4 text-left transition-colors hover:bg-gray-800/40 focus:outline-none focus-visible:bg-gray-800/40 lg:p-5"
    >
      <span className="flex items-center gap-2">
        <Icon className={`h-[18px] w-[18px] ${accentText}`} />
        <span className="text-sm font-medium text-gray-400">{label}</span>
      </span>
      <span className={`text-[2.35rem] font-bold leading-none tabular-nums ${valueClass}`}>{value}</span>
      <span className="truncate text-xs text-gray-500">{hint}</span>
    </button>
  );
}

function platformQuery(platform: PlatformFilter) {
  return platform === 'all' ? '' : `&platform=${platform}`;
}

/** "27h 49m" from total minutes. */
function formatPlaytime(minutes: number): string {
  if (!minutes || minutes < 1) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, '0')}m`;
}

/** "Hoje" / "Ontem" / "3 dias atrás" from Steam's rtime_last_played. */
function lastPlayedDate(game: Game): string {
  const ts = Number((game.metadata as Record<string, unknown> | undefined)?.rtime_last_played ?? 0);
  if (ts <= 0) return '—';
  const days = Math.floor((Date.now() - ts * 1000) / 86_400_000);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days === 2) return 'Anteontem';
  if (days < 30) return `${days} dias atrás`;
  const months = Math.floor(days / 30);
  return months <= 1 ? '1 mês atrás' : `${months} meses atrás`;
}

/** One cell inside a platform panel, matching the metrics-strip language. */
function PanelCell({
  leading,
  label,
  value,
  valueClass = 'text-gray-100',
  hint,
}: {
  leading: ReactNode;
  label: string;
  value: ReactNode;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 lg:p-5">
      <span className="flex items-center gap-2">
        {leading}
        <span className="text-sm font-medium text-gray-400">{label}</span>
      </span>
      <span className={`text-[2rem] font-bold leading-none tabular-nums ${valueClass}`}>{value}</span>
      {hint && <span className="truncate text-xs text-gray-500">{hint}</span>}
    </div>
  );
}

const panelGrid =
  'grid grid-cols-2 divide-x divide-y divide-gray-800 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/50 lg:grid-cols-4 lg:divide-y-0';

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function PlatformSpecificPanel({ platform, games }: { platform: PlatformFilter; games: Game[] }) {
  const stats = platformStats(games);
  const [showTotals, setShowTotals] = useState(false);

  if (platform === 'psn') {
    const trophyRows = [
      ['Platina', stats.psn.earned.platinum, stats.psn.total.platinum, 'text-slate-100', '/trophies/platinum.png'],
      ['Ouro', stats.psn.earned.gold, stats.psn.total.gold, 'text-amber-300', '/trophies/gold.png'],
      ['Prata', stats.psn.earned.silver, stats.psn.total.silver, 'text-gray-200', '/trophies/silver.png'],
      ['Bronze', stats.psn.earned.bronze, stats.psn.total.bronze, 'text-orange-300', '/trophies/bronze.png'],
    ] as const;
    return (
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-bold text-gray-100">Troféus da PSN</h2>
          <div className="ml-auto flex items-center gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
            {([['Obtidos', false], ['Total', true]] as const).map(([label, total]) => (
              <button
                key={label}
                onClick={() => setShowTotals(total)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  showTotals === total ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/40' : 'text-gray-400 hover:text-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={panelGrid}>
          {trophyRows.map(([label, earned, total, color, icon]) => (
            <PanelCell
              key={label}
              leading={<img src={icon} alt="" className="h-[18px] w-[18px] object-contain" />}
              label={label}
              value={showTotals ? `${earned}/${total}` : earned}
              valueClass={color}
              hint={`${pct(earned, total)}% obtidos`}
            />
          ))}
        </div>
      </section>
    );
  }

  if (platform === 'steam') {
    return (
      <section>
        <div className="mb-4 flex items-center gap-2">
          <img src={PLATFORM_META.steam.logo} alt="" className="h-5 w-5 object-contain" />
          <h2 className="text-lg font-bold text-gray-100">Conquistas da Steam</h2>
        </div>
        <div className={panelGrid}>
          <PanelCell
            leading={<img src="/trophies/achievement-100.png" alt="" className="h-[18px] w-[18px] object-contain" />}
            label="Jogos perfeitos"
            value={stats.steam.perfectGames}
            valueClass="text-emerald-400"
            hint="100% das conquistas"
          />
          <PanelCell
            leading={<CheckCircle2 className="h-[18px] w-[18px] text-sky-400" />}
            label="Conquistas"
            value={`${stats.steam.unlocked}/${stats.steam.total}`}
            valueClass="text-sky-400"
            hint={`${pct(stats.steam.unlocked, stats.steam.total)}% desbloqueadas`}
          />
          <PanelCell
            leading={<Clock3 className="h-[18px] w-[18px] text-violet-400" />}
            label="Tempo recente"
            value={`${Math.round(stats.steam.recentMinutes / 60)}h`}
            valueClass="text-violet-300"
            hint="Últimas 2 semanas"
          />
          <PanelCell
            leading={<Target className="h-[18px] w-[18px] text-gray-400" />}
            label="Targets"
            value={games.length}
            hint="Jogos rastreados"
          />
        </div>
      </section>
    );
  }

  if (platform === 'retroachievements') {
    const raCompletion = pct(stats.retroachievements.hardcoreUnlocked, stats.retroachievements.hardcoreTotal);
    return (
      <section>
        <div className="mb-4 flex items-center gap-2">
          <img src={PLATFORM_META.retroachievements.logo} alt="" className="h-5 w-5 object-contain" />
          <h2 className="text-lg font-bold text-gray-100">RetroAchievements</h2>
        </div>
        <div className={panelGrid}>
          <PanelCell
            leading={<Trophy className="h-[18px] w-[18px] text-emerald-400" />}
            label="Jogos zerados"
            value={stats.retroachievements.masteredGames}
            valueClass="text-emerald-400"
            hint="Mastered"
          />
          <PanelCell
            leading={<Activity className="h-[18px] w-[18px] text-amber-400" />}
            label="Hardcore"
            value={`${stats.retroachievements.hardcoreUnlocked}/${stats.retroachievements.hardcoreTotal}`}
            valueClass="text-amber-400"
            hint="Conquistas hardcore"
          />
          <PanelCell
            leading={<Target className="h-[18px] w-[18px] text-gray-400" />}
            label="Conjuntos"
            value={games.length}
            hint="Sets rastreados"
          />
          <PanelCell
            leading={<CheckCircle2 className="h-[18px] w-[18px] text-violet-400" />}
            label="Conclusão"
            value={`${raCompletion}%`}
            valueClass="text-violet-300"
            hint="Progresso hardcore"
          />
        </div>
      </section>
    );
  }

  return null;
}

/** "Quase Lá" card: portrait cover with a pin toggle, title + progress in a footer below the art. */
function AlmostThereCard({
  game,
  completion,
  isPinned,
  onTogglePin,
}: {
  game: Game;
  completion: { percent: number; unlocked: number; total: number };
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition-all duration-200 hover:border-violet-600/50 hover:shadow-lg hover:shadow-black/40">
      <button onClick={() => navigate(`/game/${game.appid}`)} className="block w-full text-left">
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-800">
          <GameCover game={game} portrait className="h-full w-full" imgClassName="object-cover transition-transform duration-300 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
        <div className="space-y-2 p-3">
          <p className="truncate text-sm font-semibold text-gray-100">{game.name}</p>
          <div className="flex items-center gap-2">
            <ProgressBar percent={completion.percent} className="flex-1" height="h-1.5" />
            <span className={`shrink-0 text-xs font-bold tabular-nums ${completionTextColor(completion.percent)}`}>{completion.percent}%</span>
          </div>
        </div>
      </button>
      <button
        onClick={onTogglePin}
        title={isPinned ? 'Desafixar' : 'Fixar como prioridade'}
        className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full backdrop-blur-sm transition-colors ${
          isPinned ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40' : 'bg-black/55 text-gray-200 hover:bg-violet-600/80 hover:text-white'
        }`}
      >
        <Pin className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Relíquia: uma conquista rara desbloqueada, exibida como peça de coleção. */
function RelicCard({ relic }: { relic: UnlockItem }) {
  const navigate = useNavigate();
  const meta = PLATFORM_META[relic.platform];
  return (
    <button
      onClick={() => navigate(`/game/${relic.gameId}`)}
      className="group flex items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-violet-500/50"
    >
      {relic.icon ? (
        <img src={relic.icon} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-gray-800 object-cover" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-gray-800 bg-gray-800">
          <Gem className="h-6 w-6 text-violet-400" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-100">{relic.achievementTitle}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-500">
          <img src={meta.logo} alt="" className="h-3 w-3 object-contain" />
          {relic.gameName}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-xl font-bold tabular-nums text-violet-400">
          {relic.rarity?.toFixed(1).replace(/\.0$/, '')}%
        </p>
        <p className="text-[10px] uppercase tracking-wide text-gray-600">dos jogadores</p>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { games, gamesWithStats, loading, completionMap } = useSteam();
  const { db, togglePinned } = useLocalDb();
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('common');
  const [relics, setRelics] = useState<UnlockItem[]>([]);

  useEffect(() => {
    fetchRarestUnlocked(3).then(setRelics).catch(() => setRelics([]));
  }, []);

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

  const pctHint = (value: number) =>
    stats.total > 0 ? `${((value / stats.total) * 100).toFixed(1)}% do total` : '0% do total';

  const almostDone = useMemo(() => {
    return scopedGamesWithStats
      .map((g) => ({ game: g, c: completionMap.get(g.appid) }))
      .filter((x) => x.c && x.c.percent > 0 && x.c.percent < 100 && !db.dropped.includes(String(x.game.appid)))
      .sort((a, b) => b.c!.percent - a.c!.percent)
      .slice(0, 6);
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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="heading-editorial text-3xl font-semibold text-gray-100">Painel de Controle</h1>
            <p className="mt-1 text-sm text-gray-500">Visão geral dos seus troféus e conquistas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
              {(['all', 'steam', 'psn', 'retroachievements'] as PlatformFilter[]).map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setPlatform(item);
                    if (item === 'all') setViewMode('common');
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    platform === item ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/40' : 'text-gray-400 hover:text-gray-100'
                  }`}
                >
                  {item === 'all' ? (
                    <LayoutGrid className="h-4 w-4" />
                  ) : (
                    <img src={PLATFORM_META[item].logo} alt="" className="h-4 w-4 object-contain" />
                  )}
                  {item === 'all' ? 'Todos' : platformLabel(item)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
              {(['common', 'platform'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  disabled={mode === 'platform' && platform === 'all'}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
                    viewMode === mode ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/40' : 'text-gray-400 hover:text-gray-100'
                  }`}
                >
                  {mode === 'common' ? 'Comum' : 'Por Plataforma'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-gray-800 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/50 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        <StatCell label="Targets" value={stats.total} icon={Target} accentText="text-violet-400" hint="Definidos" onClick={() => navigate(`/library?status=all${platformQuery(platform)}`)} />
        <StatCell label="100%" value={stats.completed} icon={CheckCircle2} accentText="text-emerald-400" valueClass="text-emerald-400" hint={pctHint(stats.completed)} onClick={() => navigate(`/library?status=completed${platformQuery(platform)}`)} />
        <StatCell label="Platinuns" value={stats.platinums} icon={Trophy} accentText="text-amber-400" valueClass="text-amber-400" hint={pctHint(stats.platinums)} onClick={() => navigate('/library?status=platinum&platform=psn')} />
        <StatCell label="Em Progresso" value={stats.inProgress} icon={Activity} accentText="text-sky-400" valueClass="text-sky-400" hint={pctHint(stats.inProgress)} onClick={() => navigate(`/library?status=inprogress${platformQuery(platform)}`)} />
        <StatCell label="Abandonados" value={stats.dropped} icon={XCircle} accentText="text-red-400" valueClass={stats.dropped > 0 ? 'text-red-400' : 'text-gray-500'} hint={pctHint(stats.dropped)} onClick={() => navigate(`/library?status=dropped${platformQuery(platform)}`)} />
      </div>

      {viewMode === 'platform' && <PlatformSpecificPanel platform={platform} games={scopedGamesWithStats} />}

      {/* Almost Done */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-gray-100">Quase Lá</h2>
          <button
            onClick={() => navigate(`/library?status=inprogress${platformQuery(platform)}`)}
            className="ml-auto text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
          >
            Ver todos
          </button>
        </div>

        {loading && almostDone.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : almostDone.length === 0 ? (
          <div className="bg-gray-900/50 border border-dashed border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-600 text-sm">Analisando sua biblioteca… volte em instantes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {almostDone.map(({ game, c }) => (
              <AlmostThereCard
                key={game.appid}
                game={game}
                completion={c!}
                isPinned={db.pinned.includes(String(game.appid))}
                onTogglePin={() => togglePinned(String(game.appid))}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {recentlyPlayed.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-gray-100">Jogadas Recentemente</h2>
              <button
                onClick={() => navigate('/library?sort=recent')}
                className="ml-auto text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
              >
                Ver todas
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
              <div className="divide-y divide-gray-800">
                {recentlyPlayed.map((g) => {
                  const c = completionMap.get(g.appid);
                  return (
                    <button
                      key={g.appid}
                      onClick={() => navigate(`/game/${g.appid}`)}
                      className="group flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-gray-800/50"
                    >
                      <GameCover game={g} className="h-11 w-11 shrink-0 rounded-lg bg-gray-800" imgClassName="object-cover" />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">{g.name}</p>
                      <span className="hidden shrink-0 items-center gap-1.5 text-xs text-gray-500 sm:flex">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatPlaytime(g.playtime_forever)}
                      </span>
                      <span className="hidden w-24 shrink-0 items-center gap-1.5 text-xs text-gray-500 md:flex">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {lastPlayedDate(g)}
                      </span>
                      <div className="flex w-24 shrink-0 items-center justify-end gap-2">
                        {c ? (
                          <>
                            <div className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-gray-800 sm:block">
                              <div className={`h-full rounded-full ${completionColor(c.percent)}`} style={{ width: `${c.percent}%` }} />
                            </div>
                            <span className={`text-xs font-bold tabular-nums ${completionTextColor(c.percent)}`}>{c.percent}%</span>
                            {c.percent === 100 && <img src="/trophies/gold.png" alt="" className="h-4 w-4 object-contain" />}
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => navigate('/library?sort=recent')}
                className="flex w-full items-center justify-center gap-1.5 border-t border-gray-800 p-3 text-xs font-semibold text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-200"
              >
                Ver histórico completo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        )}

        <section>
            <div className="flex items-center gap-2 mb-4">
              <Pin className="w-5 h-5 text-violet-400" />
              <div className="leading-tight">
                <h2 className="text-lg font-bold text-gray-100">Jogos Prioritários</h2>
                <p className="text-xs text-gray-600">Foco atual • Itens fixados</p>
              </div>
              <button
                onClick={() => navigate('/backlog')}
                className="ml-auto rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-700 hover:text-gray-100"
              >
                Gerenciar
              </button>
            </div>
            {pinnedGames.length === 0 ? (
              <div className="flex h-[calc(100%-3rem)] min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-800 bg-gray-900/40 p-8 text-center">
                <Pin className="h-6 w-6 text-gray-700" />
                <p className="text-sm text-gray-600">Fixe jogos como prioridade para vê-los aqui.</p>
              </div>
            ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
              <div className="divide-y divide-gray-800">
                {pinnedGames.map((g) => {
                  const c = completionMap.get(g.appid);
                  const meta = g.platform ? PLATFORM_META[g.platform] : null;
                  const isPsn = g.platform === 'psn';
                  return (
                    <div key={g.appid} className="group flex items-center gap-3 p-2.5">
                      <Pin className="h-4 w-4 shrink-0 text-violet-400" />
                      <button onClick={() => navigate(`/game/${g.appid}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <GameCover game={g} className="h-11 w-11 shrink-0 rounded-lg bg-gray-800" imgClassName="object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-gray-100">{g.name}</p>
                            {meta && (
                              <span className="flex shrink-0 items-center gap-1 rounded-md bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-gray-300">
                                <img src={meta.logo} alt="" className="h-3 w-3 object-contain" />
                                {meta.short}
                              </span>
                            )}
                          </div>
                          {c && (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {c.unlocked} / {c.total} {isPsn ? 'troféus' : 'conquistas'}
                            </p>
                          )}
                        </div>
                      </button>
                      {c && (
                        <div className="hidden w-28 shrink-0 items-center gap-2 sm:flex">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: `${c.percent}%` }} />
                          </div>
                          <span className="w-9 text-right text-xs font-bold tabular-nums text-gray-300">{c.percent}%</span>
                        </div>
                      )}
                      <button
                        onClick={() => togglePinned(String(g.appid))}
                        title="Desafixar"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-600 transition-colors hover:bg-gray-800 hover:text-gray-300"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => navigate('/backlog')}
                className="flex w-full items-center justify-center gap-1.5 border-t border-gray-800 p-3 text-xs font-semibold text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-200"
              >
                Ver todos os prioritários <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            )}
          </section>
      </div>

      {/* Relíquias: as conquistas mais raras da coleção */}
      {relics.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Gem className="w-5 h-5 text-violet-400" />
            <div className="leading-tight">
              <h2 className="text-lg font-bold text-gray-100">Relíquias da Coleção</h2>
              <p className="text-xs text-gray-600">Suas conquistas mais raras entre todos os jogadores</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relics.map((relic) => (
              <RelicCard key={`${relic.gameId}-${relic.achievementTitle}`} relic={relic} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
