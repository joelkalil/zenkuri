import { ChevronDown, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n';
import type { PlanEditor } from '../../hooks/usePlanEditor';
import { formatDay } from '../../lib/planDates';
import type { PlanPhase } from '../../types/plan';
import { ConfirmDelete } from './ConfirmDelete';
import { EntriesEditor } from './EntriesEditor';
import { PhaseForm } from './PhaseForm';
import { ReorderButtons } from './ReorderButtons';

interface PhaseEditorProps {
  phase: PlanPhase;
  phases: PlanPhase[];
  index: number;
  editor: PlanEditor;
}

/** One phase: header with actions and, when open, the phase form and its entries. */
export function PhaseEditor({ phase, phases, index, editor }: PhaseEditorProps) {
  const { t, plural } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const bodyId = `pe-phase-${phase.id}`;

  return (
    <li className="pe-phase" data-open={open}>
      <div className="pe-phase-head">
        <button type="button" className="pe-phase-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((value) => !value)}>
          <ChevronDown className="pe-chevron h-4 w-4" aria-hidden="true" />
          <span className="pe-phase-slug num">{phase.slug}</span>
          <span className="pe-phase-title">{phase.title}</span>
          <span className="pe-phase-meta num">
            {formatDay(phase.start)} → {formatDay(phase.end)} · {plural('plan.gameCount', phase.entries.length)}
          </span>
        </button>
        <div className="pe-actions">
          <ReorderButtons label={t('plan.phase.itemLabel', { slug: phase.slug })} isFirst={index === 0} isLast={index === phases.length - 1} onMove={(direction) => { void editor.movePhase(phase.id, direction); }} />
          <button type="button" className="icon-btn" aria-label={t('plan.phase.editAria', { slug: phase.slug })} title={t('plan.phase.editTitle')} onClick={() => { setOpen(true); setEditing(true); }}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <ConfirmDelete
            label={t('plan.phase.itemLabel', { slug: phase.slug })}
            question={plural('plan.phase.deleteQuestion', phase.entries.length, { slug: phase.slug })}
            onConfirm={() => { void editor.deletePhase(phase.id); }}
          />
        </div>
      </div>
      {open && (
        <div className="pe-phase-body" id={bodyId}>
          {editing ? (
            <PhaseForm phase={phase} onSubmit={(values) => editor.updatePhase(phase.id, values)} onCancel={() => setEditing(false)} />
          ) : phase.summary ? (
            <p className="pe-summary">{phase.summary}</p>
          ) : null}
          <EntriesEditor section="phase" phaseId={phase.id} entries={phase.entries} phases={phases} editor={editor} emptyText={t('plan.phase.empty')} />
        </div>
      )}
    </li>
  );
}
