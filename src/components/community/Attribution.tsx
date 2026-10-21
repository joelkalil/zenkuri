import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSpaceNames } from '../../hooks/useSpaces';
import { useT } from '../../i18n';
import type { PublicationSummary } from '../../types/community';

interface AttributionProps {
  publication: Pick<PublicationSummary, 'author' | 'space' | 'version'>;
  /** extra information at the end of the line (e.g. the price date) */
  extra?: ReactNode;
  className?: string;
}

/** "Curated by @joel · space Zenkuri · v1", with the space pointing to the community page. */
export function Attribution({ publication, extra, className = '' }: AttributionProps) {
  const t = useT('community');
  const names = useSpaceNames();
  const { author, space, version } = publication;
  return (
    <p className={`text-xs text-gray-500 ${className}`}>
      {t('attribution.curatedBy')} <span className="font-semibold text-gray-300">@{author.handle}</span>
      {' · '}
      {t('attribution.space')} <Link to="/comunidade" className="font-semibold text-gray-300 underline decoration-gray-700 underline-offset-2 hover:text-violet-400">{names[space] ?? space}</Link>
      {' · '}
      <span className="num">{t('publication.version', { version })}</span>
      {extra && <>{' · '}{extra}</>}
    </p>
  );
}
