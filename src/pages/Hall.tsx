import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n, useT } from '../i18n';
import { monthShortName } from '../i18n/format';
import type { Locale } from '../i18n/locales';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { fetchRecentCompletions, type CompletionHistoryItem } from '../lib/api';
import { GameCover } from '../components/GameCover';
import { SkeletonCard } from '../components/SkeletonCard';
import { Stamp } from '../components/Stamp';
import { PLATFORM_META } from '../lib/platforms';
import '../styles/hall.css';

type HallFilter = 'all' | 'platinum' | 'perfect';

// `param` is the stable URL value (kept in pt-BR so existing links keep working).
const FILTERS: { key: HallFilter; param: string | null }[] = [
  { key: 'all', param: null },
  { key: 'platinum', param: 'platina' },
  { key: 'perfect', param: '100' },
];

const FROM_HALL = { from: { to: '/hall', label: 'Hall' } };

function toDate(item: CompletionHistoryItem) {
  return new Date(item.completedAt * 1000);
}

function isoDate(item: CompletionHistoryItem) {
  const date = toDate(item);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shortDate(item: CompletionHistoryItem, locale: Locale) {
  const date = toDate(item);
  return `${String(date.getDate()).padStart(2, '0')} ${monthShortName(locale, date.getMonth())} ${date.getFullYear()}`;
}

/** Completion poster: 2:3 cover with the stamp in the corner, order number, name and date. */
function HallPoster({ item, order }: { item: CompletionHistoryItem; order: number }) {
  const t = useT('hall');
  const { formatDate, locale } = useI18n();
  const meta = item.game.platform ? PLATFORM_META[item.game.platform] : null;
  const platinum = item.kind === 'platinum';
  const label = platinum ? t('kind.platinum') : t('kind.perfect');
  const longDate = formatDate(toDate(item), { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <article className="hall-poster">
      <Link to={`/game/${item.game.appid}`} state={FROM_HALL} aria-label={t('posterLabel', { name: item.game.name, kind: label, date: longDate })}>
        <div className="hall-cover">
          <GameCover game={item.game} portrait className="h-full w-full" imgClassName="object-cover" />
          <span className="hall-stamp">
            <Stamp kind={platinum ? 'platina' : '100'} date={isoDate(item)} size={48} seed={item.game.appid} />
          </span>
        </div>
        <p className="hall-order"><span className="n">{t('order', { order: String(order).padStart(2, '0') })}</span>{meta && <span>{meta.short}</span>}</p>
        <h3 className="hall-name" title={item.game.name}>{item.game.name}</h3>
        <p className="hall-date">{shortDate(item, locale)}</p>
      </Link>
    </article>
  );
}

export default function Hall() {
  const t = useT('hall');
  const { formatDate } = useI18n();
  const describe = useErrorMessage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<CompletionHistoryItem[] | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

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
      .catch(setFailure);
  }, []);

  /** Collection order: the first game ever completed is No. 01. */
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
  const error = failure === null ? null : describe(failure, 'hall.errors.load');

  return (
    <div className="page hall">
      <header>
        <div className="hall-head">
          <h1 className="hall-title">{t('title')}</h1>
          <Link to="/almanaque" className="btn btn-secondary btn-sm">
            <span>
              <span className="sm:hidden">{t('almanacLink.short')}</span>
              <span className="hidden sm:inline">{t('almanacLink.full')}</span> ›
            </span>
          </Link>
        </div>
        {items && (
          <p className="lede hall-lede">
            <span className="num">{counts.all}</span> {t.plural('summary.completions', counts.all)} · <span className="num">{counts.platinum}</span> {t.plural('summary.platinums', counts.platinum)} · <span className="num">{counts.perfect}</span> {t('summary.perfects')}
            {first && <> · {t('summary.since', { date: formatDate(toDate(first), { day: 'numeric', month: 'long', year: 'numeric' }) })}</>}
          </p>
        )}
      </header>

      <div className="hall-tabs">
        <div className="subtabs" role="group" aria-label={t('filtersLabel')}>
          {FILTERS.map((item) => (
            <button key={item.key} onClick={() => selectFilter(item)} className="subtab" aria-pressed={filter === item.key}>
              {t(`filters.${item.key}`)}<span className="count">{countOf[item.key]}</span>
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
          <strong>{t('empty.title')}</strong>
          <p>{t(filter === 'perfect' ? 'empty.firstPerfect' : 'empty.firstPlatinum')}</p>
          <Link to="/library?status=inprogress">{t('empty.link')}</Link>
        </div>
      ) : (
        years.map(([year, entries]) => (
          <section key={year} aria-label={t('yearLabel', { year })}>
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
