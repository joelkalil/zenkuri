import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useT } from '../../i18n';

interface ConfirmDeleteProps {
  /** item name, used in the labels */
  label: string;
  /** question shown before confirming */
  question: string;
  onConfirm: () => void;
}

/** Trash button that asks for inline confirmation before deleting. */
export function ConfirmDelete({ label, question, onConfirm }: ConfirmDeleteProps) {
  const t = useT('plan');
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="icon-btn" onClick={() => setAsking(true)} aria-label={t('item.deleteAria', { label })} title={t('item.deleteTitle')}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="pe-confirm" role="alertdialog" aria-label={t('item.deleteConfirmAria', { label })}>
      <p>{question}</p>
      <div className="pe-confirm-actions">
        <button type="button" className="btn btn-danger btn-sm" onClick={() => { setAsking(false); onConfirm(); }}>{t('item.deleteConfirm')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}
