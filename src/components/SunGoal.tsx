import { useId } from 'react';

interface SunGoalProps {
  /** progresso 0–100; o disco solar "nasce" do horizonte conforme avança */
  percent: number;
  className?: string;
}

/**
 * Sol do Mês: um disco solar que se preenche de baixo para cima, como um sol
 * nascendo no horizonte — o motivo Neo Mirai aplicado à meta mensal.
 */
export function SunGoal({ percent, className = '' }: SunGoalProps) {
  const clipId = useId();
  const gradientId = useId();
  const clamped = Math.max(0, Math.min(100, percent));
  const filledHeight = (clamped / 100) * 44;

  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label={`Progresso do mês: ${clamped}%`}>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y={46 - filledHeight} width="48" height={filledHeight} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-violet-400)" />
          <stop offset="100%" stopColor="var(--color-indigo-600)" />
        </linearGradient>
      </defs>
      {/* céu vazio (fundo do disco) */}
      <circle cx="24" cy="24" r="21" fill="var(--color-gray-800)" opacity="0.5" />
      {/* sol preenchido a partir do horizonte */}
      <circle cx="24" cy="24" r="21" fill={`url(#${gradientId})`} clipPath={`url(#${clipId})`} />
      {/* anel técnico fino */}
      <circle cx="24" cy="24" r="22" fill="none" stroke="var(--color-gray-700)" strokeWidth="1" />
      {/* linha do horizonte */}
      <line x1="4" y1="46" x2="44" y2="46" stroke="var(--color-gray-700)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
