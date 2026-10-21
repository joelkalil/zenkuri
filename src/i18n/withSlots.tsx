import { Fragment, type ReactNode } from 'react';

/**
 * Renders a translated template with `{name}` placeholders replaced by React
 * nodes (numbers in `<span className="num">`, links, language-tagged content).
 * Unknown placeholders are left as written, like `interpolate` does.
 */
export function withSlots(template: string, slots: Readonly<Record<string, ReactNode>>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{name !== undefined && name in slots ? slots[name] : part}</Fragment>;
  });
}
