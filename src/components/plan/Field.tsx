import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  /** marks the control as failing validation (`aria-invalid`) */
  invalid?: boolean;
  className?: string;
  children: ReactNode;
}

interface ControlA11yProps {
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * Label + control (+ hint) for the plan editor forms. The hint is linked to the
 * control with `aria-describedby`: the single child element is cloned with the
 * hint id (and `aria-invalid` when `invalid`).
 */
export function Field({ label, htmlFor, hint, invalid = false, className = '', children }: FieldProps) {
  const hintId = useId();
  const control = Children.count(children) === 1 && isValidElement<ControlA11yProps>(children)
    ? cloneElement(children as ReactElement<ControlA11yProps>, {
      ...(hint ? { 'aria-describedby': [children.props['aria-describedby'], hintId].filter(Boolean).join(' ') } : {}),
      ...(invalid ? { 'aria-invalid': true } : {}),
    })
    : children;

  return (
    <div className={`pe-field ${className}`}>
      <label htmlFor={htmlFor} className="micro">{label}</label>
      {control}
      {hint && <p id={hintId} className="pe-hint">{hint}</p>}
    </div>
  );
}
