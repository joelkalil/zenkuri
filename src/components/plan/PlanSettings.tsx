import { useId, useState, type FormEvent } from 'react';
import { useT } from '../../i18n';
import type { PlanEditor } from '../../hooks/usePlanEditor';
import type { Plan, PlanInput } from '../../types/plan';
import { Field } from './Field';

function parseOptional(text: string): number | null {
  if (text.trim() === '') return null;
  return Number(text.replace(',', '.'));
}

/** Plan title, weekly hours, principle and starting/target averages. */
export function PlanSettings({ plan, editor }: { plan: Plan; editor: PlanEditor }) {
  const t = useT('plan');
  const uid = useId();
  const [title, setTitle] = useState(plan.title);
  const [weeklyHours, setWeeklyHours] = useState(String(plan.weeklyHours));
  const [principle, setPrinciple] = useState(plan.principle);
  const [baseline, setBaseline] = useState(plan.baselineAvg === null ? '' : String(plan.baselineAvg));
  const [target, setTarget] = useState(plan.targetAvg === null ? '' : String(plan.targetAvg));
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const hours = Number(weeklyHours.replace(',', '.'));
    const baselineAvg = parseOptional(baseline);
    const targetAvg = parseOptional(target);
    if (title.trim() === '') return setProblem(t('validation.planTitle'));
    if (!Number.isFinite(hours) || hours < 0 || hours > 168) return setProblem(t('validation.weeklyHours'));
    for (const value of [baselineAvg, targetAvg]) {
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) return setProblem(t('settings.errorAverages'));
    }
    setProblem(null);
    const patch: PlanInput = { title: title.trim(), weeklyHours: hours, principle: principle.trim(), baselineAvg, targetAvg };
    setSaved(await editor.updatePlan(patch));
  }

  return (
    <form className="pe-form" onSubmit={submit} noValidate onChange={() => setSaved(false)}>
      <div className="pe-grid pe-grid-3">
        <Field label={t('common.title')} htmlFor={`${uid}-title`} className="pe-span">
          <input id={`${uid}-title`} className="field" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label={t('settings.weeklyHours')} htmlFor={`${uid}-hours`}>
          <input id={`${uid}-hours`} className="field num" inputMode="decimal" value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} />
        </Field>
        <Field label={t('settings.baseline')} htmlFor={`${uid}-baseline`} hint={t('common.optional')}>
          <input id={`${uid}-baseline`} className="field num" inputMode="decimal" value={baseline} onChange={(event) => setBaseline(event.target.value)} />
        </Field>
        <Field label={t('settings.target')} htmlFor={`${uid}-target`} hint={t('common.optional')}>
          <input id={`${uid}-target`} className="field num" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
        </Field>
      </div>
      <Field label={t('settings.principle')} htmlFor={`${uid}-principle`}>
        <textarea id={`${uid}-principle`} className="field pe-textarea" rows={3} value={principle} maxLength={4000} onChange={(event) => setPrinciple(event.target.value)} />
      </Field>
      {problem && <p className="pe-error" role="alert">{problem}</p>}
      <div className="pe-form-actions">
        <button type="submit" className="btn btn-primary btn-sm">{t('settings.save')}</button>
        <span role="status" className="pe-hint">{saved && t('settings.saved')}</span>
      </div>
    </form>
  );
}
