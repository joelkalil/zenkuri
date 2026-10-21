/*
 * Plano: o ano é a navegação. Linha editorial com a situação, a régua do ano
 * (YearStrip) escolhe a fase e a página mostra só essa fase ao lado da fila.
 */
import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Gamepad2, ListPlus, ListChecks, TriangleAlert } from 'lucide-react';
import { GameCover } from '../components/GameCover';
import { ProgressBar } from '../components/ProgressBar';
import { SectionHead } from '../components/SectionHead';
import { Stamp } from '../components/Stamp';
import { Queue } from '../components/plan/Queue';
import { YearStrip, type PhaseSummary } from '../components/plan/YearStrip';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import {
  ACCEPT_AS_IS,
  AFTER_PLAN,
  FLAG_LABEL,
  IF_TIME,
  MILESTONES,
  PHASES,
  PLAN_BASELINE_AVG,
  PLAN_PRINCIPLE,
  PLAN_TARGET_AVG,
  PLAN_WEEKLY_HOURS,
  RECURRING,
  RISKS,
  VACATIONS,
  type PlanEntry,
  type PlanKind,
  type PlanLooseGame,
  type PlanPhase,
  type PlanRef,
} from '../data/plan';
import { daysBetween, formatDay, formatMinutes, isoDay, parseDay, relativeDays, todayStart } from '../lib/planDates';
import type { Game } from '../types/steam';

const FC_WEEKLY_HOURS = RECURRING.hours;

const KIND_GROUP: { kind: PlanKind; title: string; hint: string }[] = [
  { kind: 'foco', title: 'Foco', hint: 'Na ordem, um emendado no outro' },
  { kind: 'platina', title: 'Platinas abertas', hint: 'Fechar o que já está começado' },
  { kind: 'limpeza', title: 'Fechar', hint: 'Abertos com bom ganho por hora' },
  { kind: 'colher', title: 'Colher', hint: 'Só até a meta indicada' },
];

function refKey(ref: PlanRef) {
  return `${ref.platform}:${ref.id}`;
}

function phaseWeeks(phase: PlanPhase) {
  return (daysBetween(parseDay(phase.start), parseDay(phase.end)) + 1) / 7;
}

interface ResolvedEntry {
  entry: PlanEntry;
  game: Game | null;
  percent: number;
  target: number;
  done: boolean;
}

function resolve(entry: PlanEntry, lookup: Map<string, Game>): ResolvedEntry {
  const game = entry.ref ? lookup.get(refKey(entry.ref)) ?? null : null;
  const percent = game?.completion?.percent ?? 0;
  const target = entry.target ?? 100;
  return { entry, game, percent, target, done: game !== null && percent >= target };
}

const pct = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Num({ children }: { children: ReactNode }) {
  return <span className="num font-medium text-gray-100">{children}</span>;
}

