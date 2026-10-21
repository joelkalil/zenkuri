import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ChevronLeft, Pin } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useI18n, useT } from '../i18n';
import { useGameDetails } from '../hooks/useSteamApi';
import { useLocalDb } from '../hooks/useLocalDb';
import { selectNextEasiest } from '../hooks/useNextEasiest';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useGameNotes } from '../hooks/useGameNotes';
import { AchievementList } from '../components/AchievementList';
import { ProgressBar } from '../components/ProgressBar';
import { SectionHead } from '../components/SectionHead';
import { SkeletonRow } from '../components/SkeletonCard';
import { GameCover } from '../components/GameCover';
import { PersonalNoteEditor } from '../components/PersonalNoteEditor';
import { Stamp } from '../components/Stamp';
import { PLATFORM_META, hasPsnPlatinum, psnTrophyBreakdown } from '../lib/platforms';
import { formatMinutes } from '../lib/planDates';
import type { AchievementWithStatus, EffortLevel, Game, Platform } from '../types/steam';
import '../styles/jogo.css';

type TrophyFilter = 'all' | 'earned' | 'locked';
type TrophySort = 'default' | 'rarity' | 'date' | 'name';

/** Trophy tier as a rarity proxy (rarest first); PSN has no per-trophy earn-rate in our data. */
const TIER_RANK: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

const EFFORT_OPTIONS: EffortLevel[] = ['easy', 'medium', 'hard', 'grind'];

const TROPHY_ROWS = [
  { key: 'platinum', icon: '/trophies/platinum.png' },
  { key: 'gold', icon: '/trophies/gold.png' },
  { key: 'silver', icon: '/trophies/silver.png' },
  { key: 'bronze', icon: '/trophies/bronze.png' },
] as const;

const DETAIL_TAB = { TROPHIES: 'trophies', STATS: 'stats', ACTIVITY: 'activity' } as const;
type DetailTab = (typeof DETAIL_TAB)[keyof typeof DETAIL_TAB];

interface BackTarget { to: string; label: string }

/** Navigation origin (state.from), falling back to the Library. */
function backTarget(state: unknown, fallbackLabel: string): BackTarget {
  const from = (state as { from?: Partial<BackTarget> } | null)?.from;
  return typeof from?.to === 'string' && typeof from.label === 'string' ? { to: from.to, label: from.label } : { to: '/library', label: fallbackLabel };
}

function platformName(platform?: string) {
  if (platform === 'retroachievements' || platform === 'psn' || platform === 'steam') return PLATFORM_META[platform].label;
  return 'Steam';
}

