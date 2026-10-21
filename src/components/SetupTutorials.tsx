import { Link } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { useI18n } from '../i18n';
import Tutorials from '../pages/Tutorials';

/** Tutorials page shown before any platform is connected (no shell, no sync). */
export function SetupTutorials() {
  const { t } = useI18n();

  return (
    <div className="app-shell">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 px-[var(--page-gutter)] py-3">
        <Logo size={28} />
        <div className="flex flex-wrap items-center gap-4">
          <LanguageSwitcher />
          <Link to="/" className="btn btn-secondary btn-sm">{t('setup.backToSetup')}</Link>
        </div>
      </header>
      <main id="main-content" className="app-content" tabIndex={-1}>
        <Tutorials />
      </main>
    </div>
  );
}
