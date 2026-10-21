import { useEffect, useRef, useState } from 'react';
import type { PlanMilestone, PlanPhase, PlanVacation } from '../../data/plan';
import { PLAN_END, PLAN_START, daysBetween, formatDay, isoDay, monthShort, parseDay } from '../../lib/planDates';
import '../../styles/plano.css';

export interface PhaseSummary {
  done: number;
  total: number;
  /** horas planejadas na fase */
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
 * O ano do plano. Barras mostram só o código da fase (F1–F6); título, datas e
 * progresso ficam na tabela-legenda logo abaixo. "Hoje" é uma linha vertical
 * com o rótulo na linha do eixo; marcos têm linha própria, escalonados.
 */
export function YearStrip({ phases, milestones, vacations, summaries, today, currentId, selectedId, onSelect }: YearStripProps) {
  const [chartRef, width] = useWidth();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const start = parseDay(PLAN_START);
  const total = daysBetween(start, parseDay(PLAN_END)) + 1;
  const pos = (iso: string) => (daysBetween(start, parseDay(iso)) / total) * 100;
  const todayPos = (daysBetween(start, today) / total) * 100;
  const showToday = todayPos >= 0 && todayPos <= 100;
  const todayIso = isoDay(today);
  const px = (percent: number) => (percent / 100) * width;

  const months = Array.from({ length: 13 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const left = Math.max(0, (daysBetween(start, date) / total) * 100);
    const jan = date.getMonth() === 0;
    const label = jan || index === 0 ? `${monthShort(date.getMonth())} ${String(date.getFullYear()).slice(2)}` : monthShort(date.getMonth());
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label, left, important: jan || index === 0, odd: index % 2 === 1 };
  })
    .filter((month) => month.left < 96)
    // Sem espaço, só os meses pares (e janeiro/primeiro mês).
    .filter((month) => width >= 900 || month.important || !month.odd);

  const dated = milestones
    .filter((milestone) => milestone.date && milestone.date >= PLAN_START && milestone.date <= PLAN_END)
    .map((milestone) => ({ milestone, left: pos(milestone.date!) }))
    .sort((a, b) => a.left - b.left);

  // Escalona os marcos em até 3 níveis quando os rótulos se encostariam.
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
    current: phase.id === currentId,
    past: phase.end < todayIso,
    summary: summaries[phase.id],
  }));

  return (
    <div className="ys">
      <div className="ys-chart" ref={chartRef}>
        <div className="ys-axis" aria-hidden="true">
          {months.map((month) => (
            <span key={month.key} className="ys-month" style={{ left: `${month.left}%` }}>{month.label}</span>
          ))}
          {showToday && <span className="ys-todaylabel" style={px(todayPos) < 48 ? { left: 0, transform: 'none' } : { left: `${todayPos}%` }}>hoje · {formatDay(todayIso, today)}</span>}
        </div>

        <div className="ys-bars" role="group" aria-label="Fases do plano">
          {phases.map((phase) => {
            const left = pos(phase.start);
            const widthPct = pos(phase.end) - left + 100 / total;
            const selected = phase.id === selectedId;
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => onSelect(phase.id)}
                onMouseEnter={() => setHoverId(phase.id)}
                onMouseLeave={() => setHoverId(null)}
                aria-pressed={selected}
                aria-label={`${phase.id}, ${phase.title}, ${formatDay(phase.start, today)} a ${formatDay(phase.end, today)}${phase.id === currentId ? ', fase atual' : ''}${phase.floating ? ', datas móveis' : ''}`}
                title={`${phase.id} · ${phase.title}`}
                data-floating={phase.floating ? 'true' : undefined}
                data-hover={hoverId === phase.id && !selected ? 'true' : undefined}
                className="ys-bar"
                style={{ left: `${left}%`, width: `calc(${widthPct}% - 3px)` }}
              >
                {phase.floating ? `~${phase.id}` : phase.id}
              </button>
            );
          })}
        </div>

        <div className="ys-vac" aria-hidden="true">
          {vacations.map((vacation) => (
            <span
              key={vacation.id}
              title={`Férias ${vacation.id}: ${vacation.purpose}`}
              style={{ left: `${pos(vacation.start)}%`, width: `${Math.max(0.6, pos(vacation.end) - pos(vacation.start))}%` }}
            >
              <i>Férias</i>
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

      <div className="ys-legend" role="group" aria-label="Legenda das fases">
        <div className="col-head hidden gap-4 pb-2 md:grid" style={{ gridTemplateColumns: '2.75rem 10.5rem minmax(0,1fr) 4.5rem 4.5rem 4.5rem' }}>
          <span>Fase</span><span>Período</span><span>Título</span><span>Estado</span><span className="text-right">Feitos</span><span className="text-right">Horas</span>
        </div>
        {rows.map(({ phase, current, past, summary }) => {
          const selected = phase.id === selectedId;
          const trackLeft = pos(phase.start);
          const trackWidth = pos(phase.end) - trackLeft + 100 / total;
          return (
            <button
              key={phase.id}
              type="button"
              className="ys-row"
              aria-pressed={selected}
              onClick={() => onSelect(phase.id)}
              onMouseEnter={() => setHoverId(phase.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(phase.id)}
              onBlur={() => setHoverId(null)}
              data-hover={hoverId === phase.id ? 'true' : undefined}
            >
              <span className="ys-code">{phase.floating ? `~${phase.id}` : phase.id}</span>
              <span className="ys-dates">{formatDay(phase.start, today)} → {formatDay(phase.end, today)}</span>
              <span className="ys-title">
                {phase.title}
                {phase.floating && <span className="ml-2 text-xs text-gray-500">datas móveis</span>}
              </span>
              <span className="ys-state" data-on={current ? 'true' : undefined}>{current ? 'agora' : past ? 'encerrada' : ''}</span>
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
