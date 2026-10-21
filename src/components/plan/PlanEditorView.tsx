import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { SectionHead } from '../SectionHead';
import type { PlanEditor } from '../../hooks/usePlanEditor';
import { isoDay, parseDay } from '../../lib/planDates';
import type { Plan, PlanPhaseInput } from '../../types/plan';
import { LooseEntriesEditor } from './LooseEntriesEditor';
import { MilestonesEditor } from './MilestonesEditor';
import { PhaseEditor } from './PhaseEditor';
import { PhaseForm } from './PhaseForm';
import { PlanSettings } from './PlanSettings';
import { RisksEditor } from './RisksEditor';
import { VacationsEditor } from './VacationsEditor';

const DAY = 86_400_000;

/** Suggestion for the next phase: a free F{n} code and four weeks after the last one. */
function phaseDefaults(plan: Plan): PlanPhaseInput {
  const used = new Set(plan.phases.map((phase) => phase.slug));
  let n = plan.phases.length + 1;
  while (used.has(`F${n}`)) n += 1;
  const last = plan.phases[plan.phases.length - 1];
  const start = last ? new Date(parseDay(last.end).getTime() + DAY) : new Date();
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const to = new Date(from.getTime() + 27 * DAY);
  return { slug: `F${n}`, title: '', start: isoDay(from), end: isoDay(new Date(to.getFullYear(), to.getMonth(), to.getDate())), capacity: plan.weeklyHours * 4, summary: '', floating: false };
}

function Block({ number, title, sub, children }: { number: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="pe-block" aria-label={title}>
      <SectionHead className="sh-wrap" number={number} title={title} sub={sub} />
      {children}
    </section>
  );
}

/** Plan edit mode: settings, phases, loose lists, milestones, vacations and risks. */
export function PlanEditorView({ plan, editor }: { plan: Plan; editor: PlanEditor }) {
  const t = useT('plan');
  const [addingPhase, setAddingPhase] = useState(false);

  return (
    <div className="pe">
      <Block number="01" title={t('editor.plan')}>
        <PlanSettings plan={plan} editor={editor} />
      </Block>

      <Block number="02" title={t('editor.phases')} sub={t('editor.phasesSub')}>
        {plan.phases.length === 0 && !addingPhase && <p className="pe-empty">{t('editor.noPhases')}</p>}
        {plan.phases.length > 0 && (
          <ol className="pe-phases">
            {plan.phases.map((phase, index) => (
              <PhaseEditor key={phase.id} phase={phase} phases={plan.phases} index={index} editor={editor} />
            ))}
          </ol>
        )}
        {addingPhase ? (
          <div className="pe-new">
            <PhaseForm defaults={phaseDefaults(plan)} onSubmit={editor.addPhase} onCancel={() => setAddingPhase(false)} />
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm pe-add" onClick={() => setAddingPhase(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('editor.addPhase')}
          </button>
        )}
      </Block>

      <Block number="03" title={t('editor.loose')} sub={t('editor.looseSub')}>
        <LooseEntriesEditor plan={plan} editor={editor} />
      </Block>

      <Block number="04" title={t('editor.milestones')}>
        <MilestonesEditor milestones={plan.milestones} editor={editor} />
      </Block>

      <Block number="05" title={t('editor.vacations')}>
        <VacationsEditor vacations={plan.vacations} editor={editor} />
      </Block>

      <Block number="06" title={t('editor.risks')}>
        <RisksEditor risks={plan.risks} editor={editor} />
      </Block>
    </div>
  );
}
