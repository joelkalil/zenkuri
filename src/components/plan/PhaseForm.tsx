import { useId, useState, type FormEvent } from 'react';
import { useT } from '../../i18n';
import type { PlanPhase, PlanPhaseInput } from '../../types/plan';
import { Field } from './Field';

interface PhaseFormProps {
  phase?: PlanPhase;
  /** initial values of a new phase (suggested slug and dates) */
  defaults?: PlanPhaseInput;
  onSubmit: (values: PlanPhaseInput) => Promise<boolean>;
  onCancel: () => void;
}

export function PhaseForm({ phase, defaults, onSubmit, onCancel }: PhaseFormProps) {
  const t = useT('plan');
  const uid = useId();
  const [title, setTitle] = useState(phase?.title ?? defaults?.title ?? '');
  const [slug, setSlug] = useState(phase?.slug ?? defaults?.slug ?? '');
  const [start, setStart] = useState(phase?.start ?? defaults?.start ?? '');
  const [end, setEnd] = useState(phase?.end ?? defaults?.end ?? '');
  const [capacity, setCapacity] = useState(String(phase?.capacity ?? defaults?.capacity ?? 100));
  const [summary, setSummary] = useState(phase?.summary ?? defaults?.summary ?? '');
  const [floating, setFloating] = useState(phase?.floating ?? defaults?.floating ?? false);
  const [problem, setProblem] = useState<string | null>(null);
  /** field of the current validation problem, for `aria-invalid` */
  const [problemField, setProblemField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const hours = Number(capacity);
    const fail = (field: string, message: string) => {
      setProblemField(field);
      setProblem(message);
    };
    if (title.trim() === '') return fail('title', t('phaseForm.errors.title'));
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(slug.trim())) return fail('slug', t('phaseForm.errors.slug'));
    if (start === '' || end === '') return fail(start === '' ? 'start' : 'end', t('phaseForm.errors.dates'));
    if (end < start) return fail('end', t('validation.endBeforeStart'));
    if (!Number.isFinite(hours) || hours < 0 || hours > 100000) return fail('capacity', t('phaseForm.errors.capacity'));
    setProblemField(null);
    setProblem(null);
    setSaving(true);
    const ok = await onSubmit({ slug: slug.trim(), title: title.trim(), start, end, capacity: hours, summary: summary.trim(), floating });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <form className="pe-form" onSubmit={submit} noValidate>
      <div className="pe-grid">
        <Field label={t('common.title')} htmlFor={`${uid}-title`} invalid={problemField === 'title'} className="pe-span">
          <input id={`${uid}-title`} className="field" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label={t('phaseForm.code')} htmlFor={`${uid}-slug`} invalid={problemField === 'slug'} hint={t('phaseForm.codeHint')}>
          <input id={`${uid}-slug`} className="field num" value={slug} maxLength={32} onChange={(event) => setSlug(event.target.value)} />
        </Field>
        <Field label={t('phaseForm.capacity')} htmlFor={`${uid}-cap`} invalid={problemField === 'capacity'}>
          <input id={`${uid}-cap`} className="field num" inputMode="decimal" value={capacity} onChange={(event) => setCapacity(event.target.value)} />
        </Field>
        <Field label={t('common.start')} htmlFor={`${uid}-start`} invalid={problemField === 'start'}>
          <input id={`${uid}-start`} type="date" className="field" value={start} onChange={(event) => setStart(event.target.value)} />
        </Field>
        <Field label={t('common.end')} htmlFor={`${uid}-end`} invalid={problemField === 'end'}>
          <input id={`${uid}-end`} type="date" className="field" value={end} onChange={(event) => setEnd(event.target.value)} />
        </Field>
      </div>
      <Field label={t('phaseForm.summary')} htmlFor={`${uid}-summary`}>
        <textarea id={`${uid}-summary`} className="field pe-textarea" rows={2} value={summary} maxLength={4000} onChange={(event) => setSummary(event.target.value)} />
      </Field>
      <label className="pe-check">
        <input type="checkbox" checked={floating} onChange={(event) => setFloating(event.target.checked)} />
        {t('phaseForm.floating')}
      </label>
      {problem && <p className="pe-error" role="alert">{problem}</p>}
      <div className="pe-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? t('common.saving') : phase ? t('phaseForm.savePhase') : t('phaseForm.addPhase')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
