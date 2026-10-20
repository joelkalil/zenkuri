import { useEffect, useMemo, useRef, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Crosshair, Gem, Pin, PinOff, Target, Trophy, XCircle } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { fetchRarestUnlocked } from '../lib/api';
import type { UnlockItem } from '../types/steam';
import { completionColor, completionTextColor } from '../components/ProgressBar';
import { SkeletonCard } from '../components/SkeletonCard';
import { GameCover } from '../components/GameCover';
import { LibraryCard } from '../components/LibraryCard';
import { PLATFORM_META, type PlatformFilter, type ViewMode, platformLabel, platformStats } from '../lib/platforms';
import type { Game } from '../types/steam';

/** Bloco de número do painel: rótulo com ícone, valor grande e dica. Abre a biblioteca filtrada. */
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
    <button onClick={onClick} className="stat-tile">
      <span className="stat-tile-label"><Icon className={`h-4 w-4 ${accentText}`} aria-hidden="true" />{label}</span>
      <span className={`stat-tile-value ${valueClass}`}>{value}</span>
      <span className="stat-tile-hint truncate">{hint}</span>
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

/** Bloco de número dos painéis por plataforma — mesma linguagem do StatCell. */
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
    <div className="stat-tile">
      <span className="stat-tile-label">{leading}{label}</span>
      <span className={`stat-tile-value ${valueClass}`}>{value}</span>
      {hint && <span className="stat-tile-hint truncate">{hint}</span>}
    </div>
  );
}

