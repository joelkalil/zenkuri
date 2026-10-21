import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ChevronLeft, Pin } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useGameDetails } from '../hooks/useSteamApi';
import { useLocalDb } from '../hooks/useLocalDb';
import { selectNextEasiest } from '../hooks/useNextEasiest';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { AchievementList } from '../components/AchievementList';
import { ProgressBar } from '../components/ProgressBar';
import { SectionHead } from '../components/SectionHead';
import { SkeletonRow } from '../components/SkeletonCard';
import { GameCover } from '../components/GameCover';
import { Stamp } from '../components/Stamp';
import { PLATFORM_META, hasPsnPlatinum, psnTrophyBreakdown } from '../lib/platforms';
import { formatMinutes } from '../lib/planDates';
import type { AchievementWithStatus, EffortLevel, Game, Platform } from '../types/steam';
import '../styles/jogo.css';

type TrophyFilter = 'all' | 'earned' | 'locked';
type TrophySort = 'default' | 'rarity' | 'date' | 'name';

/** Trophy tier as a rarity proxy (rarest first); PSN has no per-trophy earn-rate in our data. */
const TIER_RANK: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

const percentFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const EFFORT_OPTIONS: { key: EffortLevel; label: string }[] = [
  { key: 'easy', label: 'Fácil' },
  { key: 'medium', label: 'Médio' },
  { key: 'hard', label: 'Difícil' },
  { key: 'grind', label: 'Insano' },
];

const TROPHY_ROWS = [
  { key: 'platinum', label: 'Platina', icon: '/trophies/platinum.png' },
  { key: 'gold', label: 'Ouro', icon: '/trophies/gold.png' },
  { key: 'silver', label: 'Prata', icon: '/trophies/silver.png' },
  { key: 'bronze', label: 'Bronze', icon: '/trophies/bronze.png' },
] as const;

const DETAIL_TAB = { TROPHIES: 'trophies', STATS: 'stats', ACTIVITY: 'activity' } as const;
type DetailTab = (typeof DETAIL_TAB)[keyof typeof DETAIL_TAB];

interface BackTarget { to: string; label: string }

/** Origem da navegação (state.from) com fallback para a Biblioteca. */
function backTarget(state: unknown): BackTarget {
  const from = (state as { from?: Partial<BackTarget> } | null)?.from;
  return typeof from?.to === 'string' && typeof from.label === 'string' ? { to: from.to, label: from.label } : { to: '/library', label: 'Biblioteca' };
}

function platformName(platform?: string) {
  if (platform === 'retroachievements' || platform === 'psn' || platform === 'steam') return PLATFORM_META[platform].label;
  return 'Steam';
}

function fmtDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short', day: 'numeric' });
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
  const cells: { label: string; value: string }[] = [];
  if (game.platform === 'retroachievements') {
    const points = achievements.reduce((s, a) => s + (a.achieved ? Number(a.points ?? 0) : 0), 0);
    const totalPoints = achievements.reduce((s, a) => s + Number(a.points ?? 0), 0);
    cells.push(
      { label: 'Pontos', value: `${points}/${totalPoints}` },
      { label: 'Progresso hardcore', value: `${game.completion?.percent ?? 0}%` },
      { label: 'Conquistas', value: String(achievements.length) },
    );
  } else {
    cells.push(
      { label: 'Conclusão', value: `${game.completion?.percent ?? 0}%` },
      { label: game.platform === 'psn' ? 'Troféus' : 'Conquistas', value: `${game.completion?.unlocked ?? 0}/${game.completion?.total ?? 0}` },
      { label: 'Tempo de jogo', value: game.playtime_forever > 0 ? formatMinutes(game.playtime_forever) : '—' },
    );
  }
  return (
    <section>
      <SectionHead number="01" title="Estatísticas" />
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
  const { appid } = useParams<{ appid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const back = backTarget(location.state);
  const numId = appid ? Number(appid) : null;
  const isWide = useMediaQuery('(min-width: 1100px)');

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
  const [tab, setTab] = useState<DetailTab>(DETAIL_TAB.TROPHIES);
  const [lowResHero, setLowResHero] = useState<string | null>(null);
  const [trophyFilter, setTrophyFilter] = useState<TrophyFilter>('all');
  const [trophySort, setTrophySort] = useState<TrophySort>('default');

  const isPsn = game?.platform === 'psn';
  const nouns = isPsn
    ? { tab: 'Troféus', all: 'Todos os troféus', earned: 'Troféus obtidos', locked: 'Troféus bloqueados', lower: 'troféus' }
    : { tab: 'Conquistas', all: 'Todas as conquistas', earned: 'Conquistas obtidas', locked: 'Conquistas bloqueadas', lower: 'conquistas' };
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

  /** Carimbo de conclusão: platina (PSN) ou 100%, com a data do último desbloqueio. */
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
  const title = game?.name ?? `App ${appid}`;
  const trophyCountLabel = trophyFilter === 'all' ? displayTotal : trophyFilter === 'earned' ? earnedCount : displayTotal - earnedCount;

  return (
    <div className="page jogo">
      <Link to={back.to} className="crumb"><ChevronLeft size={14} aria-hidden="true" />{back.label}</Link>

      <header className="jogo-head" data-stamp={Boolean(stamp)} aria-label="Resumo do jogo">
        {/* arte pequena demais fica borrada esticada; melhor o fundo liso */}
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
              <div className="segmented" role="group" aria-label="Trocar de plataforma">
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
            {isPinned ? 'Fixado' : 'Fixar'}
          </button>
          <button onClick={() => toggleBacklog(appStr)} className="btn btn-secondary btn-sm" aria-pressed={inBacklog}>
            {inBacklog ? 'Na fila' : 'Adicionar ao plano'}
          </button>
          <button onClick={() => toggleDropped(appStr)} className={`btn btn-secondary btn-sm ${isDropped ? 'is-danger' : ''}`} aria-pressed={isDropped}>
            {isDropped ? 'Abandonado' : 'Abandonar'}
          </button>
          {guideText && <a href={guideText} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Abrir guia</a>}
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
        <div className="subtabs" role="tablist" aria-label="Seções do jogo">
          {([
            [DETAIL_TAB.TROPHIES, nouns.tab],
            [DETAIL_TAB.STATS, 'Estatísticas'],
            [DETAIL_TAB.ACTIVITY, 'Atividade'],
          ] as const).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className="subtab">{label}</button>
          ))}
        </div>
        {tab === DETAIL_TAB.TROPHIES && (
          <div className="jogo-filters">
            <SelectControl
              label="Filtrar por estado"
              value={trophyFilter}
              onChange={setTrophyFilter}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'earned', label: isPsn ? 'Obtidos' : 'Obtidas' },
                { value: 'locked', label: isPsn ? 'Bloqueados' : 'Bloqueadas' },
              ]}
            />
            <SelectControl
              label="Ordenar"
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

      <div className="jogo-layout">
        <div className="jogo-body">
          {error && <p role="alert" className="py-2 text-sm text-zk-danger">{error}</p>}

          {tab === DETAIL_TAB.TROPHIES && (
            <>
              {nextThree.length > 0 && displayPercent < 100 && (
                <section>
                  <SectionHead number="01" title="Próximos 3" sub="as mais fáceis entre as restantes" />
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
                            ? `${percentFormat.format(a.rarity)}%`
                            : typeof a.points === 'number' && a.points > 0 ? `${a.points} pts` : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs text-gray-500">A porcentagem indica quantos jogadores já têm cada {isPsn ? 'troféu' : 'conquista'}.</p>
                </section>
              )}
              <section>
                <SectionHead
                  number={nextThree.length > 0 && displayPercent < 100 ? '02' : '01'}
                  title={trophyFilter === 'all' ? nouns.all : trophyFilter === 'earned' ? nouns.earned : nouns.locked}
                  sub={<span className="num">{trophyCountLabel}</span>}
                />
                {loading ? (
                  <div>{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
                ) : data ? (
                  <AchievementList achievements={visibleTrophies} platform={game?.platform} />
                ) : (
                  <p className="py-4 text-sm text-gray-500">Carregando {nouns.lower}…</p>
                )}
              </section>
            </>
          )}

          {tab === DETAIL_TAB.STATS && game && <StatsPanel game={game} achievements={data?.merged ?? []} />}

          {tab === DETAIL_TAB.ACTIVITY && (
            <section>
              <SectionHead number="01" title="Atividade" sub="as últimas 30 conquistas obtidas" />
              {activity.length === 0 ? (
                <div className="py-8">
                  <p className="font-display text-base font-bold text-gray-100">Nenhuma atividade ainda</p>
                  <p className="mt-1 text-sm text-gray-400">As conquistas desbloqueadas aparecem aqui, da mais recente para a mais antiga.</p>
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

        <aside className="ficha" aria-label="Ficha do jogo">
          <details open={isWide}>
            <summary className="ficha-summary"><span className="num text-gray-600">03 ·</span><span className="font-display text-xl font-bold">Ficha e notas</span></summary>
            <div className="ficha-body">
              <div>
                <h2 className="ficha-title micro">Ficha</h2>
                <dl>
                  <div className="ficha-row">
                    <dt>Plataforma</dt>
                    <dd>{game?.platform ? <span className="plat"><img src={PLATFORM_META[game.platform].logo} alt="" />{platformName(game.platform)}</span> : '—'}</dd>
                  </div>
                  {game?.relatedPlatforms && game.relatedPlatforms.length > 0 && (
                    <div className="ficha-row">
                      <dt>Também em</dt>
                      <dd>{game.relatedPlatforms.map(platformName).join(', ')}<span className="hint">Cada plataforma mantém sua própria meta.</span></dd>
                    </div>
                  )}
                  {game && game.playtime_forever > 0 && (
                    <div className="ficha-row"><dt>Tempo de jogo</dt><dd className="num">{formatMinutes(game.playtime_forever)}</dd></div>
                  )}
                  {pointsLine && <div className="ficha-row"><dt>Pontos</dt><dd className="num">{pointsLine}</dd></div>}
                  {breakdown && (
                    <div className="ficha-row">
                      <dt>Por tipo</dt>
                      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {TROPHY_ROWS.map((row) => {
                          const b = breakdown[row.key];
                          return (
                            <span key={row.key} className="inline-flex items-center gap-1" title={`${row.label}: ${b.earned}/${b.total}`}>
                              <img src={row.icon} alt={row.label} className="h-4 w-4 object-contain" />
                              <span className="num">{b.earned}</span>
                            </span>
                          );
                        })}
                      </dd>
                    </div>
                  )}
                  <div className="ficha-row">
                    <dt>Esforço</dt>
                    <dd>
                      <div className="segmented" role="group" aria-label="Esforço">
                        {EFFORT_OPTIONS.map((opt) => (
                          <button key={opt.key} onClick={() => setEffort(appStr, opt.key)} aria-pressed={effort === opt.key}>{opt.label}</button>
                        ))}
                      </div>
                    </dd>
                  </div>
                  {inBacklog && (
                    <div className="ficha-row">
                      <dt><label htmlFor="detail-schedule">Platina do mês</label></dt>
                      <dd><input id="detail-schedule" type="month" value={schedule} onChange={(e) => setSchedule(appStr, e.target.value)} className="field" /></dd>
                    </div>
                  )}
                  <div className="ficha-row">
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
                  <div className="ficha-row">
                    <dt><label htmlFor="detail-guide">Guia</label></dt>
                    <dd><input id="detail-guide" type="url" value={guideText} onChange={(e) => setGuideText(e.target.value)} onBlur={saveGuide} placeholder="https://..." className="field" /></dd>
                  </div>
                </dl>
              </div>

              <div className="ficha-notes">
                <h2 className="ficha-title micro"><label htmlFor="detail-notes">Notas pessoais</label></h2>
                <textarea id="detail-notes" value={noteText} onChange={(e) => setNoteText(e.target.value)} onBlur={saveNote} rows={5}
                  placeholder="Dicas, estratégias, problemas conhecidos…" className="field" />
                <button onClick={saveNote} className="btn btn-secondary btn-sm mt-2">Salvar nota</button>
              </div>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
