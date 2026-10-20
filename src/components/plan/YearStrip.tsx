import type { PlanMilestone, PlanPhase, PlanVacation } from '../../data/plan';
import { PLAN_END, PLAN_START, daysBetween, formatDay, monthShort, parseDay } from '../../lib/planDates';

interface YearStripProps {
  phases: PlanPhase[];
  milestones: PlanMilestone[];
  vacations: PlanVacation[];
  today: Date;
  currentId: string | null;
  selectedId: string;
  onSelect: (id: string) => void;
}

/**
 * O ano do plano em uma faixa. Cada fase é um botão do tamanho da sua
 * duração; escolher uma mostra a lista dela logo abaixo. Férias e lançamentos
 * ficam marcados embaixo, e a linha de hoje atravessa a faixa.
 */
export function YearStrip({ phases, milestones, vacations, today, currentId, selectedId, onSelect }: YearStripProps) {
  const start = parseDay(PLAN_START);
  const total = daysBetween(start, parseDay(PLAN_END)) + 1;
  const pos = (iso: string) => (daysBetween(start, parseDay(iso)) / total) * 100;
  const todayPos = (daysBetween(start, today) / total) * 100;

  const months = Array.from({ length: 13 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const left = (daysBetween(start, date) / total) * 100;
    const label = date.getMonth() === 0 ? `${monthShort(0)} ${String(date.getFullYear()).slice(2)}` : monthShort(date.getMonth());
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label, left: Math.max(0, left) };
  }).filter((month) => month.left < 97);

  const dated = milestones.filter((milestone) => milestone.date && milestone.date <= PLAN_END);
  // O rótulo "hoje" some quando encostaria no nome de um lançamento; a linha fica.
  const showTodayLabel = !dated.some((milestone) => {
    const gap = pos(milestone.date!) - todayPos;
    return gap > -4 && gap < 6;
  });

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="relative min-w-[760px]">
        <div className="relative h-6" aria-hidden="true">
          {months.map((month) => (
            <span key={month.key} className="absolute top-0 text-xs text-gray-500" style={{ left: `${month.left}%` }}>
              {month.label}
            </span>
          ))}
        </div>

        <div className="relative h-14" role="group" aria-label="Fases do plano">
          {phases.map((phase) => {
            const left = pos(phase.start);
            const width = pos(phase.end) - left + 100 / total;
            const selected = phase.id === selectedId;
            const current = phase.id === currentId;
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => onSelect(phase.id)}
                aria-pressed={selected}
                aria-label={`${phase.id}, ${phase.title}, ${formatDay(phase.start, today)} a ${formatDay(phase.end, today)}${current ? ', fase atual' : ''}${phase.floating ? ', datas móveis' : ''}`}
                title={`${phase.id} · ${phase.title}`}
                className={`absolute inset-y-0 flex min-w-0 flex-col justify-center overflow-hidden rounded-[10px] border px-3 text-left transition-colors duration-200 ${
                  selected
                    ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)]'
                    : `bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-100 ${phase.floating ? 'border-dashed border-gray-700' : 'border-gray-800'}`
                }`}
                style={{ left: `${left}%`, width: `calc(${width}% - 4px)` }}
              >
                <span className={`text-xs font-semibold tabular-nums ${selected ? 'opacity-75' : current ? 'text-violet-400' : 'text-gray-500'}`}>
                  {phase.id}{current ? ' · agora' : ''}
                </span>
                <span className="truncate text-sm font-medium">{phase.title}</span>
              </button>
            );
          })}
          {todayPos >= 0 && todayPos <= 100 && (
            <span className="pointer-events-none absolute -bottom-2 -top-1 w-0.5 rounded-full bg-gray-100" style={{ left: `${todayPos}%` }} aria-hidden="true" />
          )}
        </div>

        <div className="relative mt-2 h-10" aria-hidden="true">
          {vacations.map((vacation) => (
            <span
              key={vacation.id}
              className="absolute top-1 h-1 rounded-full bg-emerald-400"
              style={{ left: `${pos(vacation.start)}%`, width: `${Math.max(0.6, pos(vacation.end) - pos(vacation.start))}%` }}
              title={`Férias ${vacation.id}: ${vacation.purpose}`}
            />
          ))}
          {showTodayLabel && todayPos >= 0 && todayPos <= 100 && (
            <span className="absolute top-4 text-xs font-medium text-gray-100" style={{ left: `${todayPos}%` }}>hoje</span>
          )}
          {dated.map((milestone) => (
            <span key={milestone.title} className="absolute top-3.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-400" style={{ left: `${pos(milestone.date!)}%` }}>
              <span className="h-2.5 w-0.5 rounded-full bg-amber-400" />
              {milestone.title}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-2"><span className="h-1 w-4 rounded-full bg-emerald-400" aria-hidden="true" /> Férias</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-0.5 rounded-full bg-amber-400" aria-hidden="true" /> Lançamento</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-4 rounded border border-dashed border-gray-500" aria-hidden="true" /> Datas móveis</span>
      </p>
    </div>
  );
}
