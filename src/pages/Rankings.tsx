import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Gem,
  ListChecks,
  Mountain,
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
    <button
      onClick={() => navigate(`/game/${item.game.appid}`)}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800/45"
    >
      <GameCover
        game={item.game}
        portrait
        className="h-14 w-10 shrink-0 rounded-md bg-gray-800"
        imgClassName="object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-200 group-hover:text-white">{item.game.name}</span>
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
        className="h-7 w-7 shrink-0 object-contain"
      />
    </button>
  );
}

function RecentSection({
  title,
  subtitle,
  items,
  icon: Icon,
  iconClass,
}: {
  title: string;
  subtitle: string;
  items: CompletionHistoryItem[];
  icon: ElementType;
  iconClass: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/55">
      <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gray-800/80">
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </span>
        <div>
          <h2 className="text-sm font-bold text-gray-100">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-gray-800/80">
        {items.length > 0 ? items.slice(0, 5).map((item) => (
          <RecentCompletion key={`${item.kind}-${item.game.appid}`} item={item} />
        )) : (
          <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma conclusão sincronizada ainda.</p>
        )}
      </div>
    </section>
  );
}

function RankingRow({ game, rank, estimate, note }: { game: Game; rank: number; estimate: string; note: string }) {
  const navigate = useNavigate();
  const completion = game.completion;
  const platinum = hasPsnPlatinum(game);
  const complete = completion?.percent === 100;
  const platform = game.platform as Platform;

  return (
    <button
      onClick={() => navigate(`/game/${game.appid}`)}
      className="group grid w-full grid-cols-[2rem_3.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800/40 sm:grid-cols-[2.5rem_3.5rem_minmax(0,1fr)_7rem_5rem_1.25rem] sm:gap-4 sm:px-5"
    >
      <span className={`font-mono text-lg font-bold tabular-nums ${rank <= 3 ? 'text-violet-300' : 'text-gray-600'}`}>
        {String(rank).padStart(2, '0')}
      </span>
      <GameCover
        game={game}
        portrait
        className="h-[4.5rem] w-12 rounded-lg bg-gray-800 sm:h-20 sm:w-14"
        imgClassName="object-cover"
      />
      <span className="min-w-0 self-center">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-bold text-gray-100 sm:text-[15px]">{game.name}</span>
          {(complete || platinum) && (
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 md:flex">
              <CheckCircle2 className="h-3 w-3" /> {complete ? 'Concluído' : 'Platinado'}
            </span>
          )}
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{note}</span>
        <span className="mt-2 flex items-center gap-2 text-[11px] text-gray-500 sm:hidden">
          <img src={PLATFORM_META[platform].logo} alt="" className="h-3.5 w-3.5 object-contain" />
          {PLATFORM_META[platform].short}
          <span aria-hidden="true">·</span>
          <Clock3 className="h-3.5 w-3.5" /> {estimate}
        </span>
      </span>
      <span className="hidden sm:block">
        <span className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Progresso</span>
          <span className={`font-mono font-bold ${completionTextColor(completion?.percent ?? 0)}`}>{completion?.percent ?? 0}%</span>
        </span>
        <ProgressBar percent={completion?.percent ?? 0} height="h-1.5" />
      </span>
      <span className="hidden text-right sm:block">
        <span className="flex items-center justify-end gap-1 text-xs font-semibold text-gray-300">
          <Clock3 className="h-3.5 w-3.5 text-gray-600" /> {estimate}
        </span>
        <span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-gray-500">
          <img src={PLATFORM_META[platform].logo} alt="" className="h-3.5 w-3.5 object-contain" />
          {PLATFORM_META[platform].short}
        </span>
      </span>
      <ArrowRight className="hidden h-4 w-4 text-gray-700 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-400 sm:block" />
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

  const completedInRanking = rankedGames.filter(({ game }) => game.completion?.percent === 100 || hasPsnPlatinum(game)).length;
  const ActiveIcon = categoryIcons[activeId];

  function selectCategory(id: RankingCategoryId) {
    setActiveId(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'finish') next.delete('category');
    else next.set('category', id);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-300">
            <Sparkles className="h-4 w-4" /> Curadoria da biblioteca
          </div>
          <h1 className="heading-editorial text-2xl font-semibold text-gray-100">Rankings de Platina</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">
            Prioridades para decidir o próximo jogo sem transformar o backlog em um segundo emprego.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="rounded-full bg-gray-900 px-3 py-1.5 shadow-[inset_0_0_0_1px_var(--color-gray-800)]">5 listas</span>
          <span className="rounded-full bg-gray-900 px-3 py-1.5 shadow-[inset_0_0_0_1px_var(--color-gray-800)]">100 recomendações</span>
        </div>
      </header>

      <div className="overflow-x-auto border-b border-gray-800" role="tablist" aria-label="Categorias de ranking">
        <div className="flex min-w-max gap-1">
          {RANKING_CATEGORIES.map((category) => {
            const Icon = categoryIcons[category.id];
            const active = category.id === activeId;
            return (
              <button
                key={category.id}
                role="tab"
                aria-selected={active}
                onClick={() => selectCategory(category.id)}
                className={`relative flex items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-4 ${
                  active ? 'text-gray-100' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? categoryColors[category.id] : ''}`} />
                <span className="sm:hidden">{category.shortLabel}</span>
                <span className="hidden sm:inline">{category.label}</span>
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-violet-500" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/45">
          <div className="flex flex-col gap-3 border-b border-gray-800 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-800/80">
                <ActiveIcon className={`h-5 w-5 ${categoryColors[activeId]}`} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-100">{activeCategory.label}</h2>
                <p className="mt-0.5 max-w-3xl text-sm leading-relaxed text-gray-500">{activeCategory.description}</p>
              </div>
            </div>
            <span className="shrink-0 text-xs text-gray-500">
              {completedInRanking > 0
                ? `${completedInRanking} já concluído${completedInRanking > 1 ? 's' : ''}`
                : `${rankedGames.length} jogos na mira`}
            </span>
          </div>

          <div className="divide-y divide-gray-800/80">
            {loading ? Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-5 py-3">
                <div className="h-5 w-7 rounded bg-gray-800" />
                <div className="h-20 w-14 rounded-lg bg-gray-800" />
                <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-gray-800" /><div className="h-3 w-2/3 rounded bg-gray-800" /></div>
              </div>
            )) : rankedGames.map(({ game, estimate, note }, index) => (
              <RankingRow key={`${activeId}-${game.appid}`} game={game} rank={index + 1} estimate={estimate} note={note} />
            ))}
          </div>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-6">
          {historyLoading ? (
            <div className="h-80 animate-pulse rounded-2xl bg-gray-900/70" />
          ) : (
            <>
              <RecentSection
                title="Últimas platinas"
                subtitle="Troféus de platina na PSN"
                items={history.platinums}
                icon={Trophy}
                iconClass="text-slate-200"
              />
              <RecentSection
                title="Últimos 100%"
                subtitle="Steam e RetroAchievements"
                items={history.perfects}
                icon={CheckCircle2}
                iconClass="text-emerald-400"
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
