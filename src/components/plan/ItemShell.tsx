import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { ConfirmDelete } from './ConfirmDelete';
import { ReorderButtons } from './ReorderButtons';

interface ItemShellProps {
  title: ReactNode;
  meta?: ReactNode;
  /** item name for accessibility labels */
  label: string;
  index: number;
  count: number;
  editing: boolean;
  /** form shown in place of the row when `editing` */
  form: ReactNode;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  deleteQuestion?: string;
}

/** Row of an editable item (title, meta, reorder, edit, delete) that turns into a form. */
export function ItemShell({ title, meta, label, index, count, editing, form, onEdit, onMove, onDelete, deleteQuestion }: ItemShellProps) {
  const t = useT('plan');
  if (editing) return <li className="pe-item pe-item-editing">{form}</li>;
  return (
    <li className="pe-item">
      <div className="pe-item-main">
        <span className="pe-item-title">{title}</span>
        {meta && <span className="pe-item-meta">{meta}</span>}
      </div>
      <div className="pe-actions">
        <ReorderButtons label={label} isFirst={index === 0} isLast={index === count - 1} onMove={onMove} />
        <button type="button" className="icon-btn" onClick={onEdit} aria-label={t('item.editAria', { label })} title={t('item.editTitle')}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <ConfirmDelete label={label} question={deleteQuestion ?? t('item.deleteQuestion', { label })} onConfirm={onDelete} />
      </div>
    </li>
  );
}
