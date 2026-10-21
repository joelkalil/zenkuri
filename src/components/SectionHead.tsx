import type { ReactNode } from 'react';

interface SectionHeadProps {
  /** "01", "02"… shown in mono before the title ("01 · Now") */
  number: string;
  title: ReactNode;
  /** helper text after the title */
  sub?: ReactNode;
  /** right-aligned action (link, button, segmented control) */
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