const panelGrid = 'grid grid-cols-2 gap-3 lg:grid-cols-4';

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
        <div className="section-head">
          <Trophy className="h-5 w-5 text-blue-400" />
          <h2>Troféus da PSN</h2>
          <div className="segmented ml-auto" role="group" aria-label="Exibir troféus">
            {([['Obtidos', false], ['Total', true]] as const).map(([label, total]) => (
              <button key={label} onClick={() => setShowTotals(total)} aria-pressed={showTotals === total}>{label}</button>
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
        <div className="section-head">
          <img src={PLATFORM_META.steam.logo} alt="" className="h-5 w-5 object-contain" />
          <h2>Conquistas da Steam</h2>
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
        <div className="section-head">
          <img src={PLATFORM_META.retroachievements.logo} alt="" className="h-5 w-5 object-contain" />
          <h2>RetroAchievements</h2>
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

type Completion = { percent: number; unlocked: number; total: number };
interface SpotItem { game: Game; completion?: Completion; pinned: boolean }

/**
 * Destaque estilo vitrine do launcher: arte grande à esquerda e a fila de
 * candidatos à direita (fixados primeiro, depois os mais perto de 100%).
 * A troca é por clique — sem rotação automática.
 */
function Spotlight({ items, onTogglePin }: { items: SpotItem[]; onTogglePin: (appid: string) => void }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [badArt, setBadArt] = useState<string[]>([]);
  const current = items[Math.min(index, items.length - 1)];
  const { game, completion, pinned } = current;
  const meta = game.platform ? PLATFORM_META[game.platform] : null;
  const noun = game.platform === 'psn' ? 'troféus' : 'conquistas';
  const art = game.heroUrl && !badArt.includes(game.heroUrl) ? game.heroUrl : null;
  const markBad = (url: string) => setBadArt((list) => (list.includes(url) ? list : [...list, url]));

  return (
    <section className="spotlight" aria-label="Em foco">
      <div className="spotlight-hero">
        {art ? (
          <img key={art} className="spotlight-art" src={art} alt=""
            onError={() => markBad(art)}
            onLoad={(event) => { if (event.currentTarget.naturalWidth < 640) markBad(art); }} />
        ) : (
          <GameCover key={game.appid} game={game} className="spotlight-art" imgClassName="object-cover" />
        )}
        <div className="spotlight-body">
          <span className="spotlight-eyebrow">
            {pinned ? <><Pin size={12} aria-hidden="true" />Prioridade fixada</> : <><Crosshair size={12} aria-hidden="true" />Quase lá</>}
          </span>
          <h2 className="spotlight-title">{game.name}</h2>
          <div className="spotlight-meta">
            {meta && <span className="inline-flex items-center gap-1.5"><img src={meta.logo} alt="" />{meta.short}</span>}
            {completion && <span>{completion.unlocked} / {completion.total} {noun}</span>}
            {game.playtime_forever > 0 && <span>{formatPlaytime(game.playtime_forever)} jogados</span>}
          </div>
          {completion && <div className="spotlight-progress">
            <strong>{completion.percent}%</strong>
            <span className="game-card-meter-track" role="progressbar" aria-label="Conclusão do jogo" aria-valuenow={completion.percent} aria-valuemin={0} aria-valuemax={100}>
              <span className="game-card-meter-fill" data-complete={completion.percent === 100} style={{ width: `${completion.percent}%` }} />
            </span>
          </div>}
          <div className="spotlight-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate(`/game/${game.appid}`)}>Ver conquistas</button>
            <button className="btn btn-glass btn-lg btn-icon" aria-pressed={pinned} onClick={() => onTogglePin(String(game.appid))}
              aria-label={pinned ? `Desafixar ${game.name}` : `Fixar ${game.name} como prioridade`} title={pinned ? 'Desafixar' : 'Fixar como prioridade'}>
              <Pin size={18} fill={pinned ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>
      <div className="spotlight-list" role="group" aria-label="Escolher destaque">
        {items.map((item, i) => (
          <button key={item.game.appid} className="spotlight-item" aria-pressed={item === current} onClick={() => setIndex(i)}>
            <GameCover game={item.game} portrait className="bg-gray-800" imgClassName="object-cover" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2">{item.game.name}</span>
              {item.completion && <small>{item.completion.percent}% · {item.completion.unlocked}/{item.completion.total}</small>}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Prateleira horizontal com setas, como as fileiras da loja. */
function Shelf({ title, icon, onSeeAll, children }: { title: string; icon: ReactNode; onSeeAll?: () => void; children: ReactNode }) {
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
      <div className="section-head">
        {icon}
        <h2>{onSeeAll ? <button onClick={onSeeAll}>{title}<ChevronRight size={18} aria-hidden="true" /></button> : title}</h2>
        <span className="spacer" />
        <div className="shelf-arrows">
          <button onClick={() => scroll(-1)} disabled={edges.start} aria-label={`Rolar ${title} para a esquerda`}><ChevronLeft size={16} /></button>
          <button onClick={() => scroll(1)} disabled={edges.end} aria-label={`Rolar ${title} para a direita`}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div ref={trackRef} className="shelf-track" onScroll={measure}>{children}</div>
    </section>
  );
}

/** Relíquia: uma conquista rara desbloqueada, exibida como peça de coleção. */
function RelicCard({ relic }: { relic: UnlockItem }) {
  const navigate = useNavigate();
  const meta = PLATFORM_META[relic.platform];
  return (
    <button
      onClick={() => navigate(`/game/${relic.gameId}`)}
      className="group flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-gray-700"
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
      .slice(0, 12);
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

  const spotItems = useMemo(() => {
    const items: SpotItem[] = [];
    for (const id of db.pinned) {
      const game = scopedGamesWithStats.find((g) => String(g.appid) === id);
      if (game) items.push({ game, completion: completionMap.get(game.appid), pinned: true });
    }
    for (const { game, c } of almostDone) {
      if (items.length >= 5) break;
      if (!items.some((item) => item.game.appid === game.appid)) items.push({ game, completion: c, pinned: false });
    }
    return items.slice(0, 5);
  }, [db.pinned, scopedGamesWithStats, completionMap, almostDone]);

  return (
    <div className="home-page">
      <h1 className="sr-only">Painel</h1>
      <div className="home-top">
        <div className="subtabs" role="group" aria-label="Plataforma do painel">
          {(['all', 'steam', 'psn', 'retroachievements'] as PlatformFilter[]).map((item) => (
            <button
              key={item}
              className="subtab"
              aria-pressed={platform === item}
              onClick={() => {
                setPlatform(item);
                if (item === 'all') setViewMode('common');
              }}
            >
              {item !== 'all' && <img src={PLATFORM_META[item].logo} alt="" className="h-4 w-4 object-contain" />}
              {item === 'all' ? 'Todas as plataformas' : platformLabel(item)}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Tipo de visão">
          {(['common', 'platform'] as ViewMode[]).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)} aria-pressed={viewMode === mode} disabled={mode === 'platform' && platform === 'all'}
              title={mode === 'platform' && platform === 'all' ? 'Escolha uma plataforma para ver os números específicos' : undefined}>
              {mode === 'common' ? 'Comum' : 'Por plataforma'}
            </button>
          ))}
        </div>
      </div>

      {spotItems.length > 0 ? (
        <Spotlight key={platform} items={spotItems} onTogglePin={togglePinned} />
      ) : loading ? (
        <div className="spotlight"><div className="spotlight-hero animate-pulse" /></div>
      ) : null}

      <div className="stat-strip">
        <StatCell label="Targets" value={stats.total} icon={Target} accentText="text-violet-400" hint="Definidos" onClick={() => navigate(`/library?status=all${platformQuery(platform)}`)} />
        <StatCell label="100%" value={stats.completed} icon={CheckCircle2} accentText="text-emerald-400" valueClass="text-emerald-400" hint={pctHint(stats.completed)} onClick={() => navigate(`/library?status=completed${platformQuery(platform)}`)} />
        <StatCell label="Platinas" value={stats.platinums} icon={Trophy} accentText="text-amber-400" valueClass="text-amber-400" hint={pctHint(stats.platinums)} onClick={() => navigate('/library?status=platinum&platform=psn')} />
        <StatCell label="Em progresso" value={stats.inProgress} icon={Activity} accentText="text-sky-400" valueClass="text-sky-400" hint={pctHint(stats.inProgress)} onClick={() => navigate(`/library?status=inprogress${platformQuery(platform)}`)} />
        <StatCell label="Abandonados" value={stats.dropped} icon={XCircle} accentText="text-red-400" valueClass={stats.dropped > 0 ? 'text-red-400' : 'text-gray-500'} hint={pctHint(stats.dropped)} onClick={() => navigate(`/library?status=dropped${platformQuery(platform)}`)} />
      </div>

      {viewMode === 'platform' && <PlatformSpecificPanel platform={platform} games={scopedGamesWithStats} />}

      {loading && almostDone.length === 0 ? (
        <div className="library-grid">{Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} portrait />)}</div>
      ) : almostDone.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 p-8 text-center">
          <p className="text-sm text-gray-500">Analisando sua biblioteca… volte em instantes.</p>
        </div>
      ) : (
        <Shelf title="Quase lá" icon={<Crosshair className="h-5 w-5 text-emerald-400" aria-hidden="true" />} onSeeAll={() => navigate(`/library?status=inprogress${platformQuery(platform)}`)}>
          {almostDone.map(({ game, c }) => (
            <LibraryCard key={game.appid} game={game} completion={c}
              isPinned={db.pinned.includes(String(game.appid))}
              onTogglePinned={togglePinned} />
          ))}
        </Shelf>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {recentlyPlayed.length > 0 && (
          <section>
            <div className="section-head">
              <Clock3 className="h-5 w-5 text-sky-400" aria-hidden="true" />
              <h2><button onClick={() => navigate('/library?sort=recent')}>Jogados recentemente<ChevronRight size={18} aria-hidden="true" /></button></h2>
            </div>
            <div className="list-surface">
              {recentlyPlayed.map((g) => {
                const c = completionMap.get(g.appid);
                return (
                  <button key={g.appid} onClick={() => navigate(`/game/${g.appid}`)} className="list-surface-row">
                    <GameCover game={g} className="h-11 w-20 shrink-0 rounded-md bg-gray-800" imgClassName="object-cover" />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">{g.name}</p>
                    <span className="hidden shrink-0 items-center gap-1.5 text-xs text-gray-500 sm:flex">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatPlaytime(g.playtime_forever)}
                    </span>
                    <span className="hidden w-24 shrink-0 items-center gap-1.5 text-xs text-gray-500 md:flex">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      {lastPlayedDate(g)}
                    </span>
                    <div className="flex w-24 shrink-0 items-center justify-end gap-2">
                      {c ? (
                        <>
                          <div className="hidden h-1 w-10 overflow-hidden rounded-full bg-gray-800 sm:block">
                            <div className={`h-full rounded-full ${completionColor(c.percent)}`} style={{ width: `${c.percent}%` }} />
                          </div>
                          <span className={`text-xs font-semibold tabular-nums ${completionTextColor(c.percent)}`}>{c.percent}%</span>
                          {c.percent === 100 && <img src="/trophies/gold.png" alt="" className="h-4 w-4 object-contain" />}
                        </>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </div>
                  </button>
                );
              })}
              <button onClick={() => navigate('/library?sort=recent')} className="list-surface-foot">
                Ver histórico completo <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        <section>
          <div className="section-head">
            <Pin className="h-5 w-5 text-violet-400" aria-hidden="true" />
            <h2>Prioridades</h2>
            <span className="section-sub">Jogos fixados</span>
            <span className="spacer" />
            <button onClick={() => navigate('/plano')} className="btn btn-secondary h-8 px-3 text-xs">Gerenciar</button>
          </div>
          {pinnedGames.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-800 p-8 text-center">
              <Pin className="h-6 w-6 text-gray-600" aria-hidden="true" />
              <p className="text-sm text-gray-500">Fixe jogos como prioridade para vê-los aqui.</p>
            </div>
          ) : (
            <div className="list-surface">
              {pinnedGames.map((g) => {
                const c = completionMap.get(g.appid);
                const meta = g.platform ? PLATFORM_META[g.platform] : null;
                const isPsn = g.platform === 'psn';
                return (
                  <div key={g.appid} className="list-surface-row">
                    <button onClick={() => navigate(`/game/${g.appid}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <GameCover game={g} className="h-11 w-20 shrink-0 rounded-md bg-gray-800" imgClassName="object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-100">{g.name}</p>
                          {meta && (
                            <span className="flex shrink-0 items-center gap-1 rounded-md bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold text-gray-300">
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
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-800">
                          <div className={`h-full rounded-full ${completionColor(c.percent)}`} style={{ width: `${c.percent}%` }} />
                        </div>
                        <span className="w-9 text-right text-xs font-semibold tabular-nums text-gray-300">{c.percent}%</span>
                      </div>
                    )}
                    <button
                      onClick={() => togglePinned(String(g.appid))}
                      title="Desafixar"
                      aria-label={`Desafixar ${g.name}`}
                      className="icon-btn h-8 w-8 shrink-0"
                    >
                      <PinOff className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <button onClick={() => navigate('/plano')} className="list-surface-foot">
                Abrir o plano <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      </div>

      {relics.length > 0 && (
        <section>
          <div className="section-head">
            <Gem className="h-5 w-5 text-violet-400" aria-hidden="true" />
            <h2>Relíquias da coleção</h2>
            <span className="section-sub">Suas conquistas mais raras entre todos os jogadores</span>
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
