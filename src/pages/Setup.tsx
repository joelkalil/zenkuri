import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  linkPlatformAccount,
  syncPlatform,
} from '../lib/api';
import type { Platform } from '../types/steam';
import { PLATFORM_META } from '../lib/platforms';
import { Logo } from '../components/Logo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';
import { useErrorMessage } from '../i18n/useErrorMessage';
import '../styles/login.css';

interface SetupProps {
  onComplete: () => void;
}

const PLATFORMS: Platform[] = ['steam', 'psn', 'retroachievements'];
const RECOMMENDED: Platform = 'steam';

export default function Setup({ onComplete }: SetupProps) {
  const { t } = useI18n();
  const describe = useErrorMessage();
  const [connected, setConnected] = useState<Platform[]>([]);
  const [modal, setModal] = useState<Platform | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canContinue = connected.length > 0;

  function openModal(platform: Platform) {
    setError('');
    setIdentifier('');
    setModal(platform);
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setError('');
  }

  async function handleLink() {
    if (!modal) return;
    if (!identifier.trim()) return setError(t('setup.errors.identifierRequired'));
    setBusy(true);
    setError('');
    try {
      await linkPlatformAccount(modal, identifier.trim());
      await syncPlatform(modal);
      setConnected((current) => (current.includes(modal) ? current : [...current, modal]));
      setModal(null);
    } catch (err) {
      setError(describe(err, 'setup.errors.linkFailed'));
    } finally {
      setBusy(false);
    }
  }

  const [skipped, setSkipped] = useState<Platform[]>([]);

  useEffect(() => {
    if (!modal) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="auth-screen">
      <div className="auth-card auth-wide">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <Logo size={36} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <LanguageSwitcher />
            <p className="num text-sm text-gray-400" aria-live="polite">
              <span className="text-gray-100">{connected.length}</span> {t('setup.progressSuffix', { total: PLATFORMS.length })}
            </p>
          </div>
        </div>

        <h1 className="mt-8 font-display text-3xl font-bold text-gray-50">{t('setup.title')}</h1>
        <p className="lede mt-2 max-w-2xl">
          {t('setup.lede')}
        </p>

        <div className="mt-8">
          {PLATFORMS.map((id, index) => {
            const label = PLATFORM_META[id].label;
            const recommended = id === RECOMMENDED;
            const isConnected = connected.includes(id);
            const isSkipped = skipped.includes(id);
            return (
              <div key={id} className="su-step">
                <span className="su-num">{String(index + 1).padStart(2, '0')}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <img src={PLATFORM_META[id].logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
                  <div className="min-w-0">
                    <h2 className="su-title">
                      {label}
                      {recommended && !isConnected && <span className="badge ml-2 align-middle" data-tone="accent">{t('setup.recommended')}</span>}
                    </h2>
                    <p className="text-sm text-gray-500">{t(`setup.platforms.${id}.blurb`)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isConnected ? <span className="su-state" data-on="true">{t('setup.connected')}</span> : isSkipped ? <span className="su-state">{t('setup.skipped')}</span> : null}
                  {!isConnected && !isSkipped && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipped((current) => [...current, id])}>
                      {t('setup.skip')}<span className="sr-only"> {label}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openModal(id)}
                    className={`btn btn-sm ${isConnected ? 'btn-secondary' : recommended ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {isConnected ? t('setup.reconnect') : t('setup.connect')}<span className="sr-only"> {label}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <Link to="/tutoriais" className="text-sm text-gray-500 transition-colors hover:text-gray-200">
            {t('setup.help')}
          </Link>
          <button
            type="button"
            onClick={onComplete}
            disabled={!canContinue}
            className="btn btn-primary btn-lg"
          >
            {t('setup.continue')}
          </button>
        </div>
      </div>

      {modal && (
        <div className="su-dialog-backdrop" onClick={closeModal}>
          <div
            role="dialog" aria-modal="true" aria-labelledby="su-dialog-title"
            className="su-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src={PLATFORM_META[modal].logo} alt="" className="h-7 w-7 object-contain" />
                <div>
                  <h2 id="su-dialog-title" className="font-display text-lg font-bold text-gray-100">{t('setup.dialog.title', { platform: PLATFORM_META[modal].label })}</h2>
                  <p className="text-xs text-gray-500">{t(`setup.platforms.${modal}.blurb`)}</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="btn btn-ghost btn-sm">{t('setup.dialog.close')}</button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => { event.preventDefault(); handleLink(); }}
            >
              <div>
                <label htmlFor="su-identifier" className="auth-label">{t(`setup.platforms.${modal}.inputLabel`)}</label>
                <input
                  id="su-identifier"
                  type="text"
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t(`setup.platforms.${modal}.placeholder`)}
                  className="field"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  {t('setup.dialog.publicOnly')}
                </p>
              </div>

              {error && <p role="alert" className="auth-error">{error}</p>}

              <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t('setup.dialog.busy')}
                  </>
                ) : (
                  t('setup.dialog.submit')
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
