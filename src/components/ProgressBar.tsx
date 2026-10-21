import { useT } from '../i18n';

interface ProgressBarProps {
  percent: number;
  className?: string;
  showLabel?: boolean;
  /** Tailwind height class (default: thin 4px bar) */
  height?: string;
}

export function completionColor(percent: number): string {
  if (percent === 100) return 'bg-zk-complete';
  return 'bg-violet-500';
}

export function completionTextColor(percent: number): string {
  if (percent === 100) return 'text-zk-complete';
  return 'text-gray-400';
}

/** Thin bar (4px) on a gray-800 track; the numeric value goes along so it does not rely on color alone. */
export function ProgressBar({ percent, className = '', showLabel = false, height = 'h-1' }: ProgressBarProps) {
  const t = useT('game');
  return (
    <div className={`w-full ${className}`}>
      <div role="progressbar" aria-label={t('progressLabel')} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className={`w-full overflow-hidden bg-gray-800 ${height}`}>
        <div
          className={`${height} transition-[width] duration-200 ${completionColor(percent)}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className={`mt-0.5 block text-right font-mono text-xs font-medium tabular-nums ${completionTextColor(percent)}`}>
          {percent}%
        </span>
      )}
    </div>
  );
}
