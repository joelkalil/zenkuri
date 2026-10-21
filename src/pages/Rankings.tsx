import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GameCover } from '../components/GameCover';
import { SectionHead } from '../components/SectionHead';
import { Stamp } from '../components/Stamp';
import { useSteam } from '../context/SteamContext';
import { RANKING_CATEGORIES, type RankingCategoryId } from '../data/rankings';
import { fetchRecentCompletions, type CompletionHistoryItem } from '../lib/api';
import { hasPsnPlatinum, PLATFORM_META } from '../lib/platforms';
import type { Game, Platform } from '../types/steam';
import '../styles/rankings.css';

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
    <button onClick={() => navigate(`/game/${item.game.appid}`)} className="row group w-full px-1 text-left">
      <GameCover game={item.game} portrait className="h-14 w-10 shrink-0 rounded-sm bg-gray-800" imgClassName="object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-200 group-hover:text-violet-400">{item.game.name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          <img src={PLATFORM_META[platform].logo} alt="" className="h-3.5 w-3.5 object-contain" />
          {PLATFORM_META[platform].short}
          <span aria-hidden="true">·</span>
          <span className="num">{formatCompletionDate(item.completedAt)}</span>
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

function RecentSection({ number, title, subtitle, items }: {
  number: string;
  title: string;
  subtitle: string;
  items: CompletionHistoryItem[];
}) {
  return (
    <section>
      <SectionHead className="sh-wrap" number={number} title={title} sub={subtitle} />
      <div>
        {items.length > 0 ? items.slice(0, 5).map((item) => (
          <RecentCompletion key={`${item.kind}-${item.game.appid}`} item={item} />
        )) : (
          <p className="py-4 text-sm text-gray-500">Nenhuma conclusão sincronizada ainda.</p>
        )}
      </div>
    </section>
  );
}

function isDone(game: Game) {
  return game.completion?.percent === 100 || hasPsnPlatinum(game);
}

/** Situação do jogo na sua conta: carimbo se concluído, % se começado, traço se não. */
function Situation({ game, plain = false }: { game: Game; plain?: boolean }) {
  const percent = game.completion?.percent ?? 0;
  if (hasPsnPlatinum(game)) {
    return <span className="rk-state" data-tone="platina">{!plain && <Stamp kind="platina" size={24} seed={game.appid} />}Platina</span>;
  }
  if (percent >= 100) {
    return <span className="rk-state" data-tone="complete">{!plain && <Stamp kind="100" size={24} seed={game.appid} />}100%</span>;
  }
  if (percent > 0) return <span className="rk-state num">{percent}%</span>;
  return <span className="rk-state text-gray-500">Não iniciado</span>;
}

/** Top 3: arte larga com sobreposição chapada, posição grande e a nota da curadoria. */
function FeatureRank({ game, rank, estimate, note }: { game: Game; rank: number; estimate: string; note: string }) {
  const navigate = useNavigate();
  const [artFailed, setArtFailed] = useState(false);
  const platform = game.platform as Platform;

  return (
    <button className="feature-card" onClick={() => navigate(`/game/${game.appid}`)} aria-label={`${rank}º, ${game.name}`}>
      {game.heroUrl && !artFailed
        ? <img className="feature-art" src={game.heroUrl} alt="" onError={() => setArtFailed(true)} />
        : <GameCover game={game} className="feature-art" imgClassName="object-cover" />}
      <span className="feature-rank" aria-hidden="true">{String(rank).padStart(2, '0')}</span>
      <span className="feature-body">
        <span className="feature-title block font-display">{game.name}</span>
        <span className="feature-note">{note}</span>
        <span className="feature-meta">
          <span className="inline-flex items-center gap-1.5"><img src={PLATFORM_META[platform].logo} alt="" />{PLATFORM_META[platform].short}</span>
          <span className="num">{estimate}</span>
          <Situation game={game} plain />
        </span>
      </span>
    </button>
  );
}

function RankingRow({ game, rank, estimate, note }: { game: Game; rank: number; estimate: string; note: string }) {
  const navigate = useNavigate();
  const platform = game.platform as Platform;

  return (
    <button onClick={() => navigate(`/game/${game.appid}`)} className="rk-row">
      <span className="rk-pos">{String(rank).padStart(2, '0')}</span>
      <span className="rk-cover"><GameCover game={game} portrait className="h-full w-full" imgClassName="object-cover" /></span>
      <span className="min-w-0">
        <span className="rk-name block truncate">{game.name}</span>
        <span className="rk-note">{note}</span>
        <span className="rk-mobile-meta">
          <img src={PLATFORM_META[platform].logo} alt="" className="h-3.5 w-3.5 object-contain" />
          {PLATFORM_META[platform].short}
          <span className="num">· {estimate}</span>
        </span>
      </span>
      <span className="rk-plat rk-hide-md">
        <img src={PLATFORM_META[platform].logo} alt="" />{PLATFORM_META[platform].short}
      </span>
      <Situation game={game} />
      <span className="rk-est num text-xs text-gray-300 rk-hide-md">{estimate}</span>
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
          <span className="page-eyebrow">Curadoria externa</span>
          <h1 className="page-title">Rankings de Platina</h1>
          <p className="page-desc">Listas escolhidas à mão para decidir o próximo jogo, cruzadas com o que já está na sua biblioteca.</p>
        </div>
        <div className="page-actions">
          <Link to="/sagas" className="btn btn-secondary">Sagas: FF e RE</Link>
        </div>
      </header>

      <p className="lede">
        <span className="num">{RANKING_CATEGORIES.length}</span> listas · <span className="num">{totalEntries}</span> recomendações no total
      </p>

      <div className="tabs-bar">
        <div className="subtabs" role="tablist" aria-label="Categorias de ranking">
          {RANKING_CATEGORIES.map((category) => (
            <button key={category.id} role="tab" aria-selected={category.id === activeId} onClick={() => selectCategory(category.id)} className="subtab">
              <span className="sm:hidden">{category.shortLabel}</span>
              <span className="hidden sm:inline">{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-6" aria-labelledby="ranking-title">
          <SectionHead className="sh-wrap"
            number="01"
            title={<span id="ranking-title">{activeCategory.label}</span>}
            action={
              <span className="text-xs text-gray-500">
                Você tem <span className="num text-gray-100">{rankedGames.length}</span> de <span className="num text-gray-100">{activeCategory.entries.length}</span>
                {completedInRanking > 0 && <> · <span className="num text-gray-100">{completedInRanking}</span> {completedInRanking > 1 ? 'concluídos' : 'concluído'}</>}
              </span>
            }
          />
          <p className="lede -mt-3 max-w-3xl">{activeCategory.description}</p>

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
                <div>
                  <div className="rk-head col-head" aria-hidden="true">
                    <span>Nº</span><span /><span>Jogo</span><span>Plataforma</span><span>Sua situação</span><span className="text-right">Estimativa</span>
                  </div>
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
            <div className="h-80 animate-pulse rounded-sm bg-gray-900" />
          ) : (
            <>
              <RecentSection number="02" title="Últimas platinas" subtitle="PSN" items={history.platinums} />
              <RecentSection number="03" title="Últimos 100%" subtitle="Steam e RetroAchievements" items={history.perfects} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
