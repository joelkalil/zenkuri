import { useT } from '../../i18n';
import type { PlanEditor } from '../../hooks/usePlanEditor';
import type { Plan, PlanSection } from '../../types/plan';
import { EntriesEditor } from './EntriesEditor';

interface LooseGroup {
  section: Exclude<PlanSection, 'phase'>;
  messageKey: 'recurring' | 'after' | 'accept' | 'ifTime';
  pick: (plan: Plan) => Plan['recurring'];
}

const GROUPS: LooseGroup[] = [
  { section: 'recurring', messageKey: 'recurring', pick: (plan) => plan.recurring },
  { section: 'after', messageKey: 'after', pick: (plan) => plan.afterPlan },
  { section: 'accept', messageKey: 'accept', pick: (plan) => plan.acceptAsIs },
  { section: 'if_time', messageKey: 'ifTime', pick: (plan) => plan.ifTime },
];

/** The four lists outside the phases: recurring, after, accept as is, only if there is time. */
export function LooseEntriesEditor({ plan, editor }: { plan: Plan; editor: PlanEditor }) {
  const t = useT('plan');
  return (
    <div className="pe-loose">
      {GROUPS.map((group) => (
        <div key={group.section} className="pe-loose-group">
          <h3 className="pe-subtitle">{t(`loose.${group.messageKey}.title`)}</h3>
          <p className="pe-hint">{t(`loose.${group.messageKey}.hint`)}</p>
          <EntriesEditor section={group.section} entries={group.pick(plan)} editor={editor} />
        </div>
      ))}
    </div>
  );
}
