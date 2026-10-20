interface ProgressBarProps {
  percent: number;
  className?: string;
  showLabel?: boolean;
  height?: string;
}

export function completionColor(percent: number): string {
  if (percent === 100) return 'bg-emerald-500';
  return 'bg-violet-400';
}

export function completionTextColor(percent: number): string {
  if (percent === 100) return 'text-emerald-400';
  return 'text-gray-500';
}

export function ProgressBar({ percent, className = '', showLabel = false, height = 'h-1.5' }: ProgressBarProps) {
  return (
    <div className={`w-full ${className}`}>
      <div role="progressbar" aria-label="Conclusão do jogo" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className={`w-full bg-gray-800 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} rounded-full transition-[width] duration-300 ${completionColor(percent)}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-mono font-semibold mt-0.5 block text-right ${completionTextColor(percent)}`}>
          {percent}%
        </span>
      )}
    </div>
  );
}
