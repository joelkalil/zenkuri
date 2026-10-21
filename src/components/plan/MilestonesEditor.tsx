import { Plus } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import type { PlanEditor } from '../../hooks/usePlanEditor';
import { useT } from '../../i18n';
import { formatDayLong } from '../../lib/planDates';
import type { PlanMilestone, PlanMilestoneInput } from '../../types/plan';
import { Field } from './Field';
import { ItemShell } from './ItemShell';

interface MilestoneFormProps {
  milestone?: PlanMilestone;
  onSubmit: (values: PlanMilestoneInput) => Promise<boolean>;
  onCancel: () => void;
}

function MilestoneForm({ milestone, onSubmit, onCancel }: MilestoneFormProps) {
  const t = useT('plan');
  const uid = useId();
  const [title, setTitle] = useState(milestone?.title ?? '');
  const [date, setDate] = useState(milestone?.date ?? '');
  const [label, setLabel] = useState(milestone?.label ?? '');
  const [note, setNote] = useState(milestone?.note ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim() === '') return setProblem(t('milestones.errorTitle'));
    const resolvedLabel = label.trim() !== '' ? label.trim() : date !== '' ? formatDayLong(date) : t('milestones.noDate');
    setProblem(null);
    setSaving(true);
    const ok = await onSubmit({ title: title.trim(), date: date === '' ? null : date, label: resolvedLabel, note: note.trim() });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <form className="pe-form" onSubmit={submit} noValidate>
      <div className="pe-grid">
        <Field label={t('common.title')} htmlFor={`${uid}-title`} invalid={problem !== null} className="pe-span">
          <input id={`${uid}-title`} className="field" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label={t('milestones.date')} htmlFor={`${uid}-date`} hint={t('milestones.dateHint')}>
          <input id={`${uid}-date`} type="date" className="field" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label={t('milestones.label')} htmlFor={`${uid}-label`} hint={t('milestones.labelHint')}>
          <input id={`${uid}-label`} className="field" value={label} maxLength={200} onChange={(event) => setLabel(event.target.value)} />
        </Field>
      </div>
      <Field label={t('common.note')} htmlFor={`${uid}-note`}>
        <textarea id={`${uid}-note`} className="field pe-textarea" rows={2} value={note} maxLength={4000} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {problem && <p className="pe-error" role="alert">{problem}</p>}
      <div className="pe-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? t('common.saving') : milestone ? t('common.save') : t('common.add')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

export function MilestonesEditor({ milestones, editor }: { milestones: PlanMilestone[]; editor: PlanEditor }) {
  const t = useT('plan');
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  return (
    <div className="pe-entries">
      {milestones.length === 0 && editingId !== 'new' && <p className="pe-empty">{t('milestones.empty')}</p>}
      {milestones.length > 0 && (
        <ol className="pe-list">
          {milestones.map((milestone, index) => (
            <ItemShell
              key={milestone.id}
              title={milestone.title}
              meta={[milestone.date ? formatDayLong(milestone.date) : milestone.label, milestone.note].filter(Boolean).join(' · ')}
              label={t('milestones.itemLabel', { title: milestone.title })}
              index={index}
              count={milestones.length}
              editing={editingId === milestone.id}
              onEdit={() => setEditingId(milestone.id)}
              onMove={(direction) => { void editor.moveMilestone(milestone.id, direction); }}
              onDelete={() => { void editor.deleteMilestone(milestone.id); }}
              form={<MilestoneForm milestone={milestone} onSubmit={(values) => editor.updateMilestone(milestone.id, values)} onCancel={() => setEditingId(null)} />}
            />
          ))}
        </ol>
      )}
      {editingId === 'new' ? (
        <div className="pe-new"><MilestoneForm onSubmit={editor.addMilestone} onCancel={() => setEditingId(null)} /></div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm pe-add" onClick={() => setEditingId('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('milestones.add')}
        </button>
      )}
    </div>
  );
}
