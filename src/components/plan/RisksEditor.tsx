import { Plus } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useT } from '../../i18n';
import type { PlanEditor } from '../../hooks/usePlanEditor';
import type { PlanRisk, PlanRiskInput } from '../../types/plan';
import { Field } from './Field';
import { ItemShell } from './ItemShell';

interface RiskFormProps {
  risk?: PlanRisk;
  onSubmit: (values: PlanRiskInput) => Promise<boolean>;
  onCancel: () => void;
}

function RiskForm({ risk, onSubmit, onCancel }: RiskFormProps) {
  const t = useT('plan');
  const uid = useId();
  const [text, setText] = useState(risk?.risk ?? '');
  const [action, setAction] = useState(risk?.action ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim() === '') return setProblem(t('risks.errorDescribe'));
    setProblem(null);
    setSaving(true);
    const ok = await onSubmit({ risk: text.trim(), action: action.trim() });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <form className="pe-form" onSubmit={submit} noValidate>
      <Field label={t('risks.risk')} htmlFor={`${uid}-risk`} invalid={problem !== null}>
        <input id={`${uid}-risk`} className="field" value={text} maxLength={4000} onChange={(event) => setText(event.target.value)} />
      </Field>
      <Field label={t('risks.action')} htmlFor={`${uid}-action`}>
        <textarea id={`${uid}-action`} className="field pe-textarea" rows={2} value={action} maxLength={4000} onChange={(event) => setAction(event.target.value)} />
      </Field>
      {problem && <p className="pe-error" role="alert">{problem}</p>}
      <div className="pe-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? t('common.saving') : risk ? t('common.save') : t('common.add')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

export function RisksEditor({ risks, editor }: { risks: PlanRisk[]; editor: PlanEditor }) {
  const t = useT('plan');
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  return (
    <div className="pe-entries">
      {risks.length === 0 && editingId !== 'new' && <p className="pe-empty">{t('risks.empty')}</p>}
      {risks.length > 0 && (
        <ol className="pe-list">
          {risks.map((risk, index) => (
            <ItemShell
              key={risk.id}
              title={risk.risk}
              meta={risk.action}
              label={t('risks.itemLabel')}
              index={index}
              count={risks.length}
              editing={editingId === risk.id}
              onEdit={() => setEditingId(risk.id)}
              onMove={(direction) => { void editor.moveRisk(risk.id, direction); }}
              onDelete={() => { void editor.deleteRisk(risk.id); }}
              form={<RiskForm risk={risk} onSubmit={(values) => editor.updateRisk(risk.id, values)} onCancel={() => setEditingId(null)} />}
            />
          ))}
        </ol>
      )}
      {editingId === 'new' ? (
        <div className="pe-new"><RiskForm onSubmit={editor.addRisk} onCancel={() => setEditingId(null)} /></div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm pe-add" onClick={() => setEditingId('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('risks.add')}
        </button>
      )}
    </div>
  );
}
