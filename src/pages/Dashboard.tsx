import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useI18n, useT } from '../i18n';
import { useLocalDb } from '../hooks/useLocalDb';
import { useNextEasiest } from '../hooks/useNextEasiest';
import { fetchRarestUnlocked } from '../lib/api';
import { usePlan } from '../hooks/usePlan';
import { daysBetween, formatDay, formatMinutes, isoDay, parseDay, relativeDays, todayStart } from '../lib/planDates';
import type { UnlockItem } from '../types/steam';
import { ProgressBar } from '../components/ProgressBar';
import { SectionHead } from '../components/SectionHead';
import { SkeletonCard } from '../components/SkeletonCard';
import { GameCover } from '../components/GameCover';
import { LibraryCard } from '../components/LibraryCard';
import { PLATFORM_META, type PlatformFilter, platformStats } from '../lib/platforms';
import type { Game } from '../types/steam';
import '../styles/hoje.css';

/** Router state that makes the game page link back to Today. */
function useFromToday() {
  const t = useT('dashboard');
  return useMemo(() => ({ from: { to: '/', label: t('title') } }), [t]);
}

const PLATFORM_KEYS: PlatformFilter[] = ['all', 'steam', 'psn', 'retroachievements'];

/** Platform names are proper nouns; only "all" is translated. */
const PLATFORM_SHORT: Record<Exclude<PlatformFilter, 'all'>, string> = { steam: 'Steam', psn: 'PSN', retroachievements: 'RA' };
const PLATFORM_LONG: Record<Exclude<PlatformFilter, 'all'>, string> = { steam: 'Steam', psn: 'PlayStation Network', retroachievements: 'RetroAchievements' };

function platformQuery(platform: PlatformFilter) {
  return platform === 'all' ? '' : `&platform=${platform}`;
}

