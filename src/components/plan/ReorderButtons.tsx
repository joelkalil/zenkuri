import { ArrowDown, ArrowUp } from 'lucide-react';
import { useT } from '../../i18n';

interface ReorderButtonsProps {
  /** item name, used in the accessibility labels */
  label: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}

export function ReorderButtons({ label, isFirst, isLast, onMove }: ReorderButtonsProps) {
  const t = useT('plan');
  return (
    <>
      <button type="button" className="icon-btn" disabled={isFirst} onClick={() => onMove(-1)} aria-label={t('item.moveUpAria', { label })} title={t('item.moveUpTitle')}>
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn" disabled={isLast} onClick={() => onMove(1)} aria-label={t('item.moveDownAria', { label })} title={t('item.moveDownTitle')}>
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  );
}
