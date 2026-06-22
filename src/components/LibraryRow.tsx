import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const meta = game.platform ? PLATFORM_META[game.platform as Platform] : null;
  const noun = game.platform === 'psn' ? 'troféus' : 'conquistas';

  return (
    <div
      onClick={() => navigate(`/game/${game.appid}`)}
      className="group flex cursor-pointer items-center gap-3 p-2.5 transition-colors hover:bg-gray-800/50"
    >
      <GameCover game={game} className="h-11 w-20 shrink-0 rounded-md bg-gray-800" imgClassName="object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isPinned && <Pin className="h-3 w-3 shrink-0 text-violet-300" />}
          {isDropped && <CircleSlash className="h-3 w-3 shrink-0 text-red-400" />}
          <p className="truncate text-sm font-semibold text-gray-100">{game.name}</p>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
          {meta && <span className="flex items-center gap-1"><img src={meta.logo} alt="" className="h-3 w-3 object-contain" />{meta.short}</span>}
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(game.playtime_forever)}</span>
        </div>
      </div>
      {completion && (
        <div className="hidden w-44 shrink-0 items-center gap-2 sm:flex">
          <span className="w-20 text-right text-xs text-gray-500">{completion.unlocked}/{completion.total} {noun}</span>
          <ProgressBar percent={completion.percent} height="h-1.5" />
        </div>
      )}
      <span className={`w-12 shrink-0 text-right font-mono text-sm font-bold ${completion ? completionTextColor(completion.percent) : 'text-gray-600'}`}>
        {completion ? `${completion.percent}%` : '—'}
      </span>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        {onToggleBacklog && (
          <button onClick={() => onToggleBacklog(String(game.appid))} title={inBacklog ? 'Remover do backlog' : 'Adicionar ao backlog'}
            className={`grid h-7 w-7 place-items-center rounded-md ${inBacklog ? 'bg-blue-600/20 text-blue-300' : 'text-gray-600 hover:text-blue-300'}`}>
            {inBacklog ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
          </button>
        )}
        {onTogglePinned && (
          <button onClick={() => onTogglePinned(String(game.appid))} title={isPinned ? 'Desafixar' : 'Fixar'}
            className={`grid h-7 w-7 place-items-center rounded-md ${isPinned ? 'bg-violet-600/20 text-violet-300' : 'text-gray-600 hover:text-violet-300'}`}>
            <Pin className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
