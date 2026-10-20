import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Gauge,
  Gem,
  ListChecks,
  Mountain,
  ScrollText,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { GameCover } from '../components/GameCover';
import { ProgressBar, completionTextColor } from '../components/ProgressBar';
import { useSteam } from '../context/SteamContext';
import { RANKING_CATEGORIES, type RankingCategoryId } from '../data/rankings';
import { fetchRecentCompletions, type CompletionHistoryItem } from '../lib/api';
import { hasPsnPlatinum, PLATFORM_META } from '../lib/platforms';
import type { Game, Platform } from '../types/steam';

const categoryIcons: Record<RankingCategoryId, ElementType> = {
  finish: ListChecks,
  grind: Flame,
  quick: Gauge,
  demanding: Mountain,
  essential: Gem,
};

const categoryColors: Record<RankingCategoryId, string> = {
  finish: 'text-emerald-400',
  grind: 'text-orange-400',
  quick: 'text-sky-400',
  demanding: 'text-rose-400',
  essential: 'text-amber-400',
};

function formatCompletionDate(timestamp: number) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(timestamp * 1000))
    .replace('.', '');
}

function RecentCompletion({ item }: { item: CompletionHistoryItem }) {
  const navigate = useNavigate();
  const platform = item.game.platform as Platform;
  const isPlatinum = item.kind === 'platinum';

  return (
    <button onClick={() => navigate(`/game/${item.game.appid}`)} className="list-surface-row group">
      <GameCover game={item.game} portrait className="h-14 w-10 shrink-0 rounded-md bg-gray-800" imgClassName="object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-200 group-hover:text-gray-50">{item.game.name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          <img src={PLATFORM_META[platform].logo} alt="" className="h-3.5 w-3.5 object-contain" />
          {PLATFORM_META[platform].short}
          <span aria-hidden="true">·</span>
          {formatCompletionDate(item.completedAt)}
        </span>
      </span>
      <img
        src={isPlatinum ? '/trophies/platinum.png' : '/trophies/achievement-100.png'}
        alt={isPlatinum ? 'Platina' : '100%'}
        className="h-6 w-6 shrink-0 object-contain"
      />
    </button>
  );
}

function RecentSection({ title, subtitle, items, icon: Icon, iconClass }: {
  title: string;
  subtitle: string;
  items: CompletionHistoryItem[];
  icon: ElementType;
  iconClass: string;
}) {
  return (
    <section>
      <div className="section-head">
        <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden="true" />
        <h2>{title}</h2>
        <span className="section-sub">{subtitle}</span>
      </div>
      <div className="list-surface">
        {items.length > 0 ? items.slice(0, 5).map((item) => (
          <RecentCompletion key={`${item.kind}-${item.game.appid}`} item={item} />
        )) : (
          <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma conclusão sincronizada ainda.</p>
        )}
      </div>
    </section>
  );
}

function isDone(game: Game) {
  return game.completion?.percent === 100 || hasPsnPlatinum(game);
}

/** Top 3 da lista: arte larga, posição grande e a nota da curadoria. */
function FeatureRank({ game, rank, estimate, note }: { game: Game; rank: number; estimate: string; note: string }) {
  const navigate = useNavigate();
  const [artFailed, setArtFailed] = useState(false);
  const percent = game.completion?.percent ?? 0;
  const platform = game.platform as Platform;

  return (
    <button className="feature-card" onClick={() => navigate(`/game/${game.appid}`)} aria-label={`${rank}º — ${game.name}`}>
      {game.heroUrl && !artFailed
        ? <img className="feature-art" src={game.heroUrl} alt="" onError={() => setArtFailed(true)} />
        : <GameCover game={game} className="feature-art" imgClassName="object-cover" />}
      <span className="feature-rank" aria-hidden="true">{rank}</span>
      <span className="feature-body">
        {isDone(game) && <span className="cover-badge mb-2" data-tone="done"><CheckCircle2 size={12} aria-hidden="true" />Concluído</span>}
        <span className="feature-title block">{game.name}</span>
        <span className="feature-note">{note}</span>
        <span className="feature-meta">
          <span className="inline-flex items-center gap-1.5"><img src={PLATFORM_META[platform].logo} alt="" />{PLATFORM_META[platform].short}</span>
          <span className="inline-flex items-center gap-1"><Clock3 size={12} aria-hidden="true" />{estimate}</span>
          <span className="flex min-w-24 flex-1 items-center gap-2">
            <span className="game-card-meter-track"><span className="game-card-meter-fill" data-complete={percent === 100} style={{ width: `${percent}%` }} /></span>
            <span className="font-semibold">{percent}%</span>
          </span>
        </span>
      </span>
    </button>
  );
}

function RankingRow({ game, rank, estimate, note }: { game: Game; rank: number; estimate: string; note: string }) {
  const navigate = useNavigate();
  const percent = game.completion?.percent ?? 0;
  const platform = game.platform as Platform;

  return (
    <button onClick={() => navigate(`/game/${game.appid}`)} className="rank-row group">
      <span className="rank-num">{String(rank).padStart(2, '0')}</span>
      <span className="rank-cover"><GameCover game={game} portrait className="h-full w-full" imgClassName="object-cover" /></span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-100">{game.name}</span>
          {isDone(game) && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="Concluído" />}
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{note}</span>
        <span className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500 md:hidden">
          <img src={PLATFORM_META[platform].logo} alt="" className="h-3.5 w-3.5 object-contain" />
          {PLATFORM_META[platform].short} · {estimate} · {percent}%
        </span>
      </span>
      <span className="rank-hide-sm">
        <span className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Progresso</span>
          <span className={`font-semibold tabular-nums ${completionTextColor(percent)}`}>{percent}%</span>
        </span>
        <ProgressBar percent={percent} height="h-1" />
      </span>
      <span className="rank-hide-sm text-right">
        <span className="flex items-center justify-end gap-1 text-xs font-semibold text-gray-300">
          <Clock3 className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" /> {estimate}
        </span>
        <span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-gray-500">
          <img src={PLATFORM_META[platform].logo} alt="" className="h-3.5 w-3.5 object-contain" />
          {PLATFORM_META[platform].short}
        </span>
      </span>
      <ChevronRight className="rank-hide-sm h-4 w-4 text-gray-600 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-300" aria-hidden="true" />
    </button>
  );
}

export default function Rankings() {
  const { games, loading } = useSteam();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get('category') as RankingCategoryId | null;
  const [activeId, setActiveId] = useState<RankingCategoryId>(
    RANKING_CATEGORIES.some((category) => category.id === requestedCategory) ? requestedCategory! : 'finish',
  );
  const [history, setHistory] = useState<{ platinums: CompletionHistoryItem[]; perfects: CompletionHistoryItem[] }>({
    platinums: [],
    perfects: [],
  });
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    fetchRecentCompletions(8)
      .then(setHistory)
      .finally(() => setHistoryLoading(false));
  }, []);

  const activeCategory = RANKING_CATEGORIES.find((category) => category.id === activeId)!;
  const rankedGames = useMemo(() => activeCategory.entries.flatMap((entry) => {
    const game = games.find((candidate) => candidate.platform === entry.platform && candidate.platformGameId === entry.externalId);
    return game ? [{ game, ...entry }] : [];
  }), [activeCategory, games]);

  const completedInRanking = rankedGames.filter(({ game }) => isDone(game)).length;
  const totalEntries = RANKING_CATEGORIES.reduce((sum, category) => sum + category.entries.length, 0);
  const podium = rankedGames.slice(0, 3);
  const rest = rankedGames.slice(3);

  function selectCategory(id: RankingCategoryId) {
    setActiveId(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'finish') next.delete('category');
    else next.set('category', id);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="page-eyebrow"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Curadoria da biblioteca</span>
          <h1 className="page-title">Rankings de Platina</h1>
          <p className="page-desc">Prioridades para decidir o próximo jogo sem transformar o backlog em um segundo emprego.</p>
        </div>
        <div className="page-actions">
          <span className="chip">{RANKING_CATEGORIES.length} listas</span>
          <span className="chip">{totalEntries} recomendações</span>
          <Link to="/sagas" className="btn btn-secondary"><ScrollText className="h-4 w-4" aria-hidden="true" /> Sagas: FF e RE</Link>
        </div>
      </header>

      <div className="tabs-bar">
        <div className="subtabs" role="tablist" aria-label="Categorias de ranking">
          {RANKING_CATEGORIES.map((category) => {
            const Icon = categoryIcons[category.id];
            const active = category.id === activeId;
            return (
              <button key={category.id} role="tab" aria-selected={active} onClick={() => selectCategory(category.id)} className="subtab">
                <Icon className={`h-4 w-4 ${active ? categoryColors[category.id] : ''}`} aria-hidden="true" />
                <span className="sm:hidden">{category.shortLabel}</span>
                <span className="hidden sm:inline">{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-5" aria-labelledby="ranking-title">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="ranking-title" className="text-lg font-semibold text-gray-100">{activeCategory.label}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-500">{activeCategory.description}</p>
            </div>
            <span className="text-xs text-gray-500">
              {completedInRanking > 0
                ? `${completedInRanking} já concluído${completedInRanking > 1 ? 's' : ''} · ${rankedGames.length} jogos`
                : `${rankedGames.length} jogos na mira`}
            </span>
          </div>

          {loading ? (
            <div className="feature-grid">
              {Array.from({ length: 3 }, (_, index) => <div key={index} className="feature-card animate-pulse" />)}
            </div>
          ) : (
            <>
              {podium.length > 0 && (
                <div className="feature-grid">
                  {podium.map(({ game, estimate, note }, index) => (
                    <FeatureRank key={`${activeId}-${game.appid}`} game={game} rank={index + 1} estimate={estimate} note={note} />
                  ))}
                </div>
              )}
              {rest.length > 0 && (
                <div className="list-surface">
                  {rest.map(({ game, estimate, note }, index) => (
                    <RankingRow key={`${activeId}-${game.appid}`} game={game} rank={index + 4} estimate={estimate} note={note} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <aside className="space-y-8 xl:sticky xl:top-0">
          {historyLoading ? (
            <div className="h-80 animate-pulse rounded-xl bg-gray-900" />
          ) : (
            <>
              <RecentSection title="Últimas platinas" subtitle="PSN" items={history.platinums} icon={Trophy} iconClass="text-slate-200" />
              <RecentSection title="Últimos 100%" subtitle="Steam e RA" items={history.perfects} icon={CheckCircle2} iconClass="text-emerald-400" />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
