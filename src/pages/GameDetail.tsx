import { useParams, useNavigate } from 'react-router-dom';
import type { ElementType } from 'react';
import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, CircleSlash, Crosshair, Pin, BookmarkPlus, BookmarkCheck, Clock, Filter, Link as LinkIcon } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useGameDetails } from '../hooks/useSteamApi';
import { useLocalDb } from '../hooks/useLocalDb';
import { AchievementList } from '../components/AchievementList';
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
    <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
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
  { key: 'gold', icon: '/trophies/gold.png', color: 'text-yellow-400' },
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
        <div key={cell.label} className="stat-tile">
          <span className="stat-tile-label">{cell.label}</span>
          <span className={`stat-tile-value ${cell.color}`}>{cell.value}</span>
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
  const { db, toggleBacklog, togglePinned, toggleDropped, setNote, setGuide, setEffort, setSchedule, setCollection, createCollection } = useLocalDb();

  const appStr = String(numId);
  const inBacklog = db.backlog.includes(appStr);
  const isPinned = db.pinned.includes(appStr);
  const isDropped = db.dropped.includes(appStr);
  const effort = db.effort[appStr];
  const schedule = (db.schedule[appStr] ?? '').slice(0, 7); // sempre mês (YYYY-MM); valores diários antigos são truncados
  const guide = db.guides[appStr] ?? '';
  const collectionId = db.collectionOf[appStr] ?? null;

  const contextCompletion = completionMap.get(numId ?? 0);
  const psnProgress = game?.platform === 'psn' && typeof game.metadata?.progress === 'number'
    ? game.metadata.progress
    : undefined;
  const displayPercent = psnProgress ?? data?.completionPercent ?? contextCompletion?.percent ?? game?.completion?.percent ?? 0;
  const displayUnlocked = data?.unlocked ?? contextCompletion?.unlocked ?? game?.completion?.unlocked ?? 0;
  const displayTotal = data?.total ?? contextCompletion?.total ?? game?.completion?.total ?? 0;

  const [noteText, setNoteText] = useState(db.notes[appStr] ?? '');
  const [guideText, setGuideText] = useState(guide);
  const [tab, setTab] = useState<DetailTab>('trophies');
  const [lowResHero, setLowResHero] = useState<string | null>(null);
  const [trophyFilter, setTrophyFilter] = useState<TrophyFilter>('all');
  const [trophySort, setTrophySort] = useState<TrophySort>('default');

  const breakdown = psnTrophyBreakdown(game);
  const noun = game?.platform === 'psn' ? 'Troféus' : 'Conquistas';
  const metaLine = game
    ? [game.playtime_forever > 0 && `${fmt(game.playtime_forever)} jogados`, `${displayTotal} ${noun.toLowerCase()}`].filter(Boolean).join(' · ')
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

  /**
   * Próximos 3: as conquistas restantes mais fáceis. Raridade global manda
   * (mais jogadores têm = mais fácil); RA sem raridade cai para pontos.
   */
  const nextThree = useMemo(() => {
    const locked = (data?.merged ?? []).filter((a) => !a.achieved);
    const ease = (a: AchievementWithStatus) => {
      if (typeof a.rarity === 'number' && a.rarity > 0) return a.rarity;
      if (typeof a.points === 'number' && a.points > 0) return 100 - Math.min(a.points, 99);
      return -1;
    };
    if (!locked.some((a) => ease(a) >= 0)) return [];
    return [...locked].sort((a, b) => ease(b) - ease(a)).slice(0, 3);
  }, [data]);

  function saveNote() { setNote(appStr, noteText); }
  function saveGuide() { setGuide(appStr, guideText); }

  const heroArt = game?.heroUrl && game.heroUrl !== lowResHero ? game.heroUrl : null;

  return (
    <div className="game-page">
      <section className="game-hero" aria-label="Capa do jogo">
        {/* arte pequena demais fica borrada esticada no banner; melhor o fundo liso */}
        {heroArt ? (
          <img src={heroArt} alt="" onLoad={(e) => { if (e.currentTarget.naturalWidth < 640) setLowResHero(heroArt); }} onError={() => setLowResHero(heroArt)} />
        ) : <div className="game-hero-fallback" />}
        <div className="game-hero-body">
          {game && (
            <div className="game-hero-cover">
              <GameCover game={game} portrait className="h-full w-full" imgClassName="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="game-hero-title">{game?.name ?? `App ${appid}`}</h1>
            <div className="game-hero-sub">
              {game?.platform && <PlatformBadge platform={game.platform} />}
              <span>{metaLine}</span>
            </div>
            <div className="mt-4 flex max-w-md items-center gap-3">
              <span className="game-card-meter-track h-1.5" role="progressbar" aria-label="Conclusão do jogo" aria-valuenow={displayPercent} aria-valuemin={0} aria-valuemax={100}>
                <span className="game-card-meter-fill" data-complete={displayPercent === 100} style={{ width: `${Math.min(displayPercent, 100)}%` }} />
              </span>
              <span className="text-sm font-semibold tabular-nums">{displayPercent}%</span>
            </div>
          </div>
        </div>
      </section>

      <div className="game-actionbar">
        <div className="game-actions">
          <button onClick={() => togglePinned(appStr)} className="btn btn-primary btn-lg" aria-pressed={isPinned}>
            <Pin className="h-4 w-4" fill={isPinned ? 'currentColor' : 'none'} />
            {isPinned ? 'Fixado como prioridade' : 'Fixar como prioridade'}
          </button>
          <button onClick={() => toggleBacklog(appStr)} className="btn btn-secondary btn-lg" aria-pressed={inBacklog}>
            {inBacklog ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
            {inBacklog ? 'No backlog' : 'Adicionar ao backlog'}
          </button>
          <button onClick={() => toggleDropped(appStr)} className={`btn btn-secondary btn-lg btn-icon ${isDropped ? 'text-red-400' : ''}`} aria-pressed={isDropped}
            aria-label={isDropped ? 'Desmarcar como abandonado' : 'Marcar como abandonado'} title={isDropped ? 'Marcado como abandonado' : 'Marcar como abandonado'}>
            <CircleSlash className="h-4 w-4" />
          </button>
          {guideText && (
            <a href={guideText} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-lg">
              <LinkIcon className="h-4 w-4" /> Abrir guia
            </a>
          )}
        </div>
        <div className="game-facts">
          <div className="game-fact"><span>Conclusão</span><strong className={displayPercent === 100 ? 'text-emerald-400' : ''}>{displayPercent}%</strong></div>
          <div className="game-fact"><span>{noun}</span><strong>{displayUnlocked} / {displayTotal}</strong></div>
          {breakdown && (
            <div className="game-fact">
              <span>Por tipo</span>
              <strong className="flex items-center gap-3">
                {TROPHY_ROWS.map((row) => {
                  const b = breakdown[row.key];
                  return (
                    <span key={row.key} className="flex items-center gap-1" title={`${b.earned}/${b.total} ${row.key}`}>
                      <img src={row.icon} alt={row.key} className="h-4 w-4 object-contain" />
                      <span className={`text-base ${row.color}`}>{b.earned}</span>
                    </span>
                  );
                })}
              </strong>
            </div>
          )}
          {game && game.playtime_forever > 0 && <div className="game-fact"><span>Tempo de jogo</span><strong>{fmt(game.playtime_forever)}</strong></div>}
        </div>
      </div>

      <div className="game-layout">
        <div className="min-w-0 space-y-5">
          {siblingGames.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-gray-500">Plataforma</span>
              <div className="segmented" role="group" aria-label="Trocar de plataforma">
                <button aria-pressed="true">
                  {game?.platform && <img src={PLATFORM_META[game.platform].logo} alt="" className="h-4 w-4 object-contain" />}
                  {platformLabel(game?.platform)}
                </button>
                {siblingGames.map((sibling) => (
                  <button key={sibling.appid} aria-pressed="false" onClick={() => navigate(`/game/${sibling.appid}`)}>
                    {sibling.platform && <img src={PLATFORM_META[sibling.platform].logo} alt="" className="h-4 w-4 object-contain" />}
                    {platformLabel(sibling.platform)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800">
            <div className="subtabs" role="tablist" aria-label="Seções do jogo">
              {TABS.map((t) => (
                <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className="subtab">{t.label}</button>
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
              {nextThree.length > 0 && displayPercent < 100 && (
                <section className="mb-5 overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
                  <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
                    <Crosshair className="h-4 w-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-gray-100">Próximos 3</h3>
                    <span className="ml-auto text-xs text-gray-500">As mais fáceis entre as restantes</span>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {nextThree.map((a) => (
                      <div key={a.name} className="flex items-center gap-3 px-4 py-3">
                        <img
                          src={a.icongray || a.icon}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg border border-gray-800 object-cover"
                          onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-100">{a.displayName || a.name}</p>
                          {a.description && <p className="truncate text-xs text-gray-500">{a.description}</p>}
                        </div>
                        {typeof a.rarity === 'number' && a.rarity > 0 ? (
                          <span className="shrink-0 rounded-md bg-violet-600/15 px-2 py-1 text-xs font-semibold tabular-nums text-violet-300">
                            {a.rarity.toFixed(1).replace(/\.0$/, '')}% têm
                          </span>
                        ) : typeof a.points === 'number' && a.points > 0 ? (
                          <span className="shrink-0 rounded-md bg-gray-800 px-2 py-1 text-xs font-semibold tabular-nums text-gray-300">
                            {a.points} pts
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <p className="mb-3 text-xs font-medium text-gray-500">
                {trophyFilter === 'all' ? `Todos os ${displayTotal} ${noun.toLowerCase()}`
                  : trophyFilter === 'earned' ? `${earnedCount} ${noun.toLowerCase()} obtidos`
                  : `${displayTotal - earnedCount} ${noun.toLowerCase()} bloqueados`}
              </p>
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : data ? (
                <AchievementList achievements={visibleTrophies} platform={game?.platform} />
              ) : (
                <p className="py-4 text-sm text-gray-500">Carregando {noun.toLowerCase()}…</p>
              )}
            </div>
          )}

          {tab === 'stats' && game && <StatsPanel game={game} achievements={data?.merged ?? []} />}

          {tab === 'activity' && (
            <div>
              {activity.length === 0 ? (
                <div className="rounded-xl border border-gray-800 bg-gray-900 py-12 text-center">
                  <p className="text-sm font-semibold text-gray-300">Nenhuma atividade ainda</p>
                  <p className="mt-1 text-xs text-gray-500">As conquistas desbloqueadas aparecem aqui, da mais recente para a mais antiga.</p>
                </div>
              ) : (
                <ul className="list-surface">
                  {activity.slice(0, 30).map((a) => (
                    <li key={a.name} className="list-surface-row">
                      <img src={a.icon} alt="" className="h-10 w-10 rounded-lg" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-100">{a.displayName || a.name}</p>
                        <p className="text-xs text-gray-500">Desbloqueado em {fmtDate(a.unlocktime)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <section>
            <h2 className="side-title">Detalhes</h2>
            <dl className="details-table">
              <div className="details-row">
                <dt>Plataforma</dt>
                <dd className="flex items-center gap-2">
                  {game?.platform && <img src={PLATFORM_META[game.platform].logo} alt="" className="h-4 w-4 object-contain" />}
                  {platformLabel(game?.platform)}
                </dd>
              </div>
              {game?.relatedPlatforms && game.relatedPlatforms.length > 0 && (
                <div className="details-row">
                  <dt>Também em</dt>
                  <dd>{game.relatedPlatforms.map(platformLabel).join(', ')} <span className="block text-xs text-gray-500">Cada plataforma mantém sua própria meta.</span></dd>
                </div>
              )}
              <div className="details-row">
                <dt>Esforço</dt>
                <dd className="grid grid-cols-4 gap-1">
                  {EFFORT_OPTIONS.map((opt) => (
                    <button key={opt.key} onClick={() => setEffort(appStr, opt.key)} aria-pressed={effort === opt.key}
                      className={`rounded-md border px-1 py-1.5 text-[11px] font-semibold transition-colors ${
                        effort === opt.key ? opt.color : 'border-gray-800 bg-gray-950 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </dd>
              </div>
              {inBacklog && (
                <div className="details-row">
                  <dt><label htmlFor="detail-schedule">Platina do mês</label></dt>
                  <dd><input id="detail-schedule" type="month" value={schedule} onChange={(e) => setSchedule(appStr, e.target.value)} className="field" /></dd>
                </div>
              )}
              <div className="details-row">
                <dt><label htmlFor="detail-collection">Coleção</label></dt>
                <dd>
                  <select
                    id="detail-collection"
                    value={collectionId ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        const name = window.prompt('Nome da nova coleção:')?.trim();
                        if (name) createCollection(name, [appStr]);
                      } else {
                        setCollection(appStr, e.target.value ? Number(e.target.value) : null);
                      }
                    }}
                    className="field cursor-pointer"
                  >
                    <option value="">Nenhuma</option>
                    {db.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="__new__">+ Nova coleção…</option>
                  </select>
                </dd>
              </div>
              <div className="details-row">
                <dt><label htmlFor="detail-guide">Guia</label></dt>
                <dd><input id="detail-guide" type="url" value={guideText} onChange={(e) => setGuideText(e.target.value)} onBlur={saveGuide} placeholder="https://..." className="field" /></dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="side-title"><label htmlFor="detail-notes">Notas pessoais</label></h2>
            <textarea id="detail-notes" value={noteText} onChange={(e) => setNoteText(e.target.value)} onBlur={saveNote} rows={5}
              placeholder="Dicas, estratégias, problemas conhecidos…" className="field" />
            <button onClick={saveNote} className="btn btn-secondary mt-2 w-full">Salvar nota</button>
          </section>

          <p className="flex items-center gap-1.5 px-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" /> Última atualização: {game ? 'sincronizado' : '—'}
          </p>
        </aside>
      </div>
    </div>
  );
}
