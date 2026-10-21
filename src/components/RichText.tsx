import { Fragment } from 'react';

interface RichTextProps {
  /** Message text where `backticked` segments render as inline code. */
  text: string;
  codeClassName?: string;
}

/** Renders `code` segments of a translated message as <code> elements. */
export function RichText({ text, codeClassName = 'inline-code' }: RichTextProps) {
  return (
    <>
      {text.split('`').map((segment, index) => (
        // Odd segments sit between backticks.
        <Fragment key={index}>
          {index % 2 === 1 ? <code className={codeClassName}>{segment}</code> : segment}
        </Fragment>
      ))}
    </>
  );
}
