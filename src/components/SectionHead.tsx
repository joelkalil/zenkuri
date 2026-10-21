import type { ReactNode } from 'react';

interface SectionHeadProps {
  /** "01", "02"… exibido em mono antes do título ("01 · Agora") */
  number: string;
  title: ReactNode;
  /** texto auxiliar após o título */
  sub?: ReactNode;
  /** ação à direita (link, botão, segmentado) */
  action?: ReactNode;
  className?: string;
}

export function SectionHead({ number, title, sub, action, className = '' }: SectionHeadProps) {
  return (
    <div className={`section-head ${className}`}>
      <span className="section-num" aria-hidden="true">{number}</span>
      <h2>{title}</h2>
      {sub && <span className="section-sub">{sub}</span>}
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}
