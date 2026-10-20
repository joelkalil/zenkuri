import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

/** Cartaz de conclusão: capa no formato da biblioteca, selo, número de ordem e data. */
function HallPoster({ item, order }: { item: CompletionHistoryItem; order: number }) {
  const meta = item.game.platform ? PLATFORM_META[item.game.platform] : null;
  const seal = item.kind === 'platinum' ? '/trophies/platinum.png' : '/trophies/achievement-100.png';
  const sealLabel = item.kind === 'platinum' ? 'Platina' : '100% das conquistas';

  return (
    <article className="game-card">
      <Link to={`/game/${item.game.appid}`} className="game-card-link" aria-label={`${item.game.name} — ${sealLabel}, ${completionDate(item)}`}>
        <div className="game-card-cover">
          <GameCover game={item.game} portrait className="h-full w-full" imgClassName="object-cover" />
          <span className="hall-seal" title={sealLabel}><img src={seal} alt="" /></span>
        </div>
        <p className="hall-order">Nº {String(order).padStart(2, '0')}{meta ? ` · ${meta.short}` : ''}</p>
        <h2 className="game-card-name mt-0.5" title={item.game.name}>{item.game.name}</h2>
      </Link>
      <p className="game-card-meta">{completionDate(item)}</p>
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

  const countOf: Record<HallFilter, number> = { all: counts.all, platinum: counts.platinum, perfect: counts.perfect };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="page-eyebrow"><Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Coleção de conclusões</span>
          <h1 className="page-title">Hall da Platina</h1>
          <p className="page-desc">Cada platina e cada 100% vira um cartaz permanente, numerado na ordem em que aconteceu.</p>
        </div>
        <div className="page-actions">
          <button onClick={() => navigate('/almanaque')} className="btn btn-secondary">
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Almanaque do ano
          </button>
        </div>
      </header>

      <div className="tabs-bar">
        <div className="subtabs" role="group" aria-label="Filtrar conclusões">
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)} className="subtab" aria-pressed={filter === key}>
              {label}<span className="count">{countOf[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-800/30 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>}

      {!numbered && !error ? (
        <div className="library-grid">
          {Array.from({ length: 14 }).map((_, i) => <SkeletonCard key={i} portrait />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <Trophy className="h-7 w-7 text-gray-600" aria-hidden="true" />
          <strong>O hall espera pela primeira conquista.</strong>
          <p className="max-w-sm">Cada platina ou 100% vira um cartaz permanente aqui. Escolha um jogo no Plano e comece a caçada.</p>
        </div>
      ) : (
        <div className="library-grid">
          {visible.map(({ item, order }) => (
            <HallPoster key={`${item.game.appid}-${item.kind}`} item={item} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
