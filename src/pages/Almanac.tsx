import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, Flame, Gem, Printer, Trophy } from 'lucide-react';
import {
  fetchRecentCompletions,
  fetchUnlocks,
  type CompletionHistoryItem,
} from '../lib/api';
import type { UnlockItem } from '../types/steam';
import { GameCover } from '../components/GameCover';
import { UnlockHeatmap } from '../components/UnlockHeatmap';
import { PLATFORM_META } from '../lib/platforms';
import type { Platform } from '../types/steam';

const MONTHS_LONG_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function unlockDayKey(unlockTime: number): string {
  return new Date(unlockTime * 1000).toISOString().slice(0, 10);
}

function StatBlock({ label, value, hint, icon: Icon, accent }: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Trophy;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 lg:p-5">
      <span className="flex items-center gap-2">
        <Icon className={`h-[18px] w-[18px] ${accent}`} />
        <span className="text-sm font-medium text-gray-400">{label}</span>
      </span>
      <span className="font-display text-[2rem] font-bold leading-none tabular-nums text-gray-100">{value}</span>
      {hint && <span className="truncate text-xs text-gray-500">{hint}</span>}
    </div>
  );
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

  return (
    <div className="mx-auto max-w-[1100px] space-y-8 p-6 lg:p-8">
      <div className="no-print flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/hall')}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" /> Hall da Platina
        </button>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(event) => setSearchParams({ ano: event.target.value })}
            className="cursor-pointer rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-300 focus:outline-none focus:border-violet-600"
          >
            {(years.includes(year) ? years : [year, ...years]).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3.5 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-700 hover:text-gray-100"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Capa editorial */}
      <header className="border-b border-gray-800 pb-6">
        <p className="text-sm font-semibold text-violet-400">Zenkuri · retrospectiva anual</p>
        <h1 className="heading-editorial mt-2 text-5xl font-bold text-gray-100 sm:text-6xl">
          Almanaque <span className="text-violet-400">{year}</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500">
          Um ano de caçada em números: cada quadrado é um dia, cada conquista uma marca no papel.
        </p>
      </header>

      {error && <div className="rounded-xl border border-red-800/30 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>}

      <div className="grid grid-cols-2 divide-x divide-y divide-gray-800 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/50 lg:grid-cols-4 lg:divide-y-0">
        <StatBlock icon={CheckCircle2} accent="text-sky-400" label="Conquistas" value={stats.total} hint={`Desbloqueadas em ${year}`} />
        <StatBlock icon={Trophy} accent="text-amber-400" label="Platinas" value={stats.platinums} hint="Troféus de platina" />
        <StatBlock icon={CheckCircle2} accent="text-emerald-400" label="100%" value={stats.perfects} hint="Jogos perfeitos" />
        <StatBlock
          icon={Flame}
          accent="text-red-400"
          label="Dia mais ativo"
          value={stats.busiest?.count ?? '—'}
          hint={busiestLabel}
        />
      </div>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="mb-4 text-lg font-bold text-gray-100">Um ano de desbloqueios</h2>
        {unlocks === null ? (
          <div className="h-28 animate-pulse rounded-lg bg-gray-800/50" />
        ) : (
          <UnlockHeatmap year={year} counts={dayCounts} />
        )}
        {stats.topMonth !== null && (
          <p className="mt-3 text-xs text-gray-500">
            Mês mais intenso: <span className="font-semibold text-gray-300">{MONTHS_LONG_PT[stats.topMonth]}</span>
          </p>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/50">
          <h2 className="border-b border-gray-800 px-5 py-4 text-lg font-bold text-gray-100">
            Conclusões de {year}
          </h2>
          {yearCompletions.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-600">Nenhuma platina ou 100% registrada neste ano.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {yearCompletions.map((item) => {
                const meta = item.game.platform ? PLATFORM_META[item.game.platform] : null;
                return (
                  <button
                    key={`${item.game.appid}-${item.kind}`}
                    onClick={() => navigate(`/game/${item.game.appid}`)}
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-800/40"
                  >
                    <GameCover game={item.game} className="h-11 w-11 shrink-0 rounded-lg bg-gray-800" imgClassName="h-11 w-11 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-100">{item.game.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {new Date(item.completedAt * 1000).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                        {meta ? ` · ${meta.short}` : ''}
                      </p>
                    </div>
                    <img
                      src={item.kind === 'platinum' ? '/trophies/platinum.png' : '/trophies/achievement-100.png'}
                      alt={item.kind === 'platinum' ? 'Platina' : '100%'}
                      className="h-5 w-5 shrink-0 object-contain"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {stats.rarest && (
            <section className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-300">Desbloqueio mais raro</h2>
              </div>
              <div className="mt-4 flex items-center gap-3">
                {stats.rarest.icon && (
                  <img src={stats.rarest.icon} alt="" className="h-12 w-12 rounded-lg border border-gray-800 object-cover" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-100">{stats.rarest.achievementTitle}</p>
                  <p className="truncate text-xs text-gray-500">{stats.rarest.gameName}</p>
                </div>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-violet-400">
                {stats.rarest.rarity}%
                <span className="ml-1.5 text-xs font-medium normal-case text-gray-500">dos jogadores têm essa conquista</span>
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-300">Por plataforma</h2>
            </div>
            <div className="mt-3 space-y-2.5">
              {(Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
                const count = stats.perPlatform.get(platform) ?? 0;
                const share = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={platform} className="flex items-center gap-2.5">
                    <img src={PLATFORM_META[platform].logo} alt="" className="h-4 w-4 object-contain" />
                    <span className="w-14 text-xs font-medium text-gray-400">{PLATFORM_META[platform].short}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${share}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs font-bold tabular-nums text-gray-300">{count}</span>
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
