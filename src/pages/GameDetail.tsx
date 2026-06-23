import { useParams, useNavigate } from 'react-router-dom';
import type { ElementType } from 'react';
import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronRight, CircleSlash, Pin, BookmarkPlus, BookmarkCheck, Clock, Filter, Link as LinkIcon } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useGameDetails } from '../hooks/useSteamApi';
import { useLocalDb } from '../hooks/useLocalDb';
import { AchievementList } from '../components/AchievementList';
import { ProgressBar, completionTextColor } from '../components/ProgressBar';
import { SkeletonRow } from '../components/SkeletonCard';
import { GameCover } from '../components/GameCover';
import { PLATFORM_META, psnTrophyBreakdown } from '../lib/platforms';
import type { AchievementWithStatus, EffortLevel, Game, Platform } from '../types/steam';

type TrophyFilter = 'all' | 'earned' | 'locked';
type TrophySort = 'default' | 'rarity' | 'date' | 'name';

/** Trophy tier as a rarity proxy (rarest first); PSN has no per-trophy earn-rate in our data. */
const TIER_RANK: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

function PlatformBadge({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform];
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm">
      <img src={meta.logo} alt="" className="h-4 w-4 object-contain" />
      {meta.short}
    </span>
  );
}

function SelectControl<T extends string>({
  icon: Icon,
  value,
  onChange,
  options,
}: {
  icon: ElementType;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="cursor-pointer appearance-none rounded-lg border border-gray-800 bg-gray-900 py-2 pl-8 pr-8 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-700 focus:border-violet-600 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
    </div>
  );
}

const EFFORT_OPTIONS: { key: EffortLevel; label: string; color: string }[] = [
  { key: 'easy', label: 'Fácil', color: 'text-emerald-300 border-emerald-600/60 bg-emerald-900/30' },
  { key: 'medium', label: 'Médio', color: 'text-amber-300 border-amber-600/60 bg-amber-900/30' },
  { key: 'hard', label: 'Difícil', color: 'text-orange-300 border-orange-600/60 bg-orange-900/30' },
  { key: 'grind', label: 'Insano', color: 'text-red-300 border-red-600/60 bg-red-900/30' },
];

const TABS = [
  { key: 'trophies', label: 'Troféus' },
  { key: 'stats', label: 'Estatísticas' },
  { key: 'activity', label: 'Atividade' },
] as const;
type DetailTab = (typeof TABS)[number]['key'];

function fmt(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function platformLabel(platform?: string) {
  if (platform === 'retroachievements') return 'RetroAchievements';
  if (platform === 'psn') return 'PSN';
  return 'Steam';
}

function fmtDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short', day: 'numeric' });
}

const TROPHY_ROWS = [
  { key: 'platinum', icon: '/trophies/platinum.png', color: 'text-slate-200' },
  { key: 'gold', icon: '/trophies/gold.png', color: 'text-yellow-300' },
  { key: 'silver', icon: '/trophies/silver.png', color: 'text-gray-300' },
  { key: 'bronze', icon: '/trophies/bronze.png', color: 'text-orange-300' },
] as const;

