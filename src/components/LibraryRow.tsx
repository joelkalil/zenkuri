import { Link } from 'react-router-dom';
import { BookmarkCheck, BookmarkPlus, CircleSlash, Clock, Pin } from 'lucide-react';
import { ProgressBar, completionTextColor } from './ProgressBar';
import { GameCover } from './GameCover';
import { PLATFORM_META } from '../lib/platforms';
import type { Game, Platform } from '../types/steam';

interface LibraryRowProps {
  game: Game;
  completion?: { percent: number; unlocked: number; total: number } | null;
  isPinned?: boolean;
  inBacklog?: boolean;
  isDropped?: boolean;
  onToggleBacklog?: (appid: string) => void;
  onTogglePinned?: (appid: string) => void;
}

function fmt(minutes: number): string {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

/* List-view row for the Game Library (grid/list toggle). */
export function LibraryRow({ game, completion, isPinned, inBacklog, isDropped, onToggleBacklog, onTogglePinned }: LibraryRowProps) {
  const meta = game.platform ? PLATFORM_META[game.platform as Platform] : null;
  const noun = game.platform === 'psn' ? 'troféus' : 'conquistas';

  return (
    <div className="library-row">
      <GameCover game={game} className="row-cover shrink-0 bg-gray-800" imgClassName="object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isPinned && <Pin className="h-3 w-3 shrink-0 text-violet-300" />}
          {isDropped && <CircleSlash className="h-3 w-3 shrink-0 text-red-400" />}
          <Link to={`/game/${game.appid}`} className="library-row-link truncate font-semibold text-gray-100">{game.name}</Link>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
          {meta && <span className="flex items-center gap-1"><img src={meta.logo} alt="" className="h-3 w-3 object-contain" />{meta.short}</span>}
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(game.playtime_forever)}</span>
        </div>
      </div>
      {completion && (
        <div className="row-progress flex min-w-0 items-center gap-3">
          <span className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-gray-500">{completion.unlocked}/{completion.total} {noun}</span>
          <ProgressBar percent={completion.percent} height="h-1.5" />
        </div>
      )}
      {!completion && <span className="row-progress" />}
      <span className={`w-12 shrink-0 text-right text-sm font-semibold tabular-nums ${completion ? completionTextColor(completion.percent) : 'text-gray-600'}`}>
        {completion ? `${completion.percent}%` : '—'}
      </span>
      <div className="library-row-actions">
        {onToggleBacklog && (
          <button aria-label={`${inBacklog ? 'Remover do backlog' : 'Adicionar ao backlog'}: ${game.name}`} aria-pressed={Boolean(inBacklog)} onClick={() => onToggleBacklog(String(game.appid))} title={inBacklog ? 'Remover do backlog' : 'Adicionar ao backlog'}
            className={`grid h-7 w-7 place-items-center rounded-md ${inBacklog ? 'bg-blue-600/20 text-blue-300' : 'text-gray-600 hover:text-blue-300'}`}>
            {inBacklog ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
          </button>
        )}
        {onTogglePinned && (
          <button aria-label={`${isPinned ? 'Desafixar' : 'Fixar'}: ${game.name}`} aria-pressed={Boolean(isPinned)} onClick={() => onTogglePinned(String(game.appid))} title={isPinned ? 'Desafixar' : 'Fixar'}
            className={`grid h-7 w-7 place-items-center rounded-md ${isPinned ? 'bg-violet-600/20 text-violet-300' : 'text-gray-600 hover:text-violet-300'}`}>
            <Pin className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
