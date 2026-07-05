import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Trophy } from 'lucide-react';
import { fetchRecentCompletions, type CompletionHistoryItem } from '../lib/api';
import { GameCover } from '../components/GameCover';
import { SkeletonCard } from '../components/SkeletonCard';
import { PLATFORM_META } from '../lib/platforms';

type HallFilter = 'all' | 'platinum' | 'perfect';

const FILTERS: { key: HallFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'platinum', label: 'Platinas' },
  { key: 'perfect', label: '100%' },
];

function completionDate(item: CompletionHistoryItem) {
  return new Date(item.completedAt * 1000).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Pôster de coleção: capa emoldurada, selo, número de ordem e data da conquista. */
function HallPoster({ item, order }: { item: CompletionHistoryItem; order: number }) {
  const navigate = useNavigate();
  const meta = item.game.platform ? PLATFORM_META[item.game.platform] : null;
  const seal = item.kind === 'platinum' ? '/trophies/platinum.png' : '/trophies/achievement-100.png';
  const sealLabel = item.kind === 'platinum' ? 'Platina' : '100% das conquistas';

  return (
    <article className="group overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 transition-colors hover:border-violet-500/50">
      <button onClick={() => navigate(`/game/${item.game.appid}`)} className="block w-full text-left">
        <div className="relative m-3 mb-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-800">
          <div className="aspect-[3/4]">
            <GameCover
              game={item.game}
              portrait
              className="h-full w-full"
              imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
          <span
            title={sealLabel}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 backdrop-blur-sm"
          >
            <img src={seal} alt={sealLabel} className="h-5 w-5 object-contain" />
          </span>
        </div>
        <div className="p-4">
          <p className="font-display text-[11px] font-medium uppercase tracking-[0.14em] text-gray-600">
            Nº {String(order).padStart(2, '0')}{meta ? ` · ${meta.short}` : ''}
          </p>
          <p className="mt-1 line-clamp-2 font-display font-semibold leading-snug text-gray-100">{item.game.name}</p>
          <p className="mt-1.5 text-xs text-gray-500">{completionDate(item)}</p>
        </div>
      </button>
    </article>
  );
}

export default function Hall() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CompletionHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HallFilter>('all');

  useEffect(() => {
    fetchRecentCompletions(500)
      .then(({ platinums, perfects }) => setItems([...platinums, ...perfects]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar o hall'));
  }, []);

  /** Ordem de coleção: o primeiro jogo concluído da vida é o Nº 01. */
  const numbered = useMemo(() => {
    if (!items) return null;
    const asc = [...items].sort((a, b) => a.completedAt - b.completedAt);
    const orderByKey = new Map(asc.map((item, index) => [`${item.game.appid}-${item.kind}`, index + 1]));
    return [...items]
      .sort((a, b) => b.completedAt - a.completedAt)
      .map((item) => ({ item, order: orderByKey.get(`${item.game.appid}-${item.kind}`) ?? 0 }));
  }, [items]);

  const visible = useMemo(
    () => (numbered ?? []).filter(({ item }) => filter === 'all' || item.kind === filter),
    [numbered, filter],
  );

  const counts = useMemo(() => {
    const platinum = items?.filter((item) => item.kind === 'platinum').length ?? 0;
    const perfect = items?.filter((item) => item.kind === 'perfect').length ?? 0;
    return { platinum, perfect, all: platinum + perfect };
  }, [items]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="heading-editorial text-3xl font-semibold text-gray-100">Hall da Platina</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sua coleção de jogos concluídos · {counts.platinum} platinas · {counts.perfect} em 100%
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  filter === key ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/40' : 'text-gray-400 hover:text-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/almanaque')}
            className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-700 hover:text-gray-100"
          >
            <BookOpen className="h-4 w-4 text-violet-400" /> Almanaque
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-800/30 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>}

      {!numbered && !error ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-800 bg-gray-900/40 px-8 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-violet-600/15">
            <Trophy className="h-6 w-6 text-violet-400" />
          </span>
          <p className="font-display text-lg font-semibold text-gray-200">O hall espera pela primeira conquista.</p>
          <p className="max-w-sm text-sm text-gray-500">
            Cada platina ou 100% vira um pôster permanente aqui. Escolha um jogo no Backlog e comece a caçada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map(({ item, order }) => (
            <HallPoster key={`${item.game.appid}-${item.kind}`} item={item} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
