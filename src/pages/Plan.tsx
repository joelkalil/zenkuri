/*
 * Plan: the year is the navigation. An editorial line with the status, the year
 * strip (YearStrip) picks the phase and the page shows only that phase next to the queue.
 */
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Gamepad2, ListPlus, ListChecks, Pencil, TriangleAlert } from 'lucide-react';
import { GameCover } from '../components/GameCover';
import { ProgressBar } from '../components/ProgressBar';
import { SectionHead } from '../components/SectionHead';
import { Stamp } from '../components/Stamp';
import { PlanCreateForm } from '../components/plan/PlanCreateForm';
import { PlanEditorView } from '../components/plan/PlanEditorView';
import { Queue } from '../components/plan/Queue';
import { YearStrip, type PhaseSummary } from '../components/plan/YearStrip';
import { useSteam } from '../context/SteamContext';
import { useI18n, useT } from '../i18n';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { useLocalDb } from '../hooks/useLocalDb';
import { usePlan } from '../hooks/usePlan';
import { usePlanEditor } from '../hooks/usePlanEditor';
import {
  type Plan as PlanData,
  type PlanEntry,
  type PlanKind,
  type PlanMilestone,
  type PlanPhase,
  type PlanRef,
  type PlanVacation,
} from '../types/plan';
import { daysBetween, formatDay, formatDayLong, formatMinutes, isoDay, parseDay, planRange, relativeDays, todayStart } from '../lib/planDates';
import '../styles/plano-editor.css';
import type { Game } from '../types/steam';

