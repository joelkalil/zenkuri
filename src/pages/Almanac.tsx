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
    <div className="stat-tile">
      <span className="stat-tile-label"><Icon className={`h-4 w-4 ${accent}`} aria-hidden="true" />{label}</span>
      <span className="stat-tile-value text-gray-100">{value}</span>
      {hint && <span className="stat-tile-hint truncate">{hint}</span>}
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
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <span className="page-eyebrow"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Retrospectiva anual</span>
          <h1 className="page-title">Almanaque <span className="text-violet-400">{year}</span></h1>
          <p className="page-desc">Um ano de caçada em números: cada quadrado é um dia, cada conquista uma marca no papel.</p>
        </div>
        <div className="page-actions no-print">
          <button onClick={() => navigate('/hall')} className="btn btn-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Hall da Platina
          </button>
          <label className="sr-only" htmlFor="almanac-year">Ano</label>
          <select id="almanac-year" value={year} onChange={(event) => setSearchParams({ ano: event.target.value })} className="field h-10 w-auto cursor-pointer pr-8 font-semibold">
            {(years.includes(year) ? years : [year, ...years]).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button onClick={() => window.print()} className="btn btn-secondary">
            <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir
          </button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-red-800/30 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>}

      <div className="stat-strip stat-strip-4">
        <StatBlock icon={CheckCircle2} accent="text-sky-400" label="Conquistas" value={stats.total} hint={`Desbloqueadas em ${year}`} />
        <StatBlock icon={Trophy} accent="text-amber-400" label="Platinas" value={stats.platinums} hint="Troféus de platina" />
        <StatBlock icon={CheckCircle2} accent="text-emerald-400" label="100%" value={stats.perfects} hint="Jogos perfeitos" />
        <StatBlock icon={Flame} accent="text-red-400" label="Dia mais ativo" value={stats.busiest?.count ?? '—'} hint={busiestLabel} />
      </div>

      <section className="surface surface-pad">
        <div className="section-head">
          <h2>Um ano de desbloqueios</h2>
          <span className="spacer" />
          {stats.topMonth !== null && (
            <span className="section-sub">Mês mais intenso: <span className="font-semibold text-gray-300">{MONTHS_LONG_PT[stats.topMonth]}</span></span>
          )}
        </div>
        {unlocks === null ? (
          <div className="h-28 animate-pulse rounded-lg bg-gray-800/50" />
        ) : (
          <div className="overflow-x-auto"><UnlockHeatmap year={year} counts={dayCounts} /></div>
        )}
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="section-head">
            <h2>Conclusões de {year}</h2>
            <span className="section-sub">{yearCompletions.length} no ano</span>
          </div>
          {yearCompletions.length === 0 ? (
            <div className="empty-state py-10">Nenhuma platina ou 100% registrada neste ano.</div>
          ) : (
            <div className="list-surface">
              {yearCompletions.map((item) => {
                const meta = item.game.platform ? PLATFORM_META[item.game.platform] : null;
                return (
                  <button key={`${item.game.appid}-${item.kind}`} onClick={() => navigate(`/game/${item.game.appid}`)} className="list-surface-row">
                    <GameCover game={item.game} className="h-11 w-20 shrink-0 rounded-md bg-gray-800" imgClassName="object-cover" />
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

        <aside className="space-y-8">
          {stats.rarest && (
            <section>
              <div className="section-head">
                <Gem className="h-5 w-5 text-violet-400" aria-hidden="true" />
                <h2>Desbloqueio mais raro</h2>
              </div>
              <div className="surface surface-pad">
                <div className="flex items-center gap-3">
                  {stats.rarest.icon && (
                    <img src={stats.rarest.icon} alt="" className="h-12 w-12 rounded-lg border border-gray-800 object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-100">{stats.rarest.achievementTitle}</p>
                    <p className="truncate text-xs text-gray-500">{stats.rarest.gameName}</p>
                  </div>
                </div>
                <p className="mt-4 text-2xl font-bold tabular-nums text-violet-400">
                  {stats.rarest.rarity}%
                  <span className="ml-1.5 text-xs font-medium text-gray-500">dos jogadores têm essa conquista</span>
                </p>
              </div>
            </section>
          )}

          <section>
            <div className="section-head">
              <h2>Por plataforma</h2>
            </div>
            <div className="surface surface-pad space-y-3">
              {(Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
                const count = stats.perPlatform.get(platform) ?? 0;
                const share = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={platform} className="flex items-center gap-2.5">
                    <img src={PLATFORM_META[platform].logo} alt="" className="h-4 w-4 object-contain" />
                    <span className="w-14 text-xs font-medium text-gray-400">{PLATFORM_META[platform].short}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-violet-400" style={{ width: `${share}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs font-semibold tabular-nums text-gray-300">{count}</span>
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

