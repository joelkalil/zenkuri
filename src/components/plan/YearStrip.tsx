import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import type { PlanMilestone, PlanPhase, PlanVacation } from '../../types/plan';
import { daysBetween, formatDay, isoDay, monthShort, monthSpan, parseDay, planRange } from '../../lib/planDates';
import '../../styles/plano.css';

export interface PhaseSummary {
  done: number;
  total: number;
  /** hours planned in the phase */
  hours: number;
}

interface YearStripProps {
  phases: PlanPhase[];
  milestones: PlanMilestone[];
  vacations: PlanVacation[];
  summaries: Record<string, PhaseSummary>;
  today: Date;
  currentId: string | null;
  selectedId: string;
  onSelect: (id: string) => void;
}

const MILESTONE_LEVEL_HEIGHT = 22;
const MAX_MILESTONE_LEVELS = 3;
const CHAR_PX = 6.6;
const GUIDE_GAP_PX = 14;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The plan year. Bars show only the phase code (F1-F6); title, dates and
 * progress live in the legend table right below. "Today" is a vertical line
 * labelled on the axis row; milestones get their own staggered rows.
 */
export function YearStrip({ phases, milestones, vacations, summaries, today, currentId, selectedId, onSelect }: YearStripProps) {
  const { t } = useI18n();
  const [chartRef, width] = useWidth();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const range = planRange(phases, vacations, milestones.map((milestone) => milestone.date));
  const start = parseDay(range.start);
  const end = parseDay(range.end);
  const total = daysBetween(start, end) + 1;
  const pos = (iso: string) => (daysBetween(start, parseDay(iso)) / total) * 100;
  const todayPos = (daysBetween(start, today) / total) * 100;
  const showToday = todayPos >= 0 && todayPos <= 100;
  const todayIso = isoDay(today);
  const px = (percent: number) => (percent / 100) * width;

  const months = Array.from({ length: monthSpan(start, end) }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const left = Math.max(0, (daysBetween(start, date) / total) * 100);
    const jan = date.getMonth() === 0;
    const label = jan || index === 0 ? `${monthShort(date.getMonth())} ${String(date.getFullYear()).slice(2)}` : monthShort(date.getMonth());
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label, left, important: jan || index === 0, odd: index % 2 === 1 };
  })
    .filter((month) => month.left < 96)
    // Without room, only the even months (and January/the first month).
    .filter((month) => width >= 900 || month.important || !month.odd);

  const dated = milestones
    .filter((milestone) => milestone.date && milestone.date >= range.start && milestone.date <= range.end)
    .map((milestone) => ({ milestone, left: pos(milestone.date!) }))
    .sort((a, b) => a.left - b.left);

  // Staggers milestones across up to 3 levels when the labels would touch.
  const levelEnds: number[] = [];
  const placed = dated.map(({ milestone, left }) => {
    const text = `${milestone.title} ${formatDay(milestone.date!, today)}`;
    const labelPx = text.length * CHAR_PX + 16;
    const flip = px(left) + labelPx + GUIDE_GAP_PX > width;
    const from = flip ? px(left) - labelPx : px(left);
    const to = flip ? px(left) : px(left) + labelPx;
    let level = levelEnds.findIndex((end) => from > end + 8);
    if (level === -1) level = Math.min(levelEnds.length, MAX_MILESTONE_LEVELS - 1);
    levelEnds[level] = to;
    return { milestone, left, flip, level, text };
  });
  const levels = placed.reduce((max, item) => Math.max(max, item.level + 1), 0);

  const rows = phases.map((phase) => ({
    phase,
    current: phase.slug === currentId,
    past: phase.end < todayIso,
    summary: summaries[phase.slug],
  }));

  return (
    <div className="ys">
      <div className="ys-chart" ref={chartRef}>
        <div className="ys-axis" aria-hidden="true">
          {months.map((month) => (
            <span key={month.key} className="ys-month" style={{ left: `${month.left}%` }}>{month.label}</span>
          ))}
          {showToday && <span className="ys-todaylabel" style={px(todayPos) < 48 ? { left: 0, transform: 'none' } : { left: `${todayPos}%` }}>{t('plan.strip.today', { date: formatDay(todayIso, today) })}</span>}
        </div>

        <div className="ys-bars" role="group" aria-label={t('plan.strip.phasesAria')}>
          {phases.map((phase) => {
            const left = pos(phase.start);
            const widthPct = pos(phase.end) - left + 100 / total;
            const selected = phase.slug === selectedId;
            return (
              <button
                key={phase.slug}
                type="button"
                onClick={() => onSelect(phase.slug)}
                onMouseEnter={() => setHoverId(phase.slug)}
                onMouseLeave={() => setHoverId(null)}
                aria-pressed={selected}
                aria-label={`${t('plan.strip.barAria', { slug: phase.slug, title: phase.title, start: formatDay(phase.start, today), end: formatDay(phase.end, today) })}${phase.slug === currentId ? `, ${t('plan.strip.current')}` : ''}${phase.floating ? `, ${t('plan.strip.floating')}` : ''}`}
                title={`${phase.slug} · ${phase.title}`}
                data-floating={phase.floating ? 'true' : undefined}
                data-hover={hoverId === phase.slug && !selected ? 'true' : undefined}
                className="ys-bar"
                style={{ left: `${left}%`, width: `calc(${widthPct}% - 3px)` }}
              >
                {phase.floating ? `~${phase.slug}` : phase.slug}
              </button>
            );
          })}
        </div>

        <div className="ys-vac" aria-hidden="true">
          {vacations.map((vacation) => (
            <span
              key={vacation.slug}
              title={t('plan.strip.vacationTitle', { slug: vacation.slug, purpose: vacation.purpose })}
              style={{ left: `${pos(vacation.start)}%`, width: `${Math.max(0.6, pos(vacation.end) - pos(vacation.start))}%` }}
            >
              <i>{t('plan.strip.vacation')}</i>
            </span>
          ))}
        </div>

        <div className="ys-miles" style={{ height: Math.max(1, levels) * MILESTONE_LEVEL_HEIGHT + 14, marginTop: 18 }}>
          {placed.map(({ milestone, left, flip, level, text }) => (
            <span
              key={milestone.title}
              className="ys-mile"
              data-flip={flip ? 'true' : undefined}
              style={{ top: level * MILESTONE_LEVEL_HEIGHT + 4, ['--lv' as string]: level, ...(flip ? { right: `${100 - left}%` } : { left: `${left}%` }) }}
            >
              <span><span aria-hidden="true">◆ </span>{milestone.title}<span className="num">{formatDay(milestone.date!, today)}</span></span>
              <span className="sr-only">{text}</span>
            </span>
          ))}
        </div>

        {showToday && <span className="ys-todayline" style={{ left: `${todayPos}%` }} aria-hidden="true" />}
      </div>

      <div className="ys-legend" role="group" aria-label={t('plan.strip.legendAria')}>
        <div className="col-head hidden gap-4 pb-2 md:grid" style={{ gridTemplateColumns: '2.75rem 10.5rem minmax(0,1fr) 4.5rem 4.5rem 4.5rem' }}>
          <span>{t('plan.strip.colPhase')}</span><span>{t('plan.strip.colPeriod')}</span><span>{t('plan.strip.colTitle')}</span><span>{t('plan.strip.colState')}</span><span className="text-right">{t('plan.strip.colDone')}</span><span className="text-right">{t('plan.strip.colHours')}</span>
        </div>
        {rows.map(({ phase, current, past, summary }) => {
          const selected = phase.slug === selectedId;
          const trackLeft = pos(phase.start);
          const trackWidth = pos(phase.end) - trackLeft + 100 / total;
          return (
            <button
              key={phase.slug}
              type="button"
              className="ys-row"
              aria-pressed={selected}
              onClick={() => onSelect(phase.slug)}
              onMouseEnter={() => setHoverId(phase.slug)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(phase.slug)}
              onBlur={() => setHoverId(null)}
              data-hover={hoverId === phase.slug ? 'true' : undefined}
            >
              <span className="ys-code">{phase.floating ? `~${phase.slug}` : phase.slug}</span>
              <span className="ys-dates">{formatDay(phase.start, today)} → {formatDay(phase.end, today)}</span>
              <span className="ys-title">
                {phase.title}
                {phase.floating && <span className="ml-2 text-xs text-gray-500">{t('plan.strip.floating')}</span>}
              </span>
              <span className="ys-state" data-on={current ? 'true' : undefined}>{current ? t('plan.strip.now') : past ? t('plan.strip.ended') : ''}</span>
              <span className="ys-num">{summary ? `${summary.done}/${summary.total}` : '—'}</span>
              <span className="ys-num">{summary ? `~${summary.hours} h` : '—'}</span>
              <span className="ys-track" aria-hidden="true">
                <i style={{ left: `${trackLeft}%`, width: `${trackWidth}%` }} />
                {showToday && <b style={{ left: `${todayPos}%` }} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