function isoDay(ts: number): string {
  const date = new Date(ts * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function PlatformLabel({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform];
  return <span className="plat"><img src={meta.logo} alt="" />{meta.short}</span>;
}

function SelectControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className="field">
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function StatsPanel({ game, achievements }: { game: Game; achievements: AchievementWithStatus[] }) {
  const t = useT('game');
  const cells: { label: string; value: string }[] = [];
  if (game.platform === 'retroachievements') {
    const points = achievements.reduce((s, a) => s + (a.achieved ? Number(a.points ?? 0) : 0), 0);
    const totalPoints = achievements.reduce((s, a) => s + Number(a.points ?? 0), 0);
    cells.push(
      { label: t('stats.points'), value: `${points}/${totalPoints}` },
      { label: t('stats.hardcore'), value: `${game.completion?.percent ?? 0}%` },
      { label: t('stats.achievements'), value: String(achievements.length) },
    );
  } else {
    cells.push(
      { label: t('stats.completion'), value: `${game.completion?.percent ?? 0}%` },
      { label: game.platform === 'psn' ? t('stats.trophies') : t('stats.achievements'), value: `${game.completion?.unlocked ?? 0}/${game.completion?.total ?? 0}` },
      { label: t('stats.playtime'), value: game.playtime_forever > 0 ? formatMinutes(game.playtime_forever) : '—' },
    );
  }
  return (
    <section>
      <SectionHead number="01" title={t('stats.title')} />
      <dl className="stat-list">
        {cells.map((cell) => (
          <div key={cell.label} className="ficha-row">
            <dt>{cell.label}</dt>
            <dd className="num">{cell.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function GameDetail() {
  const t = useT('game');
  const tLibrary = useT('library');
  const { formatDate, formatNumber } = useI18n();
  const { appid } = useParams<{ appid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const back = backTarget(location.state, tLibrary('title.library'));
  const numId = appid ? Number(appid) : null;
  const isWide = useMediaQuery('(min-width: 1100px)');

  const { games, completionMap } = useSteam();
  const game = useMemo(() => games.find((g) => g.appid === numId), [games, numId]);
  const siblingGames = useMemo(
    () => game ? games.filter((item) => item.groupId === game.groupId && item.appid !== game.appid) : [],
    [games, game],
  );

  const { data, loading, error } = useGameDetails(numId);
  const gameNotes = useGameNotes();
  const { db, toggleBacklog, togglePinned, toggleDropped, setNote, setGuide, setEffort, setSchedule, setCollection, createCollection } = useLocalDb();

  const appStr = String(numId);
  const inBacklog = db.backlog.includes(appStr);
  const isPinned = db.pinned.includes(appStr);
  const isDropped = db.dropped.includes(appStr);
  const effort = db.effort[appStr];
  const schedule = (db.schedule[appStr] ?? '').slice(0, 7); // always a month (YYYY-MM); old daily values are truncated
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
  const [tab, setTab] = useState<DetailTab>(DETAIL_TAB.TROPHIES);
  const [lowResHero, setLowResHero] = useState<string | null>(null);
  const [trophyFilter, setTrophyFilter] = useState<TrophyFilter>('all');
  const [trophySort, setTrophySort] = useState<TrophySort>('default');

  const isPsn = game?.platform === 'psn';
  const noun = isPsn ? 'trophies' : 'achievements';

  function fmtDate(ts: number): string {
    if (!ts) return '';
    return formatDate(ts * 1000, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  const breakdown = psnTrophyBreakdown(game);

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
  const nextThree = useMemo(() => selectNextEasiest(data?.merged ?? []), [data]);

  /** Completion stamp: platinum (PSN) or 100%, dated with the last unlock. */
  const stamp = useMemo(() => {
    const platinum = Boolean(game && hasPsnPlatinum(game));
    if (!platinum && displayPercent < 100) return null;
    const merged = data?.merged ?? [];
    const platinumTrophy = merged.find((a) => a.type === 'platinum' && a.achieved && a.unlocktime > 0);
    const last = merged.reduce((max, a) => (a.achieved && a.unlocktime > max ? a.unlocktime : max), 0);
    const ts = (platinum ? platinumTrophy?.unlocktime : undefined) ?? last;
    return { kind: platinum ? ('platina' as const) : ('100' as const), date: ts > 0 ? isoDay(ts) : undefined };
  }, [game, data, displayPercent]);

  const pointsLine = useMemo(() => {
    if (game?.platform !== 'retroachievements') return null;
    const merged = data?.merged ?? [];
    const earned = merged.reduce((s, a) => s + (a.achieved ? Number(a.points ?? 0) : 0), 0);
    const total = merged.reduce((s, a) => s + Number(a.points ?? 0), 0);
    return `${earned}/${total}`;
  }, [game, data]);

  function saveNote() { setNote(appStr, noteText); }
  function saveGuide() { setGuide(appStr, guideText); }

  const heroArt = game?.heroUrl && game.heroUrl !== lowResHero ? game.heroUrl : null;
  const title = game?.name ?? t('fallbackTitle', { id: appid ?? '' });
  const trophyCountLabel = trophyFilter === 'all' ? displayTotal : trophyFilter === 'earned' ? earnedCount : displayTotal - earnedCount;

  return (
    <div className="page jogo">
      <Link to={back.to} className="crumb"><ChevronLeft size={14} aria-hidden="true" />{back.label}</Link>

      <header className="jogo-head" data-stamp={Boolean(stamp)} aria-label={t('summaryLabel')}>
        {/* art that is too small looks blurry when stretched; a plain background is better */}
        {heroArt && <img className="jogo-backdrop" src={heroArt} alt="" onLoad={(e) => { if (e.currentTarget.naturalWidth < 640) setLowResHero(heroArt); }} onError={() => setLowResHero(heroArt)} />}
        {game && (
          <div className="jogo-cover">
            <GameCover game={game} portrait className="h-full w-full" imgClassName="object-cover" />
          </div>
        )}
        <div className="jogo-main">
          <h1 className="jogo-title" title={title}>{title}</h1>
          <div className="jogo-sub">
            {game?.platform && <PlatformLabel platform={game.platform} />}
            {siblingGames.length > 0 && (
              <div className="segmented" role="group" aria-label={t('switchPlatform')}>
                <button aria-pressed="true">{platformName(game?.platform)}</button>
                {siblingGames.map((sibling) => (
                  <button key={sibling.appid} aria-pressed="false" onClick={() => navigate(`/game/${sibling.appid}`, { state: location.state })}>
                    {platformName(sibling.platform)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="jogo-actions">
          <button onClick={() => togglePinned(appStr)} className="btn btn-secondary btn-sm" aria-pressed={isPinned}>
            <Pin className="h-3.5 w-3.5" fill={isPinned ? 'currentColor' : 'none'} aria-hidden="true" />
            {isPinned ? t('actions.pinned') : t('actions.pin')}
          </button>
          <button onClick={() => toggleBacklog(appStr)} className="btn btn-secondary btn-sm" aria-pressed={inBacklog}>
            {inBacklog ? t('actions.inQueue') : t('actions.addToPlan')}
          </button>
          <button onClick={() => toggleDropped(appStr)} className={`btn btn-secondary btn-sm ${isDropped ? 'is-danger' : ''}`} aria-pressed={isDropped}>
            {isDropped ? t('actions.dropped') : t('actions.drop')}
          </button>
          {guideText && <a href={guideText} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">{t('actions.openGuide')}</a>}
        </div>
        {stamp && (
          <div className="jogo-stamp">
            <Stamp kind={stamp.kind} date={stamp.date} size={isWide ? 96 : 48} seed={appStr} />
          </div>
        )}
        <div className="jogo-numbers">
          <p className="jogo-lede">
            <span className="jogo-pct">{displayPercent}%</span>
            <span className="num">{displayUnlocked}/{displayTotal}</span>
            {game && game.playtime_forever > 0 && <span className="num">{formatMinutes(game.playtime_forever)}</span>}
          </p>
          <ProgressBar className="bar" percent={displayPercent} />
        </div>
      </header>

      <div className="jogo-tabs">
        <div className="subtabs" role="tablist" aria-label={t('tabs.label')}>
          {([
            [DETAIL_TAB.TROPHIES, t(`tabs.${noun}`)],
            [DETAIL_TAB.STATS, t('tabs.stats')],
            [DETAIL_TAB.ACTIVITY, t('tabs.activity')],
          ] as const).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className="subtab">{label}</button>
          ))}
        </div>
        {tab === DETAIL_TAB.TROPHIES && (
          <div className="jogo-filters">
            <SelectControl
              label={t('filters.stateLabel')}
              value={trophyFilter}
              onChange={setTrophyFilter}
              options={[
                { value: 'all', label: t('filters.all') },
                { value: 'earned', label: isPsn ? t('filters.earnedMasc') : t('filters.earnedFem') },
                { value: 'locked', label: isPsn ? t('filters.lockedMasc') : t('filters.lockedFem') },
              ]}
            />
            <SelectControl
              label={t('filters.sortLabel')}
              value={trophySort}
              onChange={setTrophySort}
              options={[
                { value: 'default', label: t('filters.sortDefault') },
                { value: 'rarity', label: t('filters.sortRarity') },
                { value: 'date', label: t('filters.sortDate') },
                { value: 'name', label: t('filters.sortName') },
              ]}
            />
          </div>
        )}
      </div>

      <div className="jogo-layout">
        <div className="jogo-body">
          {error && <p role="alert" className="py-2 text-sm text-zk-danger">{error}</p>}

          {tab === DETAIL_TAB.TROPHIES && (
            <>
              {nextThree.length > 0 && displayPercent < 100 && (
                <section>
                  <SectionHead number="01" title={t('next3.title')} sub={t('next3.sub')} />
                  <ol className="jogo-next">
                    {nextThree.map((a, index) => (
                      <li key={a.name} className="trophy-row">
                        <span className="n r">{index + 1}</span>
                        <img src={a.icongray || a.icon} alt="" className="trophy-img" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
                        <span className="min-w-0">
                          <span className="trophy-name">{a.displayName || a.name}</span>
                          {a.description && <span className="trophy-desc">{a.description}</span>}
                        </span>
                        <span className="num r">
                          {typeof a.rarity === 'number' && a.rarity > 0
                            ? `${formatNumber(a.rarity, { maximumFractionDigits: 1 })}%`
                            : typeof a.points === 'number' && a.points > 0 ? t('points', { count: a.points }) : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs text-gray-500">{t(`nouns.${noun}.rarityHint`)}</p>
                </section>
              )}
              <section>
                <SectionHead
                  number={nextThree.length > 0 && displayPercent < 100 ? '02' : '01'}
                  title={t(`nouns.${noun}.${trophyFilter === 'all' ? 'all' : trophyFilter === 'earned' ? 'earned' : 'locked'}`)}
                  sub={<span className="num">{trophyCountLabel}</span>}
                />
                {loading ? (
                  <div>{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
                ) : data ? (
                  <AchievementList achievements={visibleTrophies} platform={game?.platform} />
                ) : (
                  <p className="py-4 text-sm text-gray-500">{t(`nouns.${noun}.loading`)}</p>
                )}
              </section>
            </>
          )}

          {tab === DETAIL_TAB.STATS && game && <StatsPanel game={game} achievements={data?.merged ?? []} />}

          {tab === DETAIL_TAB.ACTIVITY && (
            <section>
              <SectionHead number="01" title={t('activity.title')} sub={t('activity.sub')} />
              {activity.length === 0 ? (
                <div className="py-8">
                  <p className="font-display text-base font-bold text-gray-100">{t('activity.emptyTitle')}</p>
                  <p className="mt-1 text-sm text-gray-400">{t('activity.emptyBody')}</p>
                </div>
              ) : (
                <ul className="jogo-activity">
                  {activity.slice(0, 30).map((a) => (
                    <li key={a.name}>
                      <img src={a.icon} alt="" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
                      <span className="trophy-name">{a.displayName || a.name}</span>
                      <span className="num text-xs text-gray-400">{fmtDate(a.unlocktime)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="ficha" aria-label={t('sheet.label')}>
          <details open={isWide}>
            <summary className="ficha-summary"><span className="num text-gray-600">03 ·</span><span className="font-display text-xl font-bold">{t('sheet.summary')}</span></summary>
            <div className="ficha-body">
              <div>
                <h2 className="ficha-title micro">{t('sheet.title')}</h2>
                <dl>
                  <div className="ficha-row">
                    <dt>{t('sheet.platform')}</dt>
                    <dd>{game?.platform ? <span className="plat"><img src={PLATFORM_META[game.platform].logo} alt="" />{platformName(game.platform)}</span> : '—'}</dd>
                  </div>
                  {game?.relatedPlatforms && game.relatedPlatforms.length > 0 && (
                    <div className="ficha-row">
                      <dt>{t('sheet.alsoOn')}</dt>
                      <dd>{game.relatedPlatforms.map(platformName).join(', ')}<span className="hint">{t('sheet.ownGoal')}</span></dd>
                    </div>
                  )}
                  {game && game.playtime_forever > 0 && (
                    <div className="ficha-row"><dt>{t('sheet.playtime')}</dt><dd className="num">{formatMinutes(game.playtime_forever)}</dd></div>
                  )}
                  {pointsLine && <div className="ficha-row"><dt>{t('sheet.points')}</dt><dd className="num">{pointsLine}</dd></div>}
                  {breakdown && (
                    <div className="ficha-row">
                      <dt>{t('sheet.byType')}</dt>
                      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {TROPHY_ROWS.map((row) => {
                          const b = breakdown[row.key];
                          const rowLabel = t(`trophyTypes.${row.key}`);
                          return (
                            <span key={row.key} className="inline-flex items-center gap-1" title={`${rowLabel}: ${b.earned}/${b.total}`}>
                              <img src={row.icon} alt={rowLabel} className="h-4 w-4 object-contain" />
                              <span className="num">{b.earned}</span>
                            </span>
                          );
                        })}
                      </dd>
                    </div>
                  )}
                  <div className="ficha-row">
                    <dt>{t('sheet.effort')}</dt>
                    <dd>
                      <div className="segmented" role="group" aria-label={t('sheet.effort')}>
                        {EFFORT_OPTIONS.map((opt) => (
                          <button key={opt} onClick={() => setEffort(appStr, opt)} aria-pressed={effort === opt}>{t(`effort.${opt}`)}</button>
                        ))}
                      </div>
                    </dd>
                  </div>
                  {inBacklog && (
                    <div className="ficha-row">
                      <dt><label htmlFor="detail-schedule">{t('sheet.monthlyPlatinum')}</label></dt>
                      <dd><input id="detail-schedule" type="month" value={schedule} onChange={(e) => setSchedule(appStr, e.target.value)} className="field" /></dd>
                    </div>
                  )}
                  <div className="ficha-row">
                    <dt><label htmlFor="detail-collection">{t('sheet.collection')}</label></dt>
                    <dd>
                      <select
                        id="detail-collection"
                        value={collectionId ?? ''}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            const name = window.prompt(t('sheet.collectionPrompt'))?.trim();
                            if (name) createCollection(name, [appStr]);
                          } else {
                            setCollection(appStr, e.target.value ? Number(e.target.value) : null);
                          }
                        }}
                        className="field cursor-pointer"
                      >
                        <option value="">{t('sheet.collectionNone')}</option>
                        {db.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value="__new__">{t('sheet.collectionNew')}</option>
                      </select>
                    </dd>
                  </div>
                  <div className="ficha-row">
                    <dt><label htmlFor="detail-guide">{t('sheet.guide')}</label></dt>
                    <dd><input id="detail-guide" type="url" value={guideText} onChange={(e) => setGuideText(e.target.value)} onBlur={saveGuide} placeholder="https://..." className="field" /></dd>
                  </div>
                </dl>
              </div>

              <div className="ficha-notes">
                <h2 className="ficha-title micro"><label htmlFor="detail-notes">{t('sheet.notes')}</label></h2>
                <textarea id="detail-notes" value={noteText} onChange={(e) => setNoteText(e.target.value)} onBlur={saveNote} rows={5}
                  placeholder={t('sheet.notesPlaceholder')} className="field" />
                <button onClick={saveNote} className="btn btn-secondary btn-sm mt-2">{t('sheet.saveNote')}</button>
              </div>

              {game && !gameNotes.loading && (
                <PersonalNoteEditor
                  key={game.id}
                  gameId={game.id}
                  note={gameNotes.notes.get(game.id)}
                  onSave={gameNotes.save}
                  onDelete={gameNotes.remove}
                />
              )}
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
