import { RefreshCw } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useI18n } from '../i18n';

/**
 * Topbar sync control: the text shows the state (idle, syncing, error) and a
 * click syncs now. Below 1100px only the icon is visible; the text stays
 * available to screen readers.
 */
export function SyncButton() {
  const { sync, scanning, lastSyncAt, error } = useSteam();
  const { t, formatRelative } = useI18n();
  const state = scanning ? 'syncing' : error ? 'error' : 'idle';
  const label = scanning
    ? t('shell.sync.syncing')
    : error
      ? t('shell.sync.failed')
      : lastSyncAt
        ? t('shell.sync.syncedAgo', { when: formatRelative(lastSyncAt) })
        : t('shell.sync.syncNow');

  return (
    <button
      type="button"
      className="sync-btn"
      data-state={state}
      onClick={sync}
      disabled={scanning}
      title={error ? t('shell.sync.failedWithReason', { error }) : t('shell.sync.syncNow')}
    >
      {state === 'error' && <span className="sync-dot" aria-hidden="true" />}
      <RefreshCw size={14} aria-hidden="true" className={scanning ? 'animate-spin motion-reduce:animate-none' : ''} />
      <span className="sync-label" aria-hidden="true">{label}</span>
      <span className="sr-only" aria-live="polite">{label}</span>
    </button>
  );
}
