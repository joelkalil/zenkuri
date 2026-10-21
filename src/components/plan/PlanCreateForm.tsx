import { useId, useState, type FormEvent } from 'react';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { useT } from '../../i18n';
import { createPlanApi } from '../../lib/api';
import type { Plan } from '../../types/plan';
import { Field } from './Field';

/** Empty state of the page: there is no plan yet; asks for title, weekly hours and principle. */
export function PlanCreateForm({ onCreated }: { onCreated: (plan: Plan) => void }) {
  const t = useT('plan');
  const describe = useErrorMessage();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(() => t('create.defaultTitle'));
  const [weeklyHours, setWeeklyHours] = useState('10');
  const [principle, setPrinciple] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const hours = Number(weeklyHours.replace(',', '.'));
    if (title.trim() === '') return setProblem(t('validation.planTitle'));
    if (!Number.isFinite(hours) || hours < 0 || hours > 168) return setProblem(t('validation.weeklyHours'));
    setProblem(null);
    setSaving(true);
    try {
      onCreated(await createPlanApi({ title: title.trim(), weeklyHours: hours, principle: principle.trim() }));
    } catch (err) {
      setProblem(describe(err));
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="empty-state">
        <strong>{t('create.emptyTitle')}</strong>
        <span>{t('create.emptyBody')}</span>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>{t('create.open')}</button>
      </div>
    );
  }

  return (
    <form className="pe-form pe-create" onSubmit={submit} noValidate aria-label={t('create.formAria')}>
      <Field label={t('common.title')} htmlFor={`${uid}-title`}>
        <input id={`${uid}-title`} className="field" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label={t('create.weeklyHours')} htmlFor={`${uid}-hours`}>
        <input id={`${uid}-hours`} className="field num" inputMode="decimal" value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} />
      </Field>
      <Field label={t('create.principle')} htmlFor={`${uid}-principle`} hint={t('create.principleHint')}>
        <textarea id={`${uid}-principle`} className="field pe-textarea" rows={3} value={principle} maxLength={4000} onChange={(event) => setPrinciple(event.target.value)} />
      </Field>
      {problem && <p className="pe-error" role="alert">{problem}</p>}
      <div className="pe-form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('create.creating') : t('create.submit')}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
