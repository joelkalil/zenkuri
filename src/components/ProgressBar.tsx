interface ProgressBarProps {
  percent: number;
  className?: string;
  showLabel?: boolean;
  /** classe Tailwind de altura (padrão: barra fina de 4px) */
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

/** Barra fina (4px) sobre trilho gray-800; o valor numérico acompanha para não depender só da cor. */
export function ProgressBar({ percent, className = '', showLabel = false, height = 'h-1' }: ProgressBarProps) {
  return (
    <div className={`w-full ${className}`}>
      <div role="progressbar" aria-label="Conclusão do jogo" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className={`w-full overflow-hidden bg-gray-800 ${height}`}>
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
