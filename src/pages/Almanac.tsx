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
import { PLATFORM_META } from '../lib/platforms';
import type { Platform } from '../types/steam';
import '../styles/almanaque.css';

const MONTHS_LONG_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function unlockDayKey(unlockTime: number): string {
  return new Date(unlockTime * 1000).toISOString().slice(0, 10);
}

export default function Almanac() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [years, setYears] = useState<number[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockItem[] | null>(null);
  const [completions, setCompletions] = useState<CompletionHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getUTCFullYear();
  const year = Number(searchParams.get('ano')) || currentYear;

  useEffect(() => {
    setUnlocks(null);
    fetchUnlocks(year)
      .then((res) => {
        setYears(res.years.length > 0 ? res.years : [currentYear]);
        setUnlocks(res.unlocks);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar o almanaque'));
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

  const busiestLabel = stats.busiest
    ? new Date(`${stats.busiest.key}T00:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    : '—';

  const byMonth = useMemo(() => {
    const groups = new Map<number, CompletionHistoryItem[]>();
    for (const item of yearCompletions) {
      const month = new Date(item.completedAt * 1000).getUTCMonth();
      groups.set(month, [...(groups.get(month) ?? []), item]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [yearCompletions]);

  const n = (value: number) => value.toLocaleString('pt-BR');

  return (
    <div className="page page-narrow almanac">
      <header className="page-head">
        <div>
          <Link to="/hall" className="page-eyebrow no-print hover:text-gray-100">‹ Hall</Link>
          <h1 className="page-title">Almanaque <span className="al-year">{year}</span></h1>
          <p className="page-desc">Um ano de caçada em números: cada quadrado é um dia, cada carimbo uma conclusão.</p>
        </div>
        <div className="page-actions no-print">
          <label className="sr-only" htmlFor="almanac-year">Ano</label>
          <select id="almanac-year" value={year} onChange={(event) => setSearchParams({ ano: event.target.value })} className="field h-9 w-auto cursor-pointer pr-8 font-semibold">
            {(years.includes(year) ? years : [year, ...years]).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button onClick={() => window.print()} className="btn btn-secondary">Imprimir</button>
        </div>
      </header>

      {error && <p role="alert" className="border-l-2 border-zk-danger py-1 pl-3 text-sm text-zk-danger">{error}</p>}

      <p className="lede" aria-label={`Resumo de ${year}`}>
        Em <strong>{year}</strong>: <span className="num">{n(stats.total)}</span> {stats.total === 1 ? 'conquista' : 'conquistas'},
        {' '}<span className="num">{stats.platinums}</span> {stats.platinums === 1 ? 'platina' : 'platinas'},
        {' '}<span className="num">{stats.perfects}</span> {stats.perfects === 1 ? 'jogo' : 'jogos'} a 100%.
        {stats.busiest && <> Dia mais ativo: {busiestLabel} (<span className="num">{stats.busiest.count}</span>).</>}
      </p>

      <section aria-labelledby="al-heat">
        <SectionHead className="sh-wrap"
          number="01"
          title={<span id="al-heat">Um ano de desbloqueios</span>}
          sub={stats.topMonth !== null ? <>Mês mais intenso: <span className="font-semibold text-gray-300">{MONTHS_LONG_PT[stats.topMonth]}</span></> : undefined}
        />
        {unlocks === null ? (
          <div className="h-32 animate-pulse rounded-sm bg-gray-850" />
        ) : (
          <UnlockHeatmap year={year} counts={dayCounts} />
        )}
      </section>

      <div className="grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="al-done">
          <SectionHead className="sh-wrap" number="02" title={<span id="al-done">Conclusões de {year}</span>} sub={`${yearCompletions.length} no ano`} />
          {yearCompletions.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">Nenhuma platina ou 100% registrada neste ano.</p>
          ) : (
            byMonth.map(([month, items]) => (
              <div key={month}>
                <div className="al-month">
                  <h3>{MONTHS_LONG_PT[month]}</h3>
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
                        <span className="al-date">{new Date(item.completedAt * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>
                      </span>
                      <span className="al-plat">{meta?.short ?? ''}</span>
                      <span className="al-kind" data-kind={item.kind}>{item.kind === 'platinum' ? 'Platina' : '100%'}</span>
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
              <SectionHead className="sh-wrap" number="03" title="Desbloqueio mais raro" />
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
                <span className="tabular-nums">{stats.rarest.rarity?.toLocaleString('pt-BR')}%</span>
                <span className="ml-2 font-sans text-xs font-medium text-gray-500">dos jogadores têm essa conquista</span>
              </p>
            </section>
          )}

          <section>
            <SectionHead className="sh-wrap" number={stats.rarest ? '04' : '03'} title="Por plataforma" />
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