function ExternalCover({ entry }: { entry: PlanEntry }) {
  const appid = entry.external?.storeAppid;
  return (
    <span className="relative grid h-10 w-[4.5rem] place-items-center overflow-hidden rounded-md bg-gray-800">
      {appid ? (
        <img
          src={`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <Gamepad2 className="h-4 w-4 text-gray-500" aria-hidden="true" />
      )}
    </span>
  );
}

function EntryStatus({ item, today }: { item: ResolvedEntry; today: Date }) {
  const { entry, game, percent, target, done } = item;

  if (!entry.ref) {
    const release = entry.external?.releaseDate;
    const days = release ? daysBetween(today, parseDay(release)) : null;
    return (
      <span className="block text-sm sm:text-right">
        <span className="block text-gray-300">{days === null ? 'Sem data' : days > 0 ? `Lança ${relativeDays(days)}` : 'Disponível'}</span>
        <span className="block text-xs text-gray-500">{entry.external?.label ?? 'Fora da biblioteca'}</span>
      </span>
    );
  }

  if (!game) return <span className="block text-sm text-gray-500 sm:text-right">Não sincronizado</span>;

  if (done) {
    return (
      <span className="flex items-center gap-2 text-sm font-medium text-zk-complete sm:justify-end">
        {target >= 100
          ? <Stamp kind="100" size={24} seed={entry.title} />
          : <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
        Feito · <span className="num">{percent}%</span>
      </span>
    );
  }

  return (
    <span className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-gray-500">{target < 100 ? `meta ${target}%` : percent > 0 ? 'em andamento' : 'não iniciado'}</span>
        <span className="num text-gray-300">{percent}%</span>
      </span>
      <ProgressBar percent={Math.min(100, Math.round((percent / target) * 100))} height="h-1.5" />
    </span>
  );
}

function EntryRow({ item, today, inQueue, onToggleQueue }: {
  item: ResolvedEntry;
  today: Date;
  inQueue: boolean;
  onToggleQueue: (() => void) | null;
}) {
  const { entry, game, done } = item;
  const cover = game ? <GameCover game={game} className="h-10 w-[4.5rem] rounded-md bg-gray-800" imgClassName="object-cover" /> : <ExternalCover entry={entry} />;
  const risky = entry.flags?.includes('risco');
  const otherFlags = entry.flags?.filter((flag) => flag !== 'risco') ?? [];

  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-start gap-x-4 gap-y-3 border-b border-gray-800 px-1 py-3 transition-colors hover:bg-gray-850 sm:grid-cols-[4.5rem_minmax(0,1fr)_9.5rem_2.5rem] sm:items-center">
      <span className={`relative col-start-1 row-start-1 ${done ? 'opacity-60' : ''}`}>
        {game ? <Link to={`/game/${game.appid}`} tabIndex={-1} aria-hidden="true">{cover}</Link> : cover}
      </span>
      <div className="col-start-2 row-start-1 min-w-0">
        {game ? (
          <Link to={`/game/${game.appid}`} className={`text-sm font-medium hover:text-violet-400 ${done ? 'text-gray-400' : 'text-gray-100'}`}>{entry.title}</Link>
        ) : (
          <span className="text-sm font-medium text-gray-100">{entry.title}</span>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
          <span className="num">~{entry.hours} h</span>
          {otherFlags.map((flag) => <span key={flag}>· {FLAG_LABEL[flag]}</span>)}
          {risky && (
            <span className="inline-flex items-center gap-1 text-zk-gold">
              · <TriangleAlert className="h-3 w-3" aria-hidden="true" /> {FLAG_LABEL.risco}
            </span>
          )}
        </p>
        {entry.note && <p className={`mt-1 max-w-prose text-sm leading-relaxed ${done ? 'text-gray-500' : 'text-gray-400'}`}>{entry.note}</p>}
      </div>
      <div className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1">
        <EntryStatus item={item} today={today} />
      </div>
      <div className="col-start-3 row-start-1 sm:col-start-4">
        {onToggleQueue && (
          <button
            type="button"
            onClick={onToggleQueue}
            aria-pressed={inQueue}
            aria-label={inQueue ? `Tirar ${entry.title} da fila` : `Pôr ${entry.title} na fila`}
            title={inQueue ? 'Na fila' : 'Pôr na fila'}
            className={`grid h-10 w-10 place-items-center rounded transition-colors ${inQueue ? 'text-violet-400 hover:bg-gray-850' : 'text-gray-500 hover:bg-gray-850 hover:text-gray-100'}`}
          >
            {inQueue ? <ListChecks className="h-[18px] w-[18px]" aria-hidden="true" /> : <ListPlus className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>
        )}
      </div>
    </li>
  );
}

function Disclosure({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <details className="group border-t border-gray-800">
      <summary className="flex min-h-14 list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-base font-bold text-gray-100">
          {title}{meta && <span className="num ml-2 text-sm font-normal text-gray-500">{meta}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="pb-6 pt-1">{children}</div>
    </details>
  );
}

function LooseList({ title, hint, items, lookup }: { title: string; hint: string; items: PlanLooseGame[]; lookup: Map<string, Game> }) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold text-gray-200">{title}</h3>
      <p className="mt-0.5 text-sm text-gray-500">{hint}</p>
      <ul className="mt-3 space-y-3">
        {items.map((item) => {
          const game = lookup.get(refKey(item.ref)) ?? null;
          const percent = game?.completion?.percent ?? 0;
          return (
            <li key={refKey(item.ref)} className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1">
                {game ? (
                  <Link to={`/game/${game.appid}`} className="font-medium text-gray-200 hover:text-violet-400">{item.title}</Link>
                ) : (
                  <span className="font-medium text-gray-200">{item.title}</span>
                )}
                <span className="block text-xs text-gray-500">{item.hours ? `~${item.hours} h · ` : ''}{item.reason}</span>
              </span>
              <span className={`num shrink-0 text-xs ${percent >= 100 ? 'text-zk-complete' : 'text-gray-500'}`}>{game ? `${percent}%` : '—'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecentPlay({ games }: { games: Game[] }) {
  const minutes = games.reduce((total, game) => total + (game.playtime_2weeks ?? 0), 0);
  return (
    <section aria-label="Últimos 14 dias">
      <SectionHead className="sh-wrap" number="04" title="Últimos 14 dias" />
      <p className="lede">
        {games.length === 0
          ? 'A Steam não registrou tempo de jogo nesse período.'
          : <><Num>{formatMinutes(minutes)}</Num> em {games.length} {games.length === 1 ? 'jogo' : 'jogos'}, segundo a Steam</>}
      </p>
      {games.length > 0 && (
        <ul className="mt-3 border-t border-gray-800">
          {games.slice(0, 5).map((game) => (
            <li key={game.appid}>
              <Link to={`/game/${game.appid}`} className="row group px-1">
                <GameCover game={game} className="h-8 w-14 shrink-0 rounded-sm bg-gray-800" imgClassName="object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-200 group-hover:text-violet-400">{game.name}</span>
                <span className="num shrink-0 text-xs text-gray-500">{formatMinutes(game.playtime_2weeks ?? 0)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Agenda({ today }: { today: Date }) {
  const todayIso = isoDay(today);
  const items = [
    ...MILESTONES.map((milestone) => ({
      key: `m-${milestone.title}`,
      date: milestone.date,
      dateLabel: milestone.date ? formatDay(milestone.date, today) : milestone.label,
      title: milestone.title,
      note: milestone.note,
      tone: 'bg-zk-gold',
    })),
    ...VACATIONS.map((vacation) => ({
      key: `v-${vacation.id}`,
      date: vacation.start,
      dateLabel: formatDay(vacation.start, today),
      title: `Férias ${vacation.id} · ${vacation.days} dias`,
      note: `${vacation.purpose}. ${vacation.note}`,
      tone: 'bg-zk-complete',
    })),
  ].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));

  return (
    <section aria-label="Agenda">
      <SectionHead className="sh-wrap" number="05" title="Agenda" />
      <p className="lede">Lançamentos que fecham blocos e as férias de 2027.</p>
      <ol className="mt-3 border-t border-gray-800">
        {items.map((item) => {
          const days = item.date ? daysBetween(today, parseDay(item.date)) : null;
          const past = item.date !== null && item.date < todayIso;
          return (
            <li key={item.key} className={`grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 border-b border-gray-800 px-1 py-3 ${past ? 'opacity-60' : ''}`}>
              <span className="num pt-0.5 text-xs text-gray-500">{item.date ? item.dateLabel : '—'}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
                  <span className={`h-2.5 w-0.5 shrink-0 ${item.tone}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">{item.title}</span>
                  {days !== null && days >= 0 && <span className="num shrink-0 text-xs font-normal text-gray-500">{relativeDays(days)}</span>}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{item.date ? item.note : `${item.dateLabel}. ${item.note}`}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function Plan() {
  const { games, loading, completionMap } = useSteam();
  const { db, toggleBacklog, reorderBacklog, setSchedule } = useLocalDb();
  const [params, setParams] = useSearchParams();
  const today = useMemo(() => todayStart(), []);
  const todayIso = isoDay(today);

  const lookup = useMemo(() => {
    const map = new Map<string, Game>();
    for (const game of games) {
      if (game.platform && game.platformGameId) map.set(`${game.platform}:${game.platformGameId}`, game);
    }
    return map;
  }, [games]);

  const phases = useMemo(
    () => PHASES.map((phase) => ({ phase, items: phase.entries.map((entry) => resolve(entry, lookup)) })),
    [lookup],
  );

  const steamAvg = useMemo(() => {
    const started = games.filter((game) => game.platform === 'steam' && (game.completion?.percent ?? 0) > 0);
    if (started.length === 0) return null;
    return started.reduce((sum, game) => sum + (game.completion?.percent ?? 0), 0) / started.length;
  }, [games]);

  const queueGames = useMemo(
    () => db.backlog.map((id) => games.find((game) => String(game.appid) === id)).filter(Boolean) as Game[],
    [db.backlog, games],
  );

  const recentGames = useMemo(
    () => games.filter((game) => (game.playtime_2weeks ?? 0) > 0).sort((a, b) => (b.playtime_2weeks ?? 0) - (a.playtime_2weeks ?? 0)),
    [games],
  );

  const current = PHASES.find((phase) => phase.start <= todayIso && todayIso <= phase.end) ?? null;
  const fallback = todayIso < PHASES[0].start ? PHASES[0] : PHASES[PHASES.length - 1];
  const requested = params.get('fase');
  const selected = phases.find(({ phase }) => phase.id === requested) ?? phases.find(({ phase }) => phase.id === (current ?? fallback).id)!;
  const nextMilestone = MILESTONES.find((milestone) => milestone.date && milestone.date >= todayIso) ?? null;

  const tracked = phases.flatMap(({ items }) => items).filter((item) => item.entry.ref);
  const doneCount = tracked.filter((item) => item.done).length;
  const fc = resolve(RECURRING, lookup);
  const inQueue = new Set(db.backlog);

  function selectPhase(id: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id === current?.id) next.delete('fase');
      else next.set('fase', id);
      return next;
    }, { replace: true });
  }

  const { phase, items } = selected;
  const active = phase.id === current?.id;
  const past = phase.end < todayIso;
  const planned = items.reduce((sum, item) => sum + item.entry.hours, 0) + Math.round(phaseWeeks(phase) * FC_WEEKLY_HOURS);
  const phaseDone = items.filter((item) => item.done).length;
  const groups = KIND_GROUP
    .map((group) => ({ ...group, items: items.filter((item) => item.entry.kind === group.kind) }))
    .filter((group) => group.items.length > 0);

  const queueToggle = (item: ResolvedEntry) => (item.game ? () => toggleBacklog(String(item.game!.appid)) : null);

  const summaries: Record<string, PhaseSummary> = Object.fromEntries(
    phases.map(({ phase: item, items: entries }) => [
      item.id,
      {
        done: entries.filter((entry) => entry.done).length,
        total: entries.length,
        hours: entries.reduce((sum, entry) => sum + entry.entry.hours, 0) + Math.round(phaseWeeks(item) * FC_WEEKLY_HOURS),
      },
    ]),
  );

  const daysToMilestone = nextMilestone?.date ? daysBetween(today, parseDay(nextMilestone.date)) : null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="page-eyebrow">Outubro de 2026 → outubro de 2027</span>
          <h1 className="page-title">Plano</h1>
          <p className="page-desc">
            ~{PLAN_WEEKLY_HOURS} h por semana: FF VII antes do Revelation, Witcher antes do Songs of the Past,
            Kingdom Hearts antes do KH IV e a limpeza da Steam no meio.
          </p>
        </div>
      </header>

      <p className="lede" aria-label="Situação do plano">
        {current
          ? <><strong>Fase {current.id}</strong> (até <span className="num">{formatDay(current.end, today)}</span>)</>
          : 'Fora da janela do plano'}
        {' · '}<Num>{doneCount} de {tracked.length}</Num> etapas
        {' · '}média Steam <Num>{steamAvg !== null ? `${pct(steamAvg)}%` : '—'}</Num> (meta <span className="num">{pct(PLAN_TARGET_AVG)}%</span>, começou em <span className="num">{pct(PLAN_BASELINE_AVG)}%</span>)
        {nextMilestone && daysToMilestone !== null && <>{' · '}{nextMilestone.title} {relativeDays(daysToMilestone)}</>}
      </p>

      <section aria-label="O ano">
        <SectionHead className="sh-wrap" number="01" title="O ano" sub="Escolha uma fase para ver a lista dela" />
        <YearStrip
          phases={PHASES}
          milestones={MILESTONES}
          vacations={VACATIONS}
          summaries={summaries}
          today={today}
          currentId={current?.id ?? null}
          selectedId={phase.id}
          onSelect={selectPhase}
        />
      </section>

      <div className="grid gap-x-12 gap-y-14 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <section aria-labelledby="phase-title" aria-live="polite">
            <SectionHead className="sh-wrap"
              number="02"
              title={<span id="phase-title">Fase {phase.id}</span>}
              sub={<>{formatDay(phase.start, today)} → {formatDay(phase.end, today)}{active && ' · agora'}{past && ' · encerrada'}{phase.floating && ' · datas móveis'}</>}
              action={<span className="num text-xs text-gray-500">{phaseDone} de {items.length} feitos · ~{planned} h de ~{phase.capacity} h</span>}
            />
            <h3 className="max-w-2xl font-display text-xl font-bold text-gray-100 [text-wrap:balance]">{phase.title}</h3>
            <p className="lede mt-2 max-w-2xl">{phase.summary}</p>

            {loading && games.length === 0 ? (
              <div className="mt-8 space-y-4" aria-hidden="true">
                {items.slice(0, 6).map((_, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="h-10 w-[4.5rem] animate-pulse rounded-sm bg-gray-800" />
                    <div className="h-4 flex-1 animate-pulse rounded-sm bg-gray-800" />
                  </div>
                ))}
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.kind} className="mt-9">
                  <h3 className="flex flex-wrap items-baseline gap-x-3 font-display text-sm font-bold text-gray-200">
                    {group.title}
                    <span className="num text-xs font-normal text-gray-500">
                      {group.items.filter((item) => item.done).length}/{group.items.length}
                    </span>
                    <span className="text-xs font-normal text-gray-500">{group.hint}</span>
                  </h3>
                  <ol className="mt-2 border-t border-gray-800">
                    {group.items.map((item, index) => (
                      <EntryRow
                        key={`${phase.id}-${group.kind}-${index}`}
                        item={item}
                        today={today}
                        inQueue={item.game ? inQueue.has(String(item.game.appid)) : false}
                        onToggleQueue={queueToggle(item)}
                      />
                    ))}
                  </ol>
                </div>
              ))
            )}

            <div className="mt-9">
              <h3 className="flex flex-wrap items-baseline gap-x-3 font-display text-sm font-bold text-gray-200">
                Toda semana
                <span className="text-xs font-normal text-gray-500">Fora das fases, {FC_WEEKLY_HOURS} h por semana</span>
              </h3>
              <ol className="mt-2 border-t border-gray-800">
                <EntryRow
                  item={fc}
                  today={today}
                  inQueue={fc.game ? inQueue.has(String(fc.game.appid)) : false}
                  onToggleQueue={queueToggle(fc)}
                />
              </ol>
            </div>
          </section>

          <div className="mt-12 border-b border-gray-800">
            <Disclosure title="Fora do plano" meta={`${AFTER_PLAN.length + ACCEPT_AS_IS.length + IF_TIME.length} jogos`}>
              <div className="grid gap-10 md:grid-cols-3">
                <LooseList title="Depois de nov/2027" hint="Fecháveis que não couberam. Puxe nesta ordem se o plano adiantar." items={AFTER_PLAN} lookup={lookup} />
                <LooseList title="Aceitar como estão" hint="O custo não paga: online morto, skill no teto ou grind eterno." items={ACCEPT_AS_IS} lookup={lookup} />
                <LooseList title="Só se sobrar" hint="PSN e RetroAchievements fora da rota principal." items={IF_TIME} lookup={lookup} />
              </div>
            </Disclosure>
            <Disclosure title="Riscos" meta={`${RISKS.length}`}>
              <dl className="grid gap-x-10 gap-y-5 md:grid-cols-2">
                {RISKS.map((item) => (
                  <div key={item.risk}>
                    <dt className="text-sm font-medium text-gray-200">{item.risk}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-gray-500">{item.action}</dd>
                  </div>
                ))}
              </dl>
            </Disclosure>
            <Disclosure title="Como o plano funciona">
              <div className="max-w-prose space-y-3 text-[0.9375rem] leading-relaxed text-gray-400">
                <p>{PLAN_PRINCIPLE}</p>
                <p>
                  Capacidade de {PLAN_WEEKLY_HOURS} h por semana, mais 6 h por feriado em dia útil e por dia útil de férias.
                  Horas por jogo são estimativas (±30%) de completionist, ajustadas pelo que falta em cada lista.
                </p>
              </div>
            </Disclosure>
          </div>
        </div>

        <aside className="space-y-12" aria-label="Fila e agenda">
          <Queue
            games={queueGames}
            order={db.backlog}
            schedule={db.schedule}
            completionMap={completionMap}
            today={today}
            onReorder={reorderBacklog}
            onRemove={toggleBacklog}
            onSetMonth={setSchedule}
          />
          <RecentPlay games={recentGames} />
          <Agenda today={today} />
        </aside>
      </div>
    </div>
  );
}
