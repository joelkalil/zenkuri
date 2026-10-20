import { RefreshCw } from 'lucide-react';
import { useSteam } from '../context/SteamContext';

function relativeTime(ts: number | null): string {
  if (!ts) return 'nunca';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

/**
 * Botão de sincronização do rodapé da Sidebar. Expandido, mostra o rótulo e a
 * legenda de última sync; recolhido, vira um quadrado de 40px do trilho, com a
 * mesma informação no `title`. (O anel de progresso que dava nome ao arquivo
 * saiu numa mudança anterior — só o botão permaneceu.)
 */
export function SyncRing({ compact = false }: { compact?: boolean }) {
  const { sync, scanning, lastSyncAt, error } = useSteam();

  const title = scanning
    ? 'Sincronizando…'
    : error
      ? `Falha na sincronização — ${error}`
      : `Sincronizar todas as plataformas · última sync: ${relativeTime(lastSyncAt)}`;

  return (
    <button
      onClick={sync}
      disabled={scanning}
      aria-label={compact ? 'Sincronizar todas as plataformas' : undefined}
      title={title}
      className={`group relative flex items-center rounded-xl border bg-gray-900 text-left transition-colors hover:border-violet-600/40 hover:bg-gray-800/60 disabled:cursor-progress ${
        error ? 'border-red-800/50' : 'border-gray-800'
      } ${
        /* pl-[11px]: 1px de borda + 11px = os mesmos 12px de recuo dos itens do
           nav, para o ícone cair exatamente na coluna de ícones da Sidebar. */
        compact ? 'mx-auto h-10 w-10 justify-center' : 'w-full gap-3 py-2.5 pl-[11px] pr-2.5'
      }`}
    >
      <RefreshCw className={`h-[18px] w-[18px] shrink-0 transition-transform group-hover:rotate-90 ${error ? 'text-red-400' : 'text-emerald-400'} ${scanning ? 'animate-spin' : ''}`} />
      {error && !scanning && (
        <span
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"
          aria-hidden="true"
        />
      )}
      {!compact && <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
          {scanning ? 'Sincronizando…' : error ? 'Falha na sync' : 'Sincronizar'}
        </span>
        <span className="mt-0.5 block truncate text-xs text-gray-400">
          {!scanning && error ? 'Veja Ajustes → Sincronização' : `Última sync: ${relativeTime(lastSyncAt)}`}
        </span>
      </span>}
    </button>
  );
}
