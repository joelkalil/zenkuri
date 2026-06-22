import { Loader2, RefreshCw } from 'lucide-react';
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
 * Circular sync control from the product art: a progress ring around the overall
 * completion %, doubling as the "Sync Now" button, with a last-sync caption.
 */
export function SyncRing({ compact = false }: { compact?: boolean }) {
  const { sync, scanning, overallPercent, lastSyncAt } = useSteam();
  const size = compact ? 40 : 52;
  const stroke = compact ? 3 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (1 - overallPercent / 100);

  return (
    <button
      onClick={sync}
      disabled={scanning}
      title={scanning ? 'Syncing…' : 'Sync all platforms'}
      className="group flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-left transition-colors hover:border-violet-600/40 hover:bg-gray-800/60 disabled:cursor-progress"
    >
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-gray-800)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-emerald-500)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dash}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
          ) : (
            <span className={`font-bold tabular-nums text-emerald-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>{overallPercent}%</span>
          )}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
          <RefreshCw className={`h-3.5 w-3.5 text-gray-500 transition-transform group-hover:rotate-90 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Sincronizando…' : 'Sync Now'}
        </span>
        <span className="mt-0.5 block truncate text-xs text-gray-600">Última sync: {relativeTime(lastSyncAt)}</span>
      </span>
    </button>
  );
}
