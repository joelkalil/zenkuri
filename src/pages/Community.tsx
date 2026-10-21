import { Link } from 'react-router-dom';
import { SectionHead } from '../components/SectionHead';
import { contentLang, useCommunity } from '../hooks/useCommunity';
import { useI18n, useT } from '../i18n';
import { RichText } from '../components/RichText';
import { formatDayLong } from '../lib/planDates';
import {
  PUBLICATION_KIND,
  type CommunitySpace,
  type PublicationKind,
  type PublicationSummary,
} from '../types/community';
import '../styles/comunidade.css';

interface KindGroup {
  kind: PublicationKind;
  titleKey: 'groups.saga' | 'groups.ranking';
}

const KIND_GROUPS: readonly KindGroup[] = [
  { kind: PUBLICATION_KIND.SAGA, titleKey: 'groups.saga' },
  { kind: PUBLICATION_KIND.RANKING, titleKey: 'groups.ranking' },
];

function publicationPath(publication: PublicationSummary) {
  return publication.kind === PUBLICATION_KIND.SAGA
    ? `/sagas/${publication.slug}`
    : `/rankings?lista=${publication.slug}`;
}

function PublicationRow({ publication }: { publication: PublicationSummary }) {
  const t = useT('community');
  const { locale } = useI18n();
  return (
    <li>
      <Link to={publicationPath(publication)} className="cm-item">
        <span className="min-w-0" lang={contentLang(publication)}>
          <span className="cm-title block">{publication.title}</span>
          <span className="cm-summary block">{publication.summary}</span>
        </span>
        <span className="cm-meta">
          <strong>@{publication.author.handle}</strong>
          <span className="num">{t('publication.version', { version: publication.version })}</span>
          <span className="num">{formatDayLong(publication.publishedAt, locale)}</span>
        </span>
      </Link>
    </li>
  );
}

function SpaceSection({ space, number, publications }: { space: CommunitySpace; number: string; publications: PublicationSummary[] }) {
  const t = useT('community');
  const { locale } = useI18n();
  return (
    <section aria-labelledby={`space-${space.slug}`}>
      <SectionHead
        className="sh-wrap"
        number={number}
        title={<span id={`space-${space.slug}`} lang={contentLang(space)}>{space.name}</span>}
        sub={<span lang={contentLang(space)}>{space.description}</span>}
        action={
          <span className="text-xs text-gray-500">
            <span className="num text-gray-100">{publications.length}</span> {t.plural('space.publications', publications.length)}
            {' · '}{t('space.updatedAt')} <span className="num">{formatDayLong(space.updatedAt.slice(0, 10), locale)}</span>
          </span>
        }
      />
      {publications.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">{t('space.empty')}</p>
      ) : (
        KIND_GROUPS.map((group) => {
          const items = publications.filter((publication) => publication.kind === group.kind);
          if (items.length === 0) return null;
          return (
            <div key={group.kind} className="cm-group">
              <h3 className="cm-group-title micro">{t(group.titleKey)} <span className="num">{items.length}</span></h3>
              <ul className="cm-list">
                {items.map((publication) => <PublicationRow key={`${publication.kind}:${publication.slug}`} publication={publication} />)}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}

export default function Community() {
  const t = useT('community');
  const { spaces, publications, loading, error, retry } = useCommunity();

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <span className="page-eyebrow">{t('eyebrow')}</span>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-desc">{t('description')}</p>
        </div>
        <div className="page-actions">
          <Link to="/rankings" className="btn btn-secondary">{t('rankingsLink')}</Link>
        </div>
      </header>

      <p className="cm-how">
        <RichText text={t('how')} codeClassName="" />
      </p>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-sm bg-gray-850" />)}
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <strong>{t('error.title')}</strong>
          <span className="text-zk-danger">{error}</span>
          <button type="button" className="btn btn-secondary" onClick={retry}>{t('error.retry')}</button>
        </div>
      ) : spaces.length === 0 ? (
        <div className="empty-state">
          <strong>{t('noSpaces.title')}</strong>
          <span><RichText text={t('noSpaces.body')} codeClassName="" /></span>
        </div>
      ) : (
        spaces.map((space, index) => (
          <SpaceSection
            key={space.slug}
            space={space}
            number={String(index + 1).padStart(2, '0')}
            publications={publications.filter((publication) => publication.space === space.slug)}
          />
        ))
      )}
    </div>
  );
}
