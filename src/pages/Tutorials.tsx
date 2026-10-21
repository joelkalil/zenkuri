import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { RichText } from '../components/RichText';
import { SectionHead } from '../components/SectionHead';
import { useI18n, useT } from '../i18n';
import { PLATFORM_META } from '../lib/platforms';
import { TUTORIALS, type TutorialLink, type TutorialScope, type TutorialTarget } from '../lib/tutorials';
import '../styles/tutoriais.css';

const SCOPE_LABEL_KEY = {
  server: 'labels.scopeServer',
  user: 'labels.scopeUser',
} as const satisfies Record<TutorialScope, 'labels.scopeServer' | 'labels.scopeUser'>;

function ExternalAnchor({ link }: { link: TutorialLink }) {
  const t = useT('tutorials');
  return (
    <a className="tut-link" href={link.href} target="_blank" rel="noopener noreferrer">
      {t(link.labelKey)}
      <ExternalLink size={14} aria-hidden="true" />
      <span className="sr-only"> {t('labels.external')}</span>
    </a>
  );
}

function TargetCell({ target }: { target: TutorialTarget }) {
  const t = useT('tutorials');
  const { t: tGlobal } = useI18n();

  if (target.kind === 'env') {
    return (
      <>
        <span><RichText text={t('labels.envFile')} codeClassName="tut-code" /></span>
        <span className="tut-target-detail"><code className="tut-code">{target.name}</code></span>
      </>
    );
  }
  return (
    <>
      <Link className="tut-inline-link" to="/settings?tab=connections">{t('labels.settingsPath')}</Link>
      <span className="tut-target-detail">
        {t('labels.field')} <strong>{tGlobal(`settings.connections.identifiers.${target.platform}.label`)}</strong>
      </span>
    </>
  );
}

export default function Tutorials() {
  const t = useT('tutorials');
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="page tut-page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('page.title')}</h1>
          <p className="page-desc">{t('page.lede')}</p>
        </div>
      </header>

      <section className="tut-section" aria-labelledby="tut-overview">
        <SectionHead number="01" title={<span id="tut-overview">{t('overview.title')}</span>} />
        <div className="tut-overview">
          <div>
            <h3>{t('overview.serverTitle')}</h3>
            <p><RichText text={t('overview.serverBody')} codeClassName="tut-code" /></p>
          </div>
          <div>
            <h3>{t('overview.userTitle')}</h3>
            <p>{t('overview.userBody')}</p>
          </div>
        </div>
        <p className="micro tut-index-title">{t('overview.indexTitle')}</p>
        <nav aria-label={t('labels.toolbarLabel')}>
          <ul className="tut-index">
            {TUTORIALS.map((tutorial, index) => (
              <li key={tutorial.id}>
                <Link to={{ hash: `#${tutorial.id}` }}>
                  <span className="tut-index-num" aria-hidden="true">{String(index + 2).padStart(2, '0')}</span>
                  <img src={PLATFORM_META[tutorial.id].logo} alt="" className="tut-icon" />
                  {PLATFORM_META[tutorial.id].label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      {TUTORIALS.map((tutorial, index) => (
        <section key={tutorial.id} id={tutorial.id} className="tut-section" aria-labelledby={`tut-${tutorial.id}-title`}>
          <SectionHead
            number={String(index + 2).padStart(2, '0')}
            title={
              <span id={`tut-${tutorial.id}-title`} className="tut-title">
                <img src={PLATFORM_META[tutorial.id].logo} alt="" className="tut-icon" />
                {PLATFORM_META[tutorial.id].label}
              </span>
            }
          />

          <div className="tut-block">
            <h3 className="micro">{t('labels.purpose')}</h3>
            <p className="lede tut-purpose">{t(tutorial.purposeKey)}</p>
          </div>

          <div className="tut-block">
            <h3 className="micro">{t('labels.steps')}</h3>
            {tutorial.parts.map((part) => (
              <div key={part.titleKey}>
                <div className="tut-part-head">
                  <h4 className="tut-part-title">{t(part.titleKey)}</h4>
                  <span className="tut-part-scope">{t(SCOPE_LABEL_KEY[part.scope])}</span>
                </div>
                <ol className="tut-steps">
                  {part.steps.map((step) => (
                    <li key={step.key}>
                      <RichText text={t(step.key)} codeClassName="tut-code" />
                      {step.link && <div><ExternalAnchor link={step.link} /></div>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div className="tut-block">
            <h3 className="micro">{t('labels.where')}</h3>
            <div className="tut-where" role="table">
              <div className="tut-where-row tut-where-head col-head" role="row">
                <span role="columnheader">{t('labels.colValue')}</span>
                <span role="columnheader">{t('labels.colWho')}</span>
                <span role="columnheader">{t('labels.colWhere')}</span>
              </div>
              {tutorial.values.map((value) => (
                <div key={value.labelKey} className="tut-where-row" role="row">
                  <span role="cell" className="tut-where-value">{t(value.labelKey)}</span>
                  <span role="cell">{t(SCOPE_LABEL_KEY[value.scope])}</span>
                  <span role="cell" className="tut-where-target"><TargetCell target={value.target} /></span>
                </div>
              ))}
            </div>
          </div>

          <div className="tut-block">
            <h3 className="micro">{t('labels.privacy')}</h3>
            <ul className="tut-notes">
              {tutorial.privacy.map((note) => (
                <li key={note.key}>
                  <RichText text={t(note.key)} codeClassName="tut-code" />
                  {note.link && <div><ExternalAnchor link={note.link} /></div>}
                </li>
              ))}
            </ul>
          </div>

          <div className="tut-block">
            <h3 className="micro">{t('labels.errors')}</h3>
            <dl className="tut-errors">
              {tutorial.errors.map((error) => (
                <div key={error.problemKey} className="tut-error">
                  <dt><span className="tut-error-label">{t('labels.problem')}</span><span>{t(error.problemKey)}</span></dt>
                  <dd><span className="tut-error-label">{t('labels.fix')}</span><span><RichText text={t(error.fixKey)} codeClassName="tut-code" /></span></dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ))}
    </div>
  );
}
