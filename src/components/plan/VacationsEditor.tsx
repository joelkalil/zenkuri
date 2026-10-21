import { Plus } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n';
import type { PlanEditor } from '../../hooks/usePlanEditor';
import { daysBetween, formatDayLong, parseDay } from '../../lib/planDates';
import type { PlanVacation, PlanVacationInput } from '../../types/plan';
import { Field } from './Field';
import { ItemShell } from './ItemShell';

/** Calendar days between two dates, counting both ends. */
function inclusiveDays(start: string, end: string) {
  return daysBetween(parseDay(start), parseDay(end)) + 1;
}

/** Next free code in the V{n} format. */
function nextSlug(vacations: PlanVacation[]) {
  const used = new Set(vacations.map((item) => item.slug));
  let n = vacations.length + 1;
  while (used.has(`V${n}`)) n += 1;
  return `V${n}`;
}

interface VacationFormProps {
  vacation?: PlanVacation;
  slug: string;
  onSubmit: (values: PlanVacationInput) => Promise<boolean>;
  onCancel: () => void;
}

function VacationForm({ vacation, slug, onSubmit, onCancel }: VacationFormProps) {
  const { t, plural } = useI18n();
  const uid = useId();
  const [start, setStart] = useState(vacation?.start ?? '');
  const [end, setEnd] = useState(vacation?.end ?? '');
  const [purpose, setPurpose] = useState(vacation?.purpose ?? '');
  const [note, setNote] = useState(vacation?.note ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const days = start !== '' && end !== '' && end >= start ? inclusiveDays(start, end) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (start === '' || end === '') return setProblem(t('plan.vacations.errorRange'));
    if (end < start) return setProblem(t('plan.validation.endBeforeStart'));
    if (purpose.trim() === '') return setProblem(t('plan.vacations.errorPurpose'));
    setProblem(null);
    setSaving(true);
    const ok = await onSubmit({ slug, start, end, days: inclusiveDays(start, end), purpose: purpose.trim(), note: note.trim() });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <form className="pe-form" onSubmit={submit} noValidate>
      <div className="pe-grid">
        <Field label={t('plan.common.start')} htmlFor={`${uid}-start`}>
          <input id={`${uid}-start`} type="date" className="field" value={start} onChange={(event) => setStart(event.target.value)} />
        </Field>
        <Field label={t('plan.common.end')} htmlFor={`${uid}-end`} hint={days !== null ? plural('plan.dayCount', days) : t('plan.vacations.daysHint')}>
          <input id={`${uid}-end`} type="date" className="field" value={end} onChange={(event) => setEnd(event.target.value)} />
        </Field>
        <Field label={t('plan.vacations.purpose')} htmlFor={`${uid}-purpose`} className="pe-span">
          <input id={`${uid}-purpose`} className="field" value={purpose} maxLength={200} onChange={(event) => setPurpose(event.target.value)} />
        </Field>
      </div>
      <Field label={t('plan.common.note')} htmlFor={`${uid}-note`}>
        <textarea id={`${uid}-note`} className="field pe-textarea" rows={2} value={note} maxLength={4000} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {problem && <p className="pe-error" role="alert">{problem}</p>}
      <div className="pe-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? t('plan.common.saving') : vacation ? t('plan.common.save') : t('plan.common.add')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t('plan.common.cancel')}</button>
      </div>
    </form>
  );
}

export function VacationsEditor({ vacations, editor }: { vacations: PlanVacation[]; editor: PlanEditor }) {
  const { t, plural } = useI18n();
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  return (
    <div className="pe-entries">
      {vacations.length === 0 && editingId !== 'new' && <p className="pe-empty">{t('plan.vacations.empty')}</p>}
      {vacations.length > 0 && (
        <ol className="pe-list">
          {vacations.map((vacation, index) => (
            <ItemShell
              key={vacation.id}
              title={<>{vacation.slug} · {vacation.purpose}</>}
              meta={`${formatDayLong(vacation.start)} → ${formatDayLong(vacation.end)} · ${plural('plan.dayCount', vacation.days)}`}
              label={t('plan.vacations.itemLabel', { slug: vacation.slug })}
              index={index}
              count={vacations.length}
              editing={editingId === vacation.id}
              onEdit={() => setEditingId(vacation.id)}
              onMove={(direction) => { void editor.moveVacation(vacation.id, direction); }}
              onDelete={() => { void editor.deleteVacation(vacation.id); }}
              form={<VacationForm vacation={vacation} slug={vacation.slug} onSubmit={(values) => editor.updateVacation(vacation.id, values)} onCancel={() => setEditingId(null)} />}
            />
          ))}
        </ol>
      )}
      {editingId === 'new' ? (
        <div className="pe-new"><VacationForm slug={nextSlug(vacations)} onSubmit={editor.addVacation} onCancel={() => setEditingId(null)} /></div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm pe-add" onClick={() => setEditingId('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('plan.vacations.add')}
        </button>
      )}
    </div>
  );
}
