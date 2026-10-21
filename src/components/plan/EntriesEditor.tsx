import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { PlanEditor } from '../../hooks/usePlanEditor';
import { useI18n } from '../../i18n';
import type { PlanEntry, PlanPhase, PlanSection } from '../../types/plan';
import { EntryForm, type EntryFields } from './EntryForm';
import { ItemShell } from './ItemShell';

interface EntriesEditorProps {
  section: PlanSection;
  /** required in the "phase" section */
  phaseId?: number;
  entries: PlanEntry[];
  phases?: PlanPhase[];
  editor: PlanEditor;
  /** add button text (defaults to the generic "add game" label) */
  addLabel?: string;
  emptyText?: string;
}

/** Editable list of the entries of a phase or of a loose list. */
export function EntriesEditor({ section, phaseId, entries, phases, editor, addLabel, emptyText }: EntriesEditorProps) {
  const { t, formatNumber } = useI18n();
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);

  function describe(entry: PlanEntry) {
    const parts: string[] = [];
    if (entry.hours !== null) parts.push(t('plan.common.hours', { hours: formatNumber(entry.hours) }));
    if (entry.kind) parts.push(t(`plan.kind.${entry.kind}`));
    if (entry.target !== null) parts.push(t('plan.entries.target', { target: entry.target }));
    if (!entry.ref) parts.push(entry.external?.label ?? t('plan.entries.outsideLibrary'));
    if (entry.note) parts.push(entry.note);
    return parts.join(' · ');
  }

  const create = (fields: EntryFields) => editor.addEntry({ ...fields, section, phaseId: section === 'phase' ? phaseId ?? null : null });
  const update = (entry: PlanEntry) => (fields: EntryFields, nextPhaseId: number | null) =>
    editor.updateEntry(entry, { ...fields, ...(section === 'phase' && nextPhaseId !== null ? { phaseId: nextPhaseId } : {}) });

  return (
    <div className="pe-entries">
      {entries.length === 0 && editingId !== 'new' && <p className="pe-empty">{emptyText ?? t('plan.entries.empty')}</p>}
      {entries.length > 0 && (
        <ol className="pe-list">
          {entries.map((entry, index) => (
            <ItemShell
              key={entry.id}
              title={entry.title}
              meta={describe(entry)}
              label={entry.title}
              index={index}
              count={entries.length}
              editing={editingId === entry.id}
              onEdit={() => setEditingId(entry.id)}
              onMove={(direction) => { void editor.moveEntry(entry, direction); }}
              onDelete={() => { void editor.deleteEntry(entry); }}
              form={<EntryForm section={section} entry={entry} phases={phases} onSubmit={update(entry)} onCancel={() => setEditingId(null)} />}
            />
          ))}
        </ol>
      )}
      {editingId === 'new' ? (
        <div className="pe-new">
          <EntryForm section={section} onSubmit={create} onCancel={() => setEditingId(null)} />
        </div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm pe-add" onClick={() => setEditingId('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {addLabel ?? t('plan.entries.addGame')}
        </button>
      )}
    </div>
  );
}
