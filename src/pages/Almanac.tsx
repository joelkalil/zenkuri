import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchRecentCompletions,
  fetchUnlocks,
  type CompletionHistoryItem,
} from '../lib/api';
import type { UnlockItem } from '../types/steam';
import { GameCover } from '../components/GameCover';
import { SectionHead } from '../components/SectionHead';
import { Stamp } from '../components/Stamp';
import { UnlockHeatmap } from '../components/UnlockHeatmap';
import { useI18n, useT } from '../i18n';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { PLATFORM_META } from '../lib/platforms';
import type { Platform } from '../types/steam';
import '../styles/almanaque.css';

function unlockDayKey(unlockTime: number): string {
  return new Date(unlockTime * 1000).toISOString().slice(0, 10);
}

export default function Almanac() {
  const t = useT('almanac');
  const { formatDate, formatNumber } = useI18n();
  const describe = useErrorMessage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [years, setYears] = useState<number[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockItem[] | null>(null);
  const [completions, setCompletions] = useState<CompletionHistoryItem[]>([]);
  const [failure, setFailure] = useState<unknown>(null);

  const currentYear = new Date().getUTCFullYear();
  const year = Number(searchParams.get('ano')) || currentYear;

  useEffect(() => {
    setUnlocks(null);
    fetchUnlocks(year)
      .then((res) => {
        setYears(res.years.length > 0 ? res.years : [currentYear]);
        setUnlocks(res.unlocks);
      })
      .catch(setFailure);
  }, [year, currentYear]);

  useEffect(() => {
    fetchRecentCompletions(500)
      .then(({ platinums, perfects }) => setCompletions([...platinums, ...perfects]))
      .catch(() => setCompletions([]));
  }, []);

  const dayCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const unlock of unlocks ?? []) {
      const key = unlockDayKey(unlock.unlockTime);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [unlocks]);

  const yearCompletions = useMemo(
    () =>
      completions
        .filter((item) => new Date(item.completedAt * 1000).getUTCFullYear() === year)
        .sort((a, b) => b.completedAt - a.completedAt),
    [completions, year],
  );

  const stats = useMemo(() => {
    const list = unlocks ?? [];
    const perPlatform = new Map<Platform, number>();
    for (const unlock of list) {
      perPlatform.set(unlock.platform, (perPlatform.get(unlock.platform) ?? 0) + 1);
    }

    let busiest: { key: string; count: number } | null = null;
    for (const [key, count] of dayCounts) {
      if (!busiest || count > busiest.count) busiest = { key, count };
    }

    const perMonth = Array.from({ length: 12 }, () => 0);
    for (const unlock of list) {
      perMonth[new Date(unlock.unlockTime * 1000).getUTCMonth()] += 1;
    }
    const topMonth = perMonth.indexOf(Math.max(...perMonth));

    const rarest = list
      .filter((unlock) => unlock.rarity !== null)
      .sort((a, b) => a.rarity! - b.rarity!)[0] ?? null;

    return {
      total: list.length,
      perPlatform,
      busiest,
      topMonth: list.length > 0 ? topMonth : null,
      rarest,
      platinums: yearCompletions.filter((item) => item.kind === 'platinum').length,
      perfects: yearCompletions.filter((item) => item.kind === 'perfect').length,
    };
  }, [unlocks, dayCounts, yearCompletions]);

  const error = failure === null ? null : describe(failure, 'almanac.errors.load');

  const busiestLabel = stats.busiest
    ? formatDate(new Date(`${stats.busiest.key}T00:00:00Z`), { day: 'numeric', month: 'long', timeZone: 'UTC' })
    : '—';

  /** Full month name by index (0 to 11) in the active locale. */
  const monthName = (index: number) => formatDate(Date.UTC(2026, index, 15), { month: 'long', timeZone: 'UTC' });

  const byMonth = useMemo(() => {
    const groups = new Map<number, CompletionHistoryItem[]>();
    for (const item of yearCompletions) {
      const month = new Date(item.completedAt * 1000).getUTCMonth();
      groups.set(month, [...(groups.get(month) ?? []), item]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [yearCompletions]);

  const n = (value: number) => formatNumber(value);

  return (
    <div className="page page-narrow almanac">
      <header className="page-head">
        <div>
          <Link to="/hall" className="page-eyebrow no-print hover:text-gray-100">{t('backToHall')}</Link>
          <h1 className="page-title">{t('title')} <span className="al-year">{year}</span></h1>
          <p className="page-desc">{t('description')}</p>
        </div>
        <div className="page-actions no-print">
          <label className="sr-only" htmlFor="almanac-year">{t('yearLabel')}</label>
          <select id="almanac-year" value={year} onChange={(event) => setSearchParams({ ano: event.target.value })} className="field h-9 w-auto cursor-pointer pr-8 font-semibold">
            {(years.includes(year) ? years : [year, ...years]).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button onClick={() => window.print()} className="btn btn-secondary">{t('print')}</button>
        </div>
      </header>

      {error && <p role="alert" className="border-l-2 border-zk-danger py-1 pl-3 text-sm text-zk-danger">{error}</p>}

      <p className="lede" aria-label={t('summaryLabel', { year })}>
        {t('summary.in')} <strong>{year}</strong>: <span className="num">{n(stats.total)}</span> {t.plural('summary.achievements', stats.total)},
        {' '}<span className="num">{stats.platinums}</span> {t.plural('summary.platinums', stats.platinums)},
        {' '}<span className="num">{stats.perfects}</span> {t.plural('summary.perfects', stats.perfects)}.
        {stats.busiest && <> {t('summary.busiestDay')} {busiestLabel} (<span className="num">{stats.busiest.count}</span>).</>}
      </p>

      <section aria-labelledby="al-heat">
        <SectionHead className="sh-wrap"
          number="01"
          title={<span id="al-heat">{t('heatmap.title')}</span>}
          sub={stats.topMonth !== null ? <>{t('heatmap.topMonth')} <span className="font-semibold text-gray-300">{monthName(stats.topMonth)}</span></> : undefined}
        />
        {unlocks === null ? (
          <div className="h-32 animate-pulse rounded-sm bg-gray-850" />
        ) : (
          <UnlockHeatmap year={year} counts={dayCounts} />
        )}
      </section>

      <div className="grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="al-done">
          <SectionHead className="sh-wrap" number="02" title={<span id="al-done">{t('completions.title', { year })}</span>} sub={t('completions.inYear', { count: yearCompletions.length })} />
          {yearCompletions.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">{t('completions.empty')}</p>
          ) : (
            byMonth.map(([month, items]) => (
              <div key={month}>
                <div className="al-month">
                  <h3>{monthName(month)}</h3>
                  <span className="num text-xs text-gray-500">{items.length}</span>
                </div>
                {items.map((item) => {
                  const meta = item.game.platform ? PLATFORM_META[item.game.platform] : null;
                  return (
                    <button key={`${item.game.appid}-${item.kind}`} onClick={() => navigate(`/game/${item.game.appid}`)} className="al-row">
                      <Stamp kind={item.kind === 'platinum' ? 'platina' : '100'} size={24} seed={item.game.appid} />
                      <GameCover game={item.game} className="al-cover h-9 w-14 shrink-0 rounded-sm bg-gray-800" imgClassName="object-cover" />
                      <span className="min-w-0">
                        <span className="al-name block truncate">{item.game.name}</span>
                        <span className="al-date">{formatDate(item.completedAt * 1000, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>
                      </span>
                      <span className="al-plat">{meta?.short ?? ''}</span>
                      <span className="al-kind" data-kind={item.kind}>{item.kind === 'platinum' ? t('kind.platinum') : t('kind.perfect')}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </section>

        <aside className="space-y-8">
          {stats.rarest && (
            <section>
              <SectionHead className="sh-wrap" number="03" title={t('rarest.title')} />
              <div className="flex items-center gap-3">
                {stats.rarest.icon && (
                  <img src={stats.rarest.icon} alt="" className="h-12 w-12 rounded-sm object-cover" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-100">{stats.rarest.achievementTitle}</p>
                  <p className="truncate text-xs text-gray-500">{stats.rarest.gameName}</p>
                </div>
              </div>
              <p className="mt-3 font-display text-3xl font-black text-gray-100">
                <span className="tabular-nums">{formatNumber(stats.rarest.rarity ?? 0)}%</span>
                <span className="ml-2 font-sans text-xs font-medium text-gray-500">{t('rarest.share')}</span>
              </p>
            </section>
          )}

          <section>
            <SectionHead className="sh-wrap" number={stats.rarest ? '04' : '03'} title={t('byPlatform')} />
            <div>
              {(Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
                const count = stats.perPlatform.get(platform) ?? 0;
                const share = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={platform} className="flex items-center gap-2.5 border-b border-gray-800 py-2.5">
                    <img src={PLATFORM_META[platform].logo} alt="" className="h-4 w-4 object-contain" />
                    <span className="w-28 truncate text-xs font-medium text-gray-300" title={PLATFORM_META[platform].label}>{platform === 'psn' ? 'PlayStation' : PLATFORM_META[platform].label}</span>
                    <div className="h-1 flex-1 bg-gray-800" aria-hidden="true">
                      <div className="h-full bg-violet-500" style={{ width: `${share}%` }} />
                    </div>
                    <span className="num w-12 text-right text-xs text-gray-200">{n(count)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
