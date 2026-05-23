import { useNavigate } from 'react-router-dom';
import { Pin, BookmarkPlus, BookmarkCheck, Clock } from 'lucide-react';
import { ProgressBar, completionTextColor } from './ProgressBar';
import { gameCoverUrl } from '../lib/steamApi';
import type { Game } from '../types/steam';

interface GameCardProps {
  game: Game;
  completion?: { percent: number; unlocked: number; total: number } | null;
  isPinned?: boolean;
  inBacklog?: boolean;
  onToggleBacklog?: (appid: string) => void;
  onTogglePinned?: (appid: string) => void;
  compact?: boolean;
}

function fmt(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.round(minutes / 60);
  return `${h}h`;
}

export function GameCard({
  game,
  completion,
  isPinned,
  inBacklog,
  onToggleBacklog,
  onTogglePinned,
  compact = false,
}: GameCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-gray-600 transition-all duration-200 hover:shadow-lg hover:shadow-black/40"
      onClick={() => navigate(`/game/${game.appid}`)}
    >
      {/* Cover image */}
      <div className="relative overflow-hidden">
        <img
          src={gameCoverUrl(game.appid)}
          alt={game.name}
          className={`w-full object-cover transition-transform duration-300 group-hover:scale-105 ${compact ? 'h-20' : 'h-28'}`}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="460" height="215" viewBox="0 0 460 215"%3E%3Crect fill="%231a1a2e" width="460" height="215"/%3E%3Ctext fill="%234a4a6a" font-family="sans-serif" font-size="16" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
          }}
        />
        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          {isPinned && (
            <span className="bg-violet-600/90 text-white p-0.5 rounded">
              <Pin className="w-3 h-3" />
            </span>
          )}
          {inBacklog && (
            <span className="bg-blue-600/90 text-white p-0.5 rounded">
              <BookmarkCheck className="w-3 h-3" />
            </span>
          )}
        </div>
        {/* Completion badge */}
        {completion && (
          <span
            className={`absolute top-1.5 right-1.5 text-xs font-bold font-mono px-1.5 py-0.5 rounded bg-gray-950/80 ${completionTextColor(completion.percent)}`}
          >
            {completion.percent === 100 ? '✓ 100%' : `${completion.percent}%`}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-100 truncate leading-tight">{game.name}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <Clock className="w-3 h-3 shrink-0" />
          <span>{fmt(game.playtime_forever)}</span>
          {game.playtime_2weeks && (
            <span className="text-blue-400">+{fmt(game.playtime_2weeks)} recent</span>
          )}
        </div>

        {/* Progress */}
        <div className="mt-2">
          {completion ? (
            <>
              <ProgressBar percent={completion.percent} height="h-1.5" />
              <p className="text-xs text-gray-600 mt-0.5">
                {completion.unlocked}/{completion.total} achievements
              </p>
            </>
          ) : (
            <div className="h-1.5 bg-gray-800 rounded-full" />
          )}
        </div>

        {/* Action buttons */}
        {(onToggleBacklog || onTogglePinned) && (
          <div className="flex gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
            {onToggleBacklog && (
              <button
                onClick={() => onToggleBacklog(String(game.appid))}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                  inBacklog
                    ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                    : 'bg-gray-800 text-gray-500 hover:text-blue-400 hover:bg-blue-600/10'
                }`}
                title={inBacklog ? 'Remove from backlog' : 'Add to backlog'}
              >
                {inBacklog ? <BookmarkCheck className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
              </button>
            )}
            {onTogglePinned && (
              <button
                onClick={() => onTogglePinned(String(game.appid))}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                  isPinned
                    ? 'bg-violet-600/20 text-violet-400 hover:bg-violet-600/30'
                    : 'bg-gray-800 text-gray-500 hover:text-violet-400 hover:bg-violet-600/10'
                }`}
                title={isPinned ? 'Unpin' : 'Pin as priority'}
              >
                <Pin className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