const KIND_GROUPS: PlanKind[] = ['foco', 'platina', 'limpeza', 'colher'];

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
  const t = useT('plan');
  const { entry, game, percent, target, done } = item;

  if (!entry.ref) {
    const release = entry.external?.releaseDate;
    const days = release ? daysBetween(today, parseDay(release)) : null;
    return (
      <span className="block text-sm sm:text-right">
        <span className="block text-gray-300">{days === null ? t('view.external.noDate') : days > 0 ? t('view.external.releases', { when: relativeDays(days) }) : t('view.external.available')}</span>
        <span className="block text-xs text-gray-500">{entry.external?.label ?? t('view.external.outsideLibrary')}</span>
      </span>
    );
  }

  if (!game) return <span className="block text-sm text-gray-500 sm:text-right">{t('view.notSynced')}</span>;

  if (done) {
    return (
      <span className="flex items-center gap-2 text-sm font-medium text-zk-complete sm:justify-end">
        {target >= 100
          ? <Stamp kind="100" size={24} seed={entry.title} />
          : <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
        {t('view.done')} · <span className="num">{percent}%</span>
      </span>
    );
  }

  return (
    <span className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-gray-500">{target < 100 ? t('view.goal', { target }) : percent > 0 ? t('view.inProgress') : t('view.notStarted')}</span>
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
  const t = useT('plan');
  const { formatNumber } = useI18n();
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
          {entry.hours !== null && <span className="num">{t('common.hours', { hours: formatNumber(entry.hours) })}</span>}
          {otherFlags.map((flag) => <span key={flag}>· {t(`flag.${flag}`)}</span>)}
          {risky && (
            <span className="inline-flex items-center gap-1 text-zk-gold">
              · <TriangleAlert className="h-3 w-3" aria-hidden="true" /> {t('flag.risco')}
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
            aria-label={inQueue ? t('view.queueRemoveAria', { title: entry.title }) : t('view.queueAddAria', { title: entry.title })}
            title={inQueue ? t('view.inQueue') : t('view.addToQueue')}
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

function LooseList({ title, hint, items, lookup }: { title: string; hint: string; items: PlanEntry[]; lookup: Map<string, Game> }) {
  const { formatNumber } = useI18n();
  return (
    <div>
      <h3 className="font-display text-sm font-bold text-gray-200">{title}</h3>
      <p className="mt-0.5 text-sm text-gray-500">{hint}</p>
      <ul className="mt-3 space-y-3">
        {items.map((item) => {
          const game = item.ref ? lookup.get(refKey(item.ref)) ?? null : null;
          const percent = game?.completion?.percent ?? 0;
          return (
            <li key={item.id} className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1">
                {game ? (
                  <Link to={`/game/${game.appid}`} className="font-medium text-gray-200 hover:text-violet-400">{item.title}</Link>
                ) : (
                  <span className="font-medium text-gray-200">{item.title}</span>
                )}
                <span className="block text-xs text-gray-500">{item.hours ? `~${formatNumber(item.hours)} h · ` : ''}{item.note}</span>
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
  const t = useT('plan');
  const minutes = games.reduce((total, game) => total + (game.playtime_2weeks ?? 0), 0);
  return (
    <section aria-label={t('recent.title')}>
      <SectionHead className="sh-wrap" number="04" title={t('recent.title')} />
      <p className="lede">
        {games.length === 0
          ? t('recent.none')
          : <><Num>{formatMinutes(minutes)}</Num> {t.plural('recent.inGames', games.length)}</>}
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

function Agenda({ today, milestones, vacations }: { today: Date; milestones: PlanMilestone[]; vacations: PlanVacation[] }) {
  const t = useT('plan');
  const todayIso = isoDay(today);
  const items = [
    ...milestones.map((milestone) => ({
      key: `m-${milestone.id}`,
      date: milestone.date,
      dateLabel: milestone.date ? formatDay(milestone.date, today) : milestone.label,
      title: milestone.title,
      note: milestone.note,
      tone: 'bg-zk-gold',
    })),
    ...vacations.map((vacation) => ({
      key: `v-${vacation.id}`,
      date: vacation.start,
      dateLabel: formatDay(vacation.start, today),
      title: t.plural('agenda.vacationTitle', vacation.days, { slug: vacation.slug }),
      note: [vacation.purpose, vacation.note].filter(Boolean).join('. '),
      tone: 'bg-zk-complete',
    })),
  ].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));

  return (
    <section aria-label={t('agenda.title')}>
      <SectionHead className="sh-wrap" number="05" title={t('agenda.title')} />
      <p className="lede">{t('agenda.lede')}</p>
      {items.length === 0 && <p className="pe-empty mt-3">{t('agenda.empty')}</p>}
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
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{item.date ? item.note : [item.dateLabel, item.note].filter(Boolean).join('. ')}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PlanView({ plan, onEdit }: { plan: PlanData; onEdit: () => void }) {
  const t = useT('plan');
  const { formatNumber } = useI18n();
  const pct = (value: number) => formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const { phases: PHASES, milestones: MILESTONES, vacations: VACATIONS, risks: RISKS } = plan;
  const recurring = plan.recurring;
  const FC_WEEKLY_HOURS = recurring.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
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
    [PHASES, lookup],
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
  const fallback = PHASES.length === 0 ? null : todayIso < PHASES[0].start ? PHASES[0] : PHASES[PHASES.length - 1];
  const requested = params.get('fase');
  const selected = phases.find(({ phase }) => phase.slug === requested) ?? phases.find(({ phase }) => phase.slug === (current ?? fallback)?.slug) ?? phases[0] ?? null;
  const nextMilestone = MILESTONES.find((milestone) => milestone.date && milestone.date >= todayIso) ?? null;

  const tracked = phases.flatMap(({ items }) => items).filter((item) => item.entry.ref);
  const doneCount = tracked.filter((item) => item.done).length;
  const recurringItems = recurring.map((entry) => resolve(entry, lookup));
  const inQueue = new Set(db.backlog);

  function selectPhase(id: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id === current?.slug) next.delete('fase');
      else next.set('fase', id);
      return next;
    }, { replace: true });
  }

  const phase = selected?.phase ?? null;
  const items = selected?.items ?? [];
  const active = phase !== null && phase.slug === current?.slug;
  const past = phase !== null && phase.end < todayIso;
  const planned = phase === null ? 0 : items.reduce((sum, item) => sum + (item.entry.hours ?? 0), 0) + Math.round(phaseWeeks(phase) * FC_WEEKLY_HOURS);
  const phaseDone = items.filter((item) => item.done).length;
  const range = planRange(PHASES, VACATIONS, MILESTONES.map((milestone) => milestone.date));
  const groups = KIND_GROUPS
    .map((kind) => ({ kind, items: items.filter((item) => item.entry.kind === kind) }))
    .filter((group) => group.items.length > 0);

  const queueToggle = (item: ResolvedEntry) => (item.game ? () => toggleBacklog(String(item.game!.appid)) : null);

  const summaries: Record<string, PhaseSummary> = Object.fromEntries(
    phases.map(({ phase: item, items: entries }) => [
      item.slug,
      {
        done: entries.filter((entry) => entry.done).length,
        total: entries.length,
        hours: entries.reduce((sum, entry) => sum + (entry.entry.hours ?? 0), 0) + Math.round(phaseWeeks(item) * FC_WEEKLY_HOURS),
      },
    ]),
  );

  const daysToMilestone = nextMilestone?.date ? daysBetween(today, parseDay(nextMilestone.date)) : null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="page-eyebrow">{PHASES.length === 0 && VACATIONS.length === 0 ? t('view.noDates') : <>{formatDayLong(range.start)} → {formatDayLong(range.end)}</>}</span>
          <h1 className="page-title">{plan.title || t('pageTitle')}</h1>
          <p className="page-desc">
            {t('view.perWeek', { hours: formatNumber(plan.weeklyHours) })}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> {t('view.edit')}
          </button>
        </div>
      </header>

      <p className="lede" aria-label={t('view.situationAria')}>
        {current
          ? <><strong>{t('view.currentPhase', { slug: current.slug })}</strong> ({t('view.until')} <span className="num">{formatDay(current.end, today)}</span>)</>
          : t('view.outsideWindow')}
        {' · '}<Num>{t('view.ofTotal', { done: doneCount, total: tracked.length })}</Num> {t.plural('view.stepWord', tracked.length)}
        {' · '}{t('view.steamAvg')} <Num>{steamAvg !== null ? `${pct(steamAvg)}%` : '—'}</Num> {plan.targetAvg !== null && <>({t('view.goalLabel')} <span className="num">{pct(plan.targetAvg)}%</span>{plan.baselineAvg !== null && <>, {t('view.startedAt')} <span className="num">{pct(plan.baselineAvg)}%</span></>})</>}
        {nextMilestone && daysToMilestone !== null && <>{' · '}{nextMilestone.title} {relativeDays(daysToMilestone)}</>}
      </p>

      {phase === null && (
        <div className="empty-state mt-8">
          <strong>{t('view.noPhasesTitle')}</strong>
          <span>{t('view.noPhasesBody')}</span>
          <button type="button" className="btn btn-primary" onClick={onEdit}>{t('view.addPhases')}</button>
        </div>
      )}

      {phase !== null && <section aria-label={t('view.yearAria')}>
        <SectionHead className="sh-wrap" number="01" title={t('view.yearTitle')} sub={t('view.yearSub')} />
        <YearStrip
          phases={PHASES}
          milestones={MILESTONES}
          vacations={VACATIONS}
          summaries={summaries}
          today={today}
          currentId={current?.slug ?? null}
          selectedId={phase.slug}
          onSelect={selectPhase}
        />
      </section>}

      <div className="grid gap-x-12 gap-y-14 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {phase !== null && <section aria-labelledby="phase-title" aria-live="polite">
            <SectionHead className="sh-wrap"
              number="02"
              title={<span id="phase-title">{t('view.phaseTitle', { slug: phase.slug })}</span>}
              sub={<>{formatDay(phase.start, today)} → {formatDay(phase.end, today)}{active && ` · ${t('view.phaseNow')}`}{past && ` · ${t('view.phaseEnded')}`}{phase.floating && ` · ${t('view.phaseFloating')}`}</>}
              action={<span className="num text-xs text-gray-500">{t('view.phaseProgress', { done: phaseDone, total: items.length, planned: formatNumber(planned), capacity: formatNumber(phase.capacity) })}</span>}
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
                    {t(`view.groups.${group.kind}.title`)}
                    <span className="num text-xs font-normal text-gray-500">
                      {group.items.filter((item) => item.done).length}/{group.items.length}
                    </span>
                    <span className="text-xs font-normal text-gray-500">{t(`view.groups.${group.kind}.hint`)}</span>
                  </h3>
                  <ol className="mt-2 border-t border-gray-800">
                    {group.items.map((item, index) => (
                      <EntryRow
                        key={`${phase.slug}-${group.kind}-${index}`}
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

            {recurringItems.length > 0 && (
              <div className="mt-9">
                <h3 className="flex flex-wrap items-baseline gap-x-3 font-display text-sm font-bold text-gray-200">
                  {t('view.recurringTitle')}
                  <span className="text-xs font-normal text-gray-500">{t('view.recurringHint', { hours: formatNumber(FC_WEEKLY_HOURS) })}</span>
                </h3>
                <ol className="mt-2 border-t border-gray-800">
                  {recurringItems.map((item) => (
                    <EntryRow
                      key={item.entry.id}
                      item={item}
                      today={today}
                      inQueue={item.game ? inQueue.has(String(item.game.appid)) : false}
                      onToggleQueue={queueToggle(item)}
                    />
                  ))}
                </ol>
              </div>
            )}
          </section>}

          <div className="mt-12 border-b border-gray-800">
            <Disclosure title={t('view.outsideTitle')} meta={t.plural('gameCount', plan.afterPlan.length + plan.acceptAsIs.length + plan.ifTime.length)}>
              <div className="grid gap-10 md:grid-cols-3">
                <LooseList title={t('view.afterTitle')} hint={t('view.afterHint')} items={plan.afterPlan} lookup={lookup} />
                <LooseList title={t('view.acceptTitle')} hint={t('view.acceptHint')} items={plan.acceptAsIs} lookup={lookup} />
                <LooseList title={t('view.ifTimeTitle')} hint={t('view.ifTimeHint')} items={plan.ifTime} lookup={lookup} />
              </div>
            </Disclosure>
            <Disclosure title={t('view.risksTitle')} meta={`${RISKS.length}`}>
              <dl className="grid gap-x-10 gap-y-5 md:grid-cols-2">
                {RISKS.map((item) => (
                  <div key={item.id}>
                    <dt className="text-sm font-medium text-gray-200">{item.risk}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-gray-500">{item.action}</dd>
                  </div>
                ))}
              </dl>
            </Disclosure>
            <Disclosure title={t('view.howTitle')}>
              <div className="max-w-prose space-y-3 text-[0.9375rem] leading-relaxed text-gray-400">
                {plan.principle && <p>{plan.principle}</p>}
                <p>
                  {t('view.capacityNote', { hours: formatNumber(plan.weeklyHours) })}
                </p>
              </div>
            </Disclosure>
          </div>
        </div>

        <aside className="space-y-12" aria-label={t('view.sideAria')}>
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
          <Agenda today={today} milestones={MILESTONES} vacations={VACATIONS} />
        </aside>
      </div>
    </div>
  );
}

function PlanEditing({ plan, setPlan, onDone }: { plan: PlanData; setPlan: Dispatch<SetStateAction<PlanData | null>>; onDone: () => void }) {
  const t = useT('plan');
  const describe = useErrorMessage();
  const editor = usePlanEditor(plan, setPlan);
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="page-eyebrow">{t('editor.eyebrow')}</span>
          <h1 className="page-title">{plan.title || t('pageTitle')}</h1>
          <p className="page-desc">{t('editor.desc')}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={onDone}>{t('editor.done')}</button>
        </div>
      </header>
      <div className="pe-bar" role="status" aria-live="polite">
        <span className="pe-bar-status">{editor.pending > 0 ? t('editor.saving') : t('editor.saved')}</span>
      </div>
      {editor.error !== null && (
        <div className="pe-bar-error" role="alert">
          <span>{t('editor.restored', { error: describe(editor.error) })}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={editor.dismissError}>{t('editor.dismiss')}</button>
        </div>
      )}
      <PlanEditorView plan={plan} editor={editor} />
    </div>
  );
}

export default function Plan() {
  const t = useT('plan');
  const describe = useErrorMessage();
  const { plan, loading, error, setPlan, reload } = usePlan();
  const [editing, setEditing] = useState(false);

  if (loading && !plan) return <div className="page" aria-busy="true"><h1 className="page-title">{t('pageTitle')}</h1></div>;
  if (error !== null && !plan) {
    return (
      <div className="page">
        <h1 className="page-title">{t('pageTitle')}</h1>
        <p className="lede">{describe(error)}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>{t('page.retry')}</button>
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <span className="page-eyebrow">{t('page.eyebrow')}</span>
            <h1 className="page-title">{t('pageTitle')}</h1>
          </div>
        </header>
        <div className="mt-8">
          <PlanCreateForm onCreated={(created) => { setPlan(created); setEditing(true); }} />
        </div>
      </div>
    );
  }
  if (editing) return <PlanEditing plan={plan} setPlan={setPlan} onDone={() => setEditing(false)} />;
  return <PlanView plan={plan} onEdit={() => setEditing(true)} />;
}