function formatPlaytime(minutes: number): string {
  return !minutes || minutes < 1 ? '—' : formatMinutes(minutes);
}

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Fact-sheet line: label on the left, tabular value on the right. */
function FicheItem({ label, value, leading }: { label: string; value: ReactNode; leading?: ReactNode }) {
  return (
    <div className="fiche-item">
      <dt>{leading}{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Platform detail: only shown when a specific platform is selected. */
function PlatformSpecificPanel({ number, platform, games }: { number: string; platform: PlatformFilter; games: Game[] }) {
  const t = useT('dashboard');
  const { formatNumber } = useI18n();
  const stats = platformStats(games);
  const [showTotals, setShowTotals] = useState(false);

  if (platform === 'psn') {
    const trophyRows = [
      [t('psn.platinum'), stats.psn.earned.platinum, stats.psn.total.platinum, '/trophies/platinum.png'],
      [t('psn.gold'), stats.psn.earned.gold, stats.psn.total.gold, '/trophies/gold.png'],
      [t('psn.silver'), stats.psn.earned.silver, stats.psn.total.silver, '/trophies/silver.png'],
      [t('psn.bronze'), stats.psn.earned.bronze, stats.psn.total.bronze, '/trophies/bronze.png'],
    ] as const;
    return (
      <section>
        <SectionHead number={number} title={t('psn.title')} action={
          <div className="segmented" role="group" aria-label={t('psn.showAria')}>
            {([[t('psn.earned'), false], [t('psn.total'), true]] as const).map(([label, total]) => (
              <button key={label} onClick={() => setShowTotals(total)} aria-pressed={showTotals === total}>{label}</button>
            ))}
          </div>
        } />
        <dl className="fiche">
          {trophyRows.map(([label, earned, total, icon]) => (
            <FicheItem
              key={label}
              leading={<img src={icon} alt="" />}
              label={label}
              value={showTotals ? `${earned}/${total}` : `${earned} · ${pct(earned, total)}%`}
            />
          ))}
        </dl>
      </section>
    );
  }

  if (platform === 'steam') {
    return (
      <section>
        <SectionHead number={number} title={t('steam.title')} />
        <dl className="fiche">
          <FicheItem label={t('steam.perfect')} value={stats.steam.perfectGames} />
          <FicheItem label={t('steam.achievements')} value={`${formatNumber(stats.steam.unlocked)}/${formatNumber(stats.steam.total)} · ${pct(stats.steam.unlocked, stats.steam.total)}%`} />
          <FicheItem label={t('steam.last2Weeks')} value={formatMinutes(stats.steam.recentMinutes)} />
          <FicheItem label={t('steam.goals')} value={games.length} />
        </dl>
      </section>
    );
  }

  if (platform === 'retroachievements') {
    return (
      <section>
        <SectionHead number={number} title={t('ra.title')} />
        <dl className="fiche">
          <FicheItem label={t('ra.mastered')} value={stats.retroachievements.masteredGames} />
          <FicheItem label={t('ra.hardcore')} value={`${formatNumber(stats.retroachievements.hardcoreUnlocked)}/${formatNumber(stats.retroachievements.hardcoreTotal)}`} />
          <FicheItem label={t('ra.sets')} value={games.length} />
          <FicheItem label={t('ra.hardcoreProgress')} value={`${pct(stats.retroachievements.hardcoreUnlocked, stats.retroachievements.hardcoreTotal)}%`} />
        </dl>
      </section>
    );
  }

  return null;
}

type Completion = { percent: number; unlocked: number; total: number };
interface FocusItem { game: Game; completion?: Completion; pinned: boolean }

/** "Next 3" rows of the focus game; loads achievements through the hook shared with the game page. */
function NextThree({ game }: { game: Game }) {
  const t = useT('dashboard');
  const { formatNumber } = useI18n();
  const fromToday = useFromToday();
  const { next, loading, error, loaded } = useNextEasiest(game.appid);
  const trophyWord = game.platform === 'psn' ? t('noun.trophies') : t('noun.achievements');

  return (
    <div className="next3">
      <p className="col-head">{t('next3.heading')}</p>
      {loading || (!loaded && !error) ? (
        <div aria-hidden="true" className="space-y-2 pt-3 motion-safe:animate-pulse">
          {[0, 1, 2].map((i) => <div key={i} className="h-8 bg-gray-850" />)}
        </div>
      ) : next.length > 0 ? (
        <ol>
          {next.map((a, index) => (
            <li key={a.name}>
              <Link to={`/game/${game.appid}`} state={fromToday} className="next3-row">
                <span className="n">{index + 1}</span>
                <span className="name" title={a.displayName || a.name}>{a.displayName || a.name}</span>
                <span className="pct">
                  {typeof a.rarity === 'number' && a.rarity > 0
                    ? `${formatNumber(a.rarity, { maximumFractionDigits: 1 })}%`
                    : typeof a.points === 'number' && a.points > 0 ? t('next3.points', { points: a.points }) : ''}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="next3-empty">
          {error ? t('next3.loadError', { noun: trophyWord }) : t('next3.noRarity')}{' '}
          <Link to={`/game/${game.appid}`} state={fromToday}>{t('next3.see', { noun: trophyWord })}</Link>
        </p>
      )}
    </div>
  );
}

interface NowCardProps {
  focus: FocusItem;
  position: number;
  total: number;
  others: Game[];
  completionOf: (game: Game) => Completion | undefined;
  onPrev: () => void;
  onNext: () => void;
  onTogglePin: (appid: string) => void;
}

/** 01 · Now: contained art, progress, next 3 and actions for the focus game. */
function NowCard({ focus, position, total, others, completionOf, onPrev, onNext, onTogglePin }: NowCardProps) {
  const t = useT('dashboard');
  const fromToday = useFromToday();
  const navigate = useNavigate();
  const { game, completion, pinned } = focus;
  const [badArt, setBadArt] = useState<string[]>([]);
  const meta = game.platform ? PLATFORM_META[game.platform] : null;
  const noun = game.platform === 'psn' ? t('noun.trophies') : t('noun.achievements');
  const art = game.heroUrl && !badArt.includes(game.heroUrl) ? game.heroUrl : null;
  const markBad = (url: string) => setBadArt((list) => (list.includes(url) ? list : [...list, url]));
  const remaining = completion ? completion.total - completion.unlocked : 0;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (total < 2) return;
    if (event.key === 'ArrowLeft') onPrev();
    else if (event.key === 'ArrowRight') onNext();
  }

  return (
    <div className="now">
      <div className="now-art">
        {art ? (
          <img key={art} src={art} alt="" onError={() => markBad(art)}
            onLoad={(event) => { if (event.currentTarget.naturalWidth < 640) markBad(art); }} />
        ) : (
          <GameCover key={game.appid} game={game} imgClassName="object-cover" />
        )}
      </div>

      <div className="min-w-0">
        <div className="now-eyebrow" onKeyDown={onKeyDown}>
          <span className="micro">{pinned ? t('now.pinned') : t('now.suggestion')}</span>
          {pinned && total > 1 && (
            <span className="now-switch">
              <button onClick={onPrev} aria-label={t('now.prevAria')}><ChevronLeft size={16} aria-hidden="true" /></button>
              <span className="num micro" aria-live="polite">{t('now.position', { position, total })}</span>
              <button onClick={onNext} aria-label={t('now.nextAria')}><ChevronRight size={16} aria-hidden="true" /></button>
            </span>
          )}
        </div>
        <h3 className="now-title">{game.name}</h3>
        <div className="now-meta">
          {meta && <span><img src={meta.logo} alt="" />{meta.short}</span>}
          {completion && <span className="num">{t('now.progressCount', { unlocked: completion.unlocked, total: completion.total, noun })}</span>}
          {game.playtime_forever > 0 && <span className="num">{formatPlaytime(game.playtime_forever)}</span>}
        </div>
        {completion && (
          <>
            <div className="now-progress">
              <strong>{completion.percent}%</strong>
              <ProgressBar className="bar" percent={completion.percent} />
            </div>
            {remaining > 0 && <p className="now-left">{t('now.left', { count: remaining })}</p>}
          </>
        )}
        <div className="now-actions">
          <button className="btn btn-primary" onClick={() => navigate(`/game/${game.appid}`, { state: fromToday })}>{t('now.see', { noun })}</button>
          <button className="btn btn-secondary" aria-pressed={pinned} onClick={() => onTogglePin(String(game.appid))}>
            <Pin size={14} aria-hidden="true" fill={pinned ? 'currentColor' : 'none'} />
            {pinned ? t('now.unpin') : t('now.pin')}
          </button>
        </div>
        {others.length > 0 && (
          <p className="now-also">
            {t('now.alsoPinned')}{' '}
            {others.slice(0, 3).map((other, index) => {
              const c = completionOf(other);
              return (
                <span key={other.appid}>
                  {index > 0 && ' · '}
                  <Link to={`/game/${other.appid}`} state={fromToday}>{other.name}</Link>
                  {c && <span className="num"> {c.percent}%</span>}
                </span>
              );
            })}
            {others.length > 3 && <span> · +{others.length - 3}</span>}
          </p>
        )}
      </div>

      <NextThree key={game.appid} game={game} />
    </div>
  );
}

/** 02 · Plan: current phase, next milestone and the head of the queue (data from /api/plan). */
function PlanSummary({ queue, completionOf }: { queue: Game[]; completionOf: (game: Game) => Completion | undefined }) {
  const t = useT('dashboard');
  const fromToday = useFromToday();
  const { plan } = usePlan();
  const today = todayStart();
  const todayIso = isoDay(today);
  const phases = plan?.phases ?? [];
  const phase = phases.find((item) => item.start <= todayIso && todayIso <= item.end)
    ?? (phases.length > 0 && todayIso < phases[0].start ? phases[0] : phases[phases.length - 1] ?? null);
  const active = phase !== null && phase.start <= todayIso && todayIso <= phase.end;
  const milestone = plan?.milestones.find((item) => item.date && item.date >= todayIso) ?? null;
  const days = milestone?.date ? daysBetween(today, parseDay(milestone.date)) : null;

  return (
    <dl className="plan-lines">
      <dt>{t('plan.phase')}</dt>
      <dd>
        {phase ? (
          <>
            <span className="num">{phase.slug}</span> · {phase.title}
            <span className="dim num"> · {active ? t('plan.until', { date: formatDay(phase.end, today) }) : t('plan.range', { start: formatDay(phase.start, today), end: formatDay(phase.end, today) })}</span>
          </>
        ) : (
          <span className="dim">
            {plan ? t('plan.noPhases') : t('plan.noPlan')}{' '}
            <Link to="/plano">{plan ? t('plan.addPhases') : t('plan.createPlan')}</Link>
          </span>
        )}
      </dd>
      <dt>{t('plan.nextMilestone')}</dt>
      <dd>
        {milestone ? (
          <>{milestone.title}<span className="dim num"> · {milestone.label}{days !== null ? ` · ${relativeDays(days)}` : ''}</span></>
        ) : <span className="dim">{t('plan.noMilestone')}</span>}
      </dd>
      <dt>{t('plan.inQueue')}</dt>
      <dd>
        {queue.length === 0 ? <span className="dim">{t('plan.queueEmpty')}</span> : (
          <ol className="plan-queue">
            {queue.map((game, index) => {
              const c = completionOf(game);
              return (
                <li key={game.appid}>
                  <span className="num dim">{index + 1}</span>{' '}
                  <Link to={`/game/${game.appid}`} state={fromToday}>{game.name}</Link>
                  {c && <span className="num dim"> {c.percent}%</span>}
                </li>
              );
            })}
          </ol>
        )}
      </dd>
    </dl>
  );
}

/** Horizontal shelf with arrows. */
function Shelf({ number, title, onSeeAll, seeAllLabel, children }: { number: string; title: string; onSeeAll: () => void; seeAllLabel: string; children: ReactNode }) {
  const t = useT('dashboard');
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  function measure() {
    const el = trackRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [children]);

  function scroll(direction: 1 | -1) {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return (
    <section className="shelf">
      <SectionHead number={number} title={title} action={
        <div className="flex items-center gap-3">
          <button onClick={onSeeAll} className="btn btn-ghost btn-sm">{seeAllLabel}</button>
          <div className="shelf-arrows">
            <button onClick={() => scroll(-1)} disabled={edges.start} aria-label={t('shelf.scrollLeft', { title })}><ChevronLeft size={16} aria-hidden="true" /></button>
            <button onClick={() => scroll(1)} disabled={edges.end} aria-label={t('shelf.scrollRight', { title })}><ChevronRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
      } />
      <div ref={trackRef} className="shelf-track" onScroll={measure}>{children}</div>
    </section>
  );
}

/** Collection rarity: one rare unlocked achievement. */
function RarityRow({ relic }: { relic: UnlockItem }) {
  const { formatNumber } = useI18n();
  const fromToday = useFromToday();
  const meta = PLATFORM_META[relic.platform];
  return (
    <li>
      <Link to={`/game/${relic.gameId}`} state={fromToday} className="rarity-row">
        {relic.icon ? <img src={relic.icon} alt="" /> : <span aria-hidden="true" className="h-10 w-10 bg-gray-850" />}
        <span className="min-w-0">
          <span className="t block">{relic.achievementTitle}</span>
          <span className="g"><img src={meta.logo} alt="" />{relic.gameName}</span>
        </span>
        <span className="p">{relic.rarity !== null ? `${formatNumber(relic.rarity, { maximumFractionDigits: 1 })}%` : ''}</span>
      </Link>
    </li>
  );
}

export default function Dashboard() {
  const t = useT('dashboard');
  const { formatNumber } = useI18n();
  const fromToday = useFromToday();
  const navigate = useNavigate();
  const { games, gamesWithStats, loading, completionMap } = useSteam();
  const { db, togglePinned } = useLocalDb();
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [focusIndex, setFocusIndex] = useState(0);
  const [relics, setRelics] = useState<UnlockItem[]>([]);

  useEffect(() => {
    fetchRarestUnlocked(3).then(setRelics).catch(() => setRelics([]));
  }, []);

  const scopedGamesWithStats = useMemo(
    () => gamesWithStats.filter((game) => platform === 'all' || game.platform === platform),
    [gamesWithStats, platform],
  );

  const stats = useMemo(() => {
    let completed = 0, inProgress = 0;
    for (const g of scopedGamesWithStats) {
      if (db.dropped.includes(String(g.appid))) continue;
      const c = completionMap.get(g.appid);
      if (!c) continue;
      if (c.percent === 100) completed++;
      else if (c.unlocked > 0) inProgress++;
    }
    const platformSpecific = platformStats(scopedGamesWithStats);
    return {
      total: scopedGamesWithStats.length,
      completed,
      inProgress,
      dropped: db.dropped.filter((id) => scopedGamesWithStats.some((game) => String(game.appid) === id)).length,
      platinums: platformSpecific.psn.earned.platinum,
    };
  }, [scopedGamesWithStats, completionMap, db.dropped]);

  const almostDone = useMemo(() => {
    return scopedGamesWithStats
      .map((g) => ({ game: g, c: completionMap.get(g.appid) }))
      .filter((x) => x.c && x.c.percent > 0 && x.c.percent < 100 && !db.dropped.includes(String(x.game.appid)))
      .sort((a, b) => b.c!.percent - a.c!.percent);
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
    () => db.pinned
      .map((id) => scopedGamesWithStats.find((g) => String(g.appid) === id))
      .filter((game): game is Game => Boolean(game)),
    [db.pinned, scopedGamesWithStats],
  );

  const queueGames = useMemo(
    () => db.backlog
      .map((id) => games.find((g) => String(g.appid) === id))
      .filter((game): game is Game => Boolean(game))
      .slice(0, 3),
    [db.backlog, games],
  );

  const completionOf = (game: Game) => completionMap.get(game.appid);

  const focus: FocusItem | null = useMemo(() => {
    if (pinnedGames.length > 0) {
      const game = pinnedGames[Math.min(focusIndex, pinnedGames.length - 1)];
      return { game, completion: completionMap.get(game.appid), pinned: true };
    }
    const first = almostDone[0];
    return first ? { game: first.game, completion: first.c, pinned: false } : null;
  }, [pinnedGames, focusIndex, almostDone, completionMap]);

  const focusPosition = Math.min(focusIndex, Math.max(pinnedGames.length - 1, 0));
  const others = pinnedGames.filter((_, i) => i !== focusPosition);
  const shelfGames = almostDone.filter((item) => item.game.appid !== focus?.game.appid).slice(0, 12);
  const noGames = !loading && games.length === 0;

  const query = platformQuery(platform);
  const lede: { label: string; to: string; value: number }[] = [
    { label: t('lede.goals'), to: `/library?status=all${query}`, value: stats.total },
    { label: t('lede.completed'), to: `/library?status=completed${query}`, value: stats.completed },
    { label: t.plural('lede.platinum', stats.platinums), to: '/library?status=platinum&platform=psn', value: stats.platinums },
    { label: t('lede.inProgress'), to: `/library?status=inprogress${query}`, value: stats.inProgress },
  ];
  if (stats.dropped > 0) lede.push({ label: t.plural('lede.dropped', stats.dropped), to: `/library?status=dropped${query}`, value: stats.dropped });

  const showPlatformPanel = platform !== 'all';
  const extraNumber = (offset: number) => String(4 + offset).padStart(2, '0');

  return (
    <div className="page hoje">
      <h1 className="sr-only">{t('title')}</h1>

      <div className="hoje-top">
        {loading && games.length === 0 ? (
          <p className="hoje-lede" aria-hidden="true"><span className="inline-block h-5 w-72 max-w-full bg-gray-850" /></p>
        ) : (
          <p className="hoje-lede">
            {lede.map(({ label, to, value }, index) => (
              <span key={label}>
                {index > 0 && <span className="sep" aria-hidden="true">·</span>}
                <Link to={to} className="num">{formatNumber(value)}</Link> {label}
              </span>
            ))}
          </p>
        )}
        <div className="segmented platform-filter" role="group" aria-label={t('platform.aria')}>
          {PLATFORM_KEYS.map((key) => (
            <button key={key} aria-pressed={platform === key} title={key === 'all' ? t('platform.allLong') : PLATFORM_LONG[key]}
              onClick={() => { setPlatform(key); setFocusIndex(0); }}>
              {key !== 'all' && <img src={PLATFORM_META[key].logo} alt="" />}
              {key === 'all' ? t('platform.all') : PLATFORM_SHORT[key]}
            </button>
          ))}
        </div>
      </div>

      <section aria-label={t('sections.now')}>
        <SectionHead number="01" title={t('sections.now')} />
        {focus ? (
          <NowCard
            focus={focus}
            position={focusPosition + 1}
            total={pinnedGames.length}
            others={others}
            completionOf={completionOf}
            onPrev={() => setFocusIndex((focusPosition - 1 + pinnedGames.length) % pinnedGames.length)}
            onNext={() => setFocusIndex((focusPosition + 1) % pinnedGames.length)}
            onTogglePin={togglePinned}
          />
        ) : loading ? (
          <div className="now" aria-hidden="true">
            <div className="now-art motion-safe:animate-pulse" />
          </div>
        ) : noGames ? (
          <div>
            <p className="font-display text-lg font-bold">{t('empty.title')}</p>
            <p className="lede mt-1">{t('empty.body')}</p>
            <Link to="/settings?tab=connections" className="btn btn-primary mt-3">{t('empty.connect')}</Link>
          </div>
        ) : (
          <p className="lede">{t('empty.pinHint')}</p>
        )}
      </section>

      <section aria-label={t('sections.plan')}>
        <SectionHead number="02" title={t('sections.plan')} action={<Link to="/plano" className="btn btn-ghost btn-sm">{t('sections.viewPlan')}</Link>} />
        <PlanSummary queue={queueGames} completionOf={completionOf} />
      </section>

      {loading && almostDone.length === 0 ? (
        <section>
          <SectionHead number="03" title={t('sections.almost')} />
          <div className="library-grid">{Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} portrait />)}</div>
        </section>
      ) : shelfGames.length === 0 ? (
        <section>
          <SectionHead number="03" title={t('sections.almost')} />
          <p className="lede">{almostDone.length === 0 ? t('empty.noneInProgress') : t('empty.onlyFocus')}</p>
        </section>
      ) : (
        <Shelf number="03" title={t('sections.almost')} seeAllLabel={t('sections.seeAllCount', { count: formatNumber(stats.inProgress) })}
          onSeeAll={() => navigate(`/library?status=inprogress${query}`)}>
          {shelfGames.map(({ game, c }) => (
            <LibraryCard key={game.appid} game={game} completion={c}
              isPinned={db.pinned.includes(String(game.appid))}
              onTogglePinned={togglePinned} />
          ))}
        </Shelf>
      )}

      {recentlyPlayed.length > 0 && (
        <section>
          <SectionHead number="04" title={t('sections.recent')} action={<Link to="/library?status=inprogress" className="btn btn-ghost btn-sm">{t('sections.seeAll')}</Link>} />
          <div className="ledger" role="table" aria-label={t('ledger.aria')}>
            <div className="ledger-head col-head" role="row">
              <span role="columnheader">{t('ledger.game')}</span>
              <span role="columnheader">{t('ledger.platform')}</span>
              <span role="columnheader" className="r">{t('ledger.last2Weeks')}</span>
              <span role="columnheader" className="r">{t('ledger.progress')}</span>
            </div>
            {recentlyPlayed.map((g) => {
              const c = completionMap.get(g.appid);
              const meta = g.platform ? PLATFORM_META[g.platform] : null;
              return (
                <Link key={g.appid} to={`/game/${g.appid}`} state={fromToday} className="ledger-row" role="row">
                  <span className="ledger-game" role="cell">
                    <GameCover game={g} portrait className="ledger-cover" imgClassName="object-cover" />
                    <span>{g.name}</span>
                  </span>
                  <span className="ledger-plat" role="cell">{meta && <><img src={meta.logo} alt="" />{meta.short}</>}</span>
                  <span className="ledger-time r" role="cell">{formatPlaytime(g.playtime_2weeks ?? 0)}</span>
                  <span className="ledger-prog" role="cell">
                    {c ? (
                      <>
                        <ProgressBar className="bar" percent={c.percent} />
                        <span className="v">{c.percent}%</span>
                      </>
                    ) : <span className="v ml-auto text-gray-500">—</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {showPlatformPanel && <PlatformSpecificPanel number={extraNumber(recentlyPlayed.length > 0 ? 1 : 0)} platform={platform} games={scopedGamesWithStats} />}

      {relics.length > 0 && (
        <section>
          <SectionHead number={extraNumber((recentlyPlayed.length > 0 ? 1 : 0) + (showPlatformPanel ? 1 : 0))} title={t('sections.rarities')} sub={t('sections.raritiesSub')} />
          <ul className="rarities">
            {relics.map((relic) => (
              <RarityRow key={`${relic.gameId}-${relic.achievementTitle}`} relic={relic} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
