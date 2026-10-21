import { RefreshCw } from 'lucide-react';
import { useSteam } from '../context/SteamContext';

function relativeTime(ts: number | null): string {
  if (!ts) return 'nunca';
  const min = Math.floor((Date.now() - ts) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

/**
 * Sincronização na topbar: o texto mostra o estado (ocioso, sincronizando,
 * erro) e o clique sincroniza agora. Abaixo de 1100 px só o ícone é visível;
 * o texto continua disponível para leitores de tela.
 */
export function SyncButton() {
  const { sync, scanning, lastSyncAt, error } = useSteam();
  const state = scanning ? 'syncing' : error ? 'error' : 'idle';
  const label = scanning
    ? 'Sincronizando…'
    : error
      ? 'Falha ao sincronizar'
      : lastSyncAt
        ? `Sincronizado ${relativeTime(lastSyncAt)}`
        : 'Sincronizar agora';

  return (
    <button
      type="button"
      className="sync-btn"
      data-state={state}
      onClick={sync}
      disabled={scanning}
      title={error ? `Falha ao sincronizar: ${error}` : 'Sincronizar agora'}
    >
      {state === 'error' && <span className="sync-dot" aria-hidden="true" />}
      <RefreshCw size={14} aria-hidden="true" className={scanning ? 'animate-spin motion-reduce:animate-none' : ''} />
      <span className="sync-label" aria-hidden="true">{label}</span>
      <span className="sr-only" aria-live="polite">{label}</span>
    </button>
  );
}
