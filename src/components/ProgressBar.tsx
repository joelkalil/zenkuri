interface ProgressBarProps {
  percent: number;
  className?: string;
  showLabel?: boolean;
  height?: string;
}

export function completionColor(percent: number): string {
  if (percent === 100) return 'bg-yellow-400';
  if (percent >= 70) return 'bg-emerald-500';
  if (percent >= 30) return 'bg-amber-400';
  return 'bg-red-500';
}

export function completionTextColor(percent: number): string {
  if (percent === 100) return 'text-yellow-400';
  if (percent >= 70) return 'text-emerald-400';
  if (percent >= 30) return 'text-amber-400';
  return 'text-red-400';
}

export function ProgressBar({ percent, className = '', showLabel = false, height = 'h-1.5' }: ProgressBarProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full bg-gray-800 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} rounded-full transition-all duration-500 ${completionColor(percent)}`}
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