function StatsPanel({ game, achievements }: { game: Game; achievements: AchievementWithStatus[] }) {
  const cells: { label: string; value: string; color: string }[] = [];
  if (game.platform === 'retroachievements') {
    const points = achievements.reduce((s, a) => s + (a.achieved ? Number(a.points ?? 0) : 0), 0);
    const totalPoints = achievements.reduce((s, a) => s + Number(a.points ?? 0), 0);
    cells.push(
      { label: 'Pontos', value: `${points}/${totalPoints}`, color: 'text-amber-300' },
      { label: 'Progresso hardcore', value: `${game.completion?.percent ?? 0}%`, color: 'text-emerald-400' },
      { label: 'Conquistas', value: String(achievements.length), color: 'text-gray-200' },
    );
  } else {
    cells.push(
      { label: 'Conclusão', value: game.completion?.percent === 100 ? 'Perfeito' : `${game.completion?.percent ?? 0}%`, color: 'text-emerald-400' },
      { label: game.platform === 'psn' ? 'Troféus' : 'Conquistas', value: `${game.completion?.unlocked ?? 0}/${game.completion?.total ?? 0}`, color: 'text-sky-400' },
      { label: 'Tempo de jogo', value: fmt(game.playtime_forever), color: 'text-violet-300' },
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className={`text-2xl font-bold ${cell.color}`}>{cell.value}</p>
          <p className="mt-0.5 text-xs text-gray-500">{cell.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function GameDetail() {
  const { appid } = useParams<{ appid: string }>();
  const navigate = useNavigate();
  const numId = appid ? Number(appid) : null;

  const { games, completionMap } = useSteam();
  const game = useMemo(() => games.find((g) => g.appid === numId), [games, numId]);
  const siblingGames = useMemo(
    () => game ? games.filter((item) => item.groupId === game.groupId && item.appid !== game.appid) : [],
    [games, game],
  );

  const { data, loading, error } = useGameDetails(numId);
  const { db, toggleBacklog, togglePinned, toggleDropped, setNote, setGuide, setEffort, setSchedule } = useLocalDb();

  const appStr = String(numId);
  const inBacklog = db.backlog.includes(appStr);
  const isPinned = db.pinned.includes(appStr);
  const isDropped = db.dropped.includes(appStr);
  const effort = db.effort[appStr];
  const schedule = db.schedule[appStr] ?? '';
  const guide = db.guides[appStr] ?? '';

  const contextCompletion = completionMap.get(numId ?? 0);
  const displayPercent = data?.completionPercent ?? contextCompletion?.percent ?? game?.completion?.percent ?? 0;
  const displayUnlocked = data?.unlocked ?? contextCompletion?.unlocked ?? game?.completion?.unlocked ?? 0;
  const displayTotal = data?.total ?? contextCompletion?.total ?? game?.completion?.total ?? 0;

  const [noteText, setNoteText] = useState(db.notes[appStr] ?? '');
  const [guideText, setGuideText] = useState(guide);
  const [tab, setTab] = useState<DetailTab>('trophies');
  const [trophyFilter, setTrophyFilter] = useState<TrophyFilter>('all');
  const [trophySort, setTrophySort] = useState<TrophySort>('default');

  const breakdown = psnTrophyBreakdown(game);
  const noun = game?.platform === 'psn' ? 'Troféus' : 'Conquistas';
  const metaLine = game
    ? [`${fmt(game.playtime_forever)} jogados`, `${displayTotal} ${noun.toLowerCase()}`].join(' · ')
    : '';

  const activity = useMemo(
    () => (data?.merged ?? []).filter((a) => a.achieved && a.unlocktime > 0).sort((a, b) => b.unlocktime - a.unlocktime),
    [data],
  );

  const visibleTrophies = useMemo(() => {
    let list = data?.merged ?? [];
    if (trophyFilter === 'earned') list = list.filter((a) => a.achieved);
    else if (trophyFilter === 'locked') list = list.filter((a) => !a.achieved);

    const rarityRank = (a: AchievementWithStatus) => {
      if (a.type && TIER_RANK[a.type] !== undefined) return TIER_RANK[a.type];
      if (typeof a.points === 'number' && a.points > 0) return 1000 - a.points; // RA: more points ≈ rarer
      return 500;
    };

    const sorted = [...list];
    if (trophySort === 'rarity') sorted.sort((a, b) => rarityRank(a) - rarityRank(b));
    else if (trophySort === 'date') sorted.sort((a, b) => (b.unlocktime || 0) - (a.unlocktime || 0));
    else if (trophySort === 'name') sorted.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
    return sorted;
  }, [data, trophyFilter, trophySort]);

  const earnedCount = useMemo(() => (data?.merged ?? []).filter((a) => a.achieved).length, [data]);

  function saveNote() { setNote(appStr, noteText); }
  function saveGuide() { setGuide(appStr, guideText); }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm">
        <button onClick={() => navigate('/library')} className="text-gray-500 transition-colors hover:text-gray-300">Library</button>
        <ChevronRight className="h-3.5 w-3.5 text-gray-700" />
        <span className="truncate text-gray-300">{game?.name ?? `App ${appid}`}</span>
      </div>

      {/* hero — full-bleed cinematic banner + vertical cover */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-gray-800">
        {game?.heroUrl && (
          <img src={game.heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        )}
        {/* darken the left for the cover + text, reveal the art on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-gray-950/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
        <div className="relative flex items-center gap-5 p-5 sm:p-6">
          {game && (
            <GameCover
              game={game}
              portrait
              className="hidden h-52 w-36 shrink-0 overflow-hidden rounded-xl border border-gray-700/70 shadow-2xl shadow-black/60 sm:block"
              imgClassName="object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-white sm:text-4xl">{game?.name ?? `App ${appid}`}</h1>
              {game?.platform && <PlatformBadge platform={game.platform} />}
            </div>
            <p className="mt-1 text-sm text-gray-400">{metaLine}</p>
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div className="shrink-0">
                <p className={`font-display text-5xl font-extrabold leading-none tabular-nums ${completionTextColor(displayPercent)}`}>{displayPercent}%</p>
                <p className="mt-1.5 text-xs text-gray-400">{displayUnlocked} / {displayTotal} {noun.toLowerCase()}</p>
              </div>
              <div className="min-w-44 flex-1">
                <ProgressBar percent={displayPercent} height="h-2" />
              </div>
              {breakdown && (
                <div className="flex items-center gap-3">
                  {TROPHY_ROWS.map((row) => {
                    const b = breakdown[row.key];
                    return (
                      <span key={row.key} className="flex items-center gap-1.5" title={`${b.earned}/${b.total} ${row.key}`}>
                        <img src={row.icon} alt="" className="h-5 w-5 object-contain" />
                        <span className={`text-sm font-bold tabular-nums ${row.color}`}>{b.earned}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-4 lg:col-span-2">
          {/* platform switch (siblings) */}
          {siblingGames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-2 rounded-lg border border-violet-600/60 bg-violet-600/15 px-3 py-1.5 text-xs font-semibold text-violet-200">
                {game?.platform && <img src={PLATFORM_META[game.platform].logo} alt="" className="h-4 w-4 object-contain" />}
                {platformLabel(game?.platform)}
              </span>
              {siblingGames.map((sibling) => (
                <button key={sibling.appid} onClick={() => navigate(`/game/${sibling.appid}`)}
                  className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-gray-700 hover:text-gray-200">
                  {sibling.platform && <img src={PLATFORM_META[sibling.platform].logo} alt="" className="h-4 w-4 object-contain grayscale opacity-70" />}
                  {platformLabel(sibling.platform)}
                </button>
              ))}
            </div>
          )}

          {/* tabs + trophy controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
                    tab === t.key ? 'text-violet-200' : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {t.label}
                  {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-400" />}
                </button>
              ))}
            </div>
            {tab === 'trophies' && (
              <div className="flex items-center gap-2 pb-2">
                <SelectControl
                  icon={Filter}
                  value={trophyFilter}
                  onChange={setTrophyFilter}
                  options={[
                    { value: 'all', label: 'Todos' },
                    { value: 'earned', label: 'Obtidos' },
                    { value: 'locked', label: 'Bloqueados' },
                  ]}
                />
                <SelectControl
                  icon={ArrowUpDown}
                  value={trophySort}
                  onChange={setTrophySort}
                  options={[
                    { value: 'default', label: 'Padrão' },
                    { value: 'rarity', label: 'Raridade' },
                    { value: 'date', label: 'Data' },
                    { value: 'name', label: 'Nome' },
                  ]}
                />
              </div>
            )}
          </div>

          {error && <p className="py-4 text-sm text-red-400">{error}</p>}

          {tab === 'trophies' && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                {trophyFilter === 'all' ? `Todos os ${displayTotal} ${noun.toLowerCase()}`
                  : trophyFilter === 'earned' ? `${earnedCount} ${noun.toLowerCase()} obtidos`
                  : `${displayTotal - earnedCount} ${noun.toLowerCase()} bloqueados`}
              </p>
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : data ? (
                <AchievementList achievements={visibleTrophies} platform={game?.platform} />
              ) : (
                <p className="py-4 text-sm text-gray-600">Carregando {noun.toLowerCase()}…</p>
              )}
            </div>
          )}

          {tab === 'stats' && game && <StatsPanel game={game} achievements={data?.merged ?? []} />}

          {tab === 'activity' && (
            <div>
              {activity.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-600">Nenhuma conquista desbloqueada ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {activity.slice(0, 30).map((a) => (
                    <li key={a.name} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3">
                      <img src={a.icon} alt="" className="h-10 w-10 rounded-lg" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-100">{a.displayName || a.name}</p>
                        <p className="text-xs text-blue-400/80">Desbloqueado em {fmtDate(a.unlocktime)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* right column — Ações */}
        <div className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Ações</h2>
            {game?.relatedPlatforms && game.relatedPlatforms.length > 0 && (
              <div className="rounded-lg border border-blue-800/30 bg-blue-950/20 px-3 py-2 text-xs text-blue-200">
                Também rastreado em {game.relatedPlatforms.map(platformLabel).join(', ')}. Cada plataforma mantém sua própria meta.
              </div>
            )}
            <button onClick={() => toggleBacklog(appStr)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                inBacklog ? 'border border-blue-700/30 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              {inBacklog ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
              {inBacklog ? 'No backlog' : 'Adicionar ao backlog'}
            </button>
            <button onClick={() => togglePinned(appStr)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isPinned ? 'border border-violet-700/30 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              <Pin className="h-4 w-4" />
              {isPinned ? 'Fixado como prioridade' : 'Fixar jogo'}
            </button>
            <button onClick={() => toggleDropped(appStr)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isDropped ? 'border border-red-700/30 bg-red-600/20 text-red-300 hover:bg-red-600/30' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              <CircleSlash className="h-4 w-4" />
              {isDropped ? 'Marcado como dropado' : 'Marcar como dropado'}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Esforço previsto</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {EFFORT_OPTIONS.map((opt) => (
                <button key={opt.key} onClick={() => setEffort(appStr, opt.key)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    effort === opt.key ? opt.color : 'border-gray-800 bg-gray-950 text-gray-600 hover:border-gray-700 hover:text-gray-400'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {inBacklog && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Data alvo</h2>
              <input type="date" value={schedule} onChange={(e) => setSchedule(appStr, e.target.value)}
                className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-300 focus:border-violet-600 focus:outline-none [color-scheme:dark]" />
            </div>
          )}

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Guia</h2>
            <div className="flex gap-2">
              <input type="url" value={guideText} onChange={(e) => setGuideText(e.target.value)} onBlur={saveGuide} placeholder="https://..."
                className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-violet-600 focus:outline-none" />
              {guideText && (
                <a href={guideText} target="_blank" rel="noopener noreferrer" title="Abrir guia"
                  className="flex w-10 items-center justify-center rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">
                  <LinkIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Notas pessoais</h2>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} onBlur={saveNote} rows={4}
              placeholder="Dicas, estratégias, problemas conhecidos…"
              className="w-full resize-none rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-300 placeholder-gray-700 focus:border-violet-600 focus:outline-none" />
            <button onClick={saveNote}
              className="mt-2 w-full rounded-lg bg-gray-800 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700">
              Salvar nota
            </button>
          </div>

          <p className="flex items-center gap-1.5 px-1 text-xs text-gray-600">
            <Clock className="h-3 w-3" /> Última atualização: {game ? 'sincronizado' : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
