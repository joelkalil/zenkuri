import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchRecentCompletions, type CompletionHistoryItem } from '../lib/api';
import { GameCover } from '../components/GameCover';
import { SkeletonCard } from '../components/SkeletonCard';
import { Stamp } from '../components/Stamp';
import { PLATFORM_META } from '../lib/platforms';
import '../styles/hall.css';

type HallFilter = 'all' | 'platinum' | 'perfect';

const FILTERS: { key: HallFilter; label: string; param: string | null }[] = [
  { key: 'all', label: 'Todas', param: null },
  { key: 'platinum', label: 'Platinas', param: 'platina' },
  { key: 'perfect', label: '100%', param: '100' },
];

const FROM_HALL = { from: { to: '/hall', label: 'Hall' } };
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

function toDate(item: CompletionHistoryItem) {
  return new Date(item.completedAt * 1000);
}

function isoDate(item: CompletionHistoryItem) {
  const date = toDate(item);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function longDate(item: CompletionHistoryItem) {
  return toDate(item).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shortDate(item: CompletionHistoryItem) {
  const date = toDate(item);
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** Cartaz de conclusão: capa 2:3 com o carimbo no canto, número de ordem, nome e data. */
function HallPoster({ item, order }: { item: CompletionHistoryItem; order: number }) {
  const meta = item.game.platform ? PLATFORM_META[item.game.platform] : null;
  const platinum = item.kind === 'platinum';
  const label = platinum ? 'Platina' : '100%';

  return (
    <article className="hall-poster">
      <Link to={`/game/${item.game.appid}`} state={FROM_HALL} aria-label={`${item.game.name} — ${label}, ${longDate(item)}`}>
        <div className="hall-cover">
          <GameCover game={item.game} portrait className="h-full w-full" imgClassName="object-cover" />
          <span className="hall-stamp">
            <Stamp kind={platinum ? 'platina' : '100'} date={isoDate(item)} size={48} seed={item.game.appid} />
          </span>
        </div>
        <p className="hall-order"><span className="n">Nº {String(order).padStart(2, '0')}</span>{meta && <span>{meta.short}</span>}</p>
        <h3 className="hall-name" title={item.game.name}>{item.game.name}</h3>
        <p className="hall-date">{shortDate(item)}</p>
      </Link>
    </article>
  );
}

export default function Hall() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<CompletionHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filter: HallFilter = FILTERS.find((item) => item.param !== null && item.param === searchParams.get('tipo'))?.key ?? 'all';

  function selectFilter(next: (typeof FILTERS)[number]) {
    const params = new URLSearchParams(searchParams);
    if (next.param) params.set('tipo', next.param);
    else params.delete('tipo');
    setSearchParams(params, { replace: true });
  }

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

  const years = useMemo(() => {
    const groups = new Map<number, { item: CompletionHistoryItem; order: number }[]>();
    for (const entry of numbered ?? []) {
      if (filter !== 'all' && entry.item.kind !== filter) continue;
      const year = toDate(entry.item).getFullYear();
      groups.set(year, [...(groups.get(year) ?? []), entry]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [numbered, filter]);

  const counts = useMemo(() => {
    const platinum = items?.filter((item) => item.kind === 'platinum').length ?? 0;
    const perfect = items?.filter((item) => item.kind === 'perfect').length ?? 0;
    return { platinum, perfect, all: platinum + perfect };
  }, [items]);

  const first = useMemo(() => {
    if (!items || items.length === 0) return null;
    return items.reduce((a, b) => (a.completedAt <= b.completedAt ? a : b));
  }, [items]);

  const countOf: Record<HallFilter, number> = { all: counts.all, platinum: counts.platinum, perfect: counts.perfect };

  return (
    <div className="page hall">
      <header>
        <div className="hall-head">
          <h1 className="hall-title">Hall da Platina</h1>
          <Link to="/almanaque" className="btn btn-secondary btn-sm"><span>Almanaque<span className="hidden sm:inline"> do ano</span> ›</span></Link>
        </div>
        {items && (
          <p className="lede hall-lede">
            <span className="num">{counts.all}</span> conclusões · <span className="num">{counts.platinum}</span> {counts.platinum === 1 ? 'platina' : 'platinas'} · <span className="num">{counts.perfect}</span> em 100%
            {first && <> · desde {longDate(first)}</>}
          </p>
        )}
      </header>

      <div className="hall-tabs">
        <div className="subtabs" role="group" aria-label="Filtrar conclusões">
          {FILTERS.map((item) => (
            <button key={item.key} onClick={() => selectFilter(item)} className="subtab" aria-pressed={filter === item.key}>
              {item.label}<span className="count">{countOf[item.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-zk-danger">{error}</p>}

      {!numbered && !error ? (
        <div className="hall-grid">
          {Array.from({ length: 16 }).map((_, i) => <SkeletonCard key={i} portrait />)}
        </div>
      ) : years.length === 0 && numbered ? (
        <div className="hall-empty">
          <strong>Nenhuma conclusão registrada</strong>
          <p>A primeira {filter === 'perfect' ? 'conclusão a 100%' : 'platina'} vira o carimbo nº 1.</p>
          <Link to="/library?status=inprogress">Ver jogos quase lá</Link>
        </div>
      ) : (
        years.map(([year, entries]) => (
          <section key={year} aria-label={`Conclusões de ${year}`}>
            <h2 className="hall-year">{year}<small>{entries.length}</small></h2>
            <div className="hall-grid">
              {entries.map(({ item, order }) => (
                <HallPoster key={`${item.game.appid}-${item.kind}`} item={item} order={order} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
