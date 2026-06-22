import { useNavigate } from 'react-router-dom';
import { BookmarkCheck, BookmarkPlus, CircleSlash, Pin } from 'lucide-react';
import { ProgressBar, completionTextColor } from './ProgressBar';
import { GameCover } from './GameCover';
import { PLATFORM_META } from '../lib/platforms';
import type { Game, Platform } from '../types/steam';

interface LibraryCardProps {
  game: Game;
  completion?: { percent: number; unlocked: number; total: number } | null;
  isPinned?: boolean;
  inBacklog?: boolean;
  isDropped?: boolean;
  onToggleBacklog?: (appid: string) => void;
  onTogglePinned?: (appid: string) => void;
}

/* Cover-dominant card with overlaid title + progress, matching the Game Library art. */
export function LibraryCard({ game, completion, isPinned, inBacklog, isDropped, onToggleBacklog, onTogglePinned }: LibraryCardProps) {
  const navigate = useNavigate();
  const meta = game.platform ? PLATFORM_META[game.platform as Platform] : null;
  const noun = game.platform === 'psn' ? 'troféus' : 'conquistas';

  return (
    <button
      onClick={() => navigate(`/game/${game.appid}`)}
      className="group relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900 text-left transition-all duration-200 hover:border-violet-600/50 hover:shadow-lg hover:shadow-black/40"
    >
      <div className="relative aspect-[460/215] w-full overflow-hidden bg-gray-800">
        <GameCover game={game} className="h-full w-full" imgClassName="object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />

        {/* platform + status badges */}
        <div className="absolute left-2 top-2 flex items-center gap-1">
          {meta && (
            <span className="flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 backdrop-blur-sm">
              <img src={meta.logo} alt="" className="h-3 w-3 object-contain" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/90">{meta.short}</span>
            </span>
          )}
          {game.relatedPlatforms?.map((p) => (
            <span key={p} className="rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white/70 backdrop-blur-sm">
              +{PLATFORM_META[p].short}
            </span>
          ))}
        </div>

        {/* completion pill */}
        {completion && (
          <span className={`absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] font-bold backdrop-blur-sm ${completionTextColor(completion.percent)}`}>
            {completion.percent === 100 ? '✓ 100%' : `${completion.percent}%`}
          </span>
        )}

        {/* hover actions */}
        {(onToggleBacklog || onTogglePinned) && (
          <div
            className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {onToggleBacklog && (
              <span
                role="button"
                tabIndex={0}
                onClick={() => onToggleBacklog(String(game.appid))}
                onKeyDown={(e) => e.key === 'Enter' && onToggleBacklog(String(game.appid))}
                title={inBacklog ? 'Remover do backlog' : 'Adicionar ao backlog'}
                className={`grid h-6 w-6 place-items-center rounded-md backdrop-blur-sm ${inBacklog ? 'bg-blue-600/80 text-white' : 'bg-black/70 text-gray-300 hover:text-blue-300'}`}
              >
                {inBacklog ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
              </span>
            )}
            {onTogglePinned && (
              <span
                role="button"
                tabIndex={0}
                onClick={() => onTogglePinned(String(game.appid))}
                onKeyDown={(e) => e.key === 'Enter' && onTogglePinned(String(game.appid))}
                title={isPinned ? 'Desafixar' : 'Fixar como prioridade'}
                className={`grid h-6 w-6 place-items-center rounded-md backdrop-blur-sm ${isPinned ? 'bg-violet-600/80 text-white' : 'bg-black/70 text-gray-300 hover:text-violet-300'}`}
              >
                <Pin className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        )}

        {/* title + progress overlay */}
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <div className="flex items-center gap-1.5">
            {isPinned && <Pin className="h-3 w-3 shrink-0 text-violet-300" />}
            {isDropped && <CircleSlash className="h-3 w-3 shrink-0 text-red-400" />}
            <p className="truncate text-sm font-semibold text-white">{game.name}</p>
          </div>
          {completion ? (
            <>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-white/60">{completion.unlocked}/{completion.total} {noun}</span>
              </div>
              <div className="mt-1">
                <ProgressBar percent={completion.percent} height="h-1.5" />
              </div>
            </>
          ) : (
            <div className="mt-2 h-1.5 rounded-full bg-white/15" />
          )}
        </div>
      </div>
    </button>
  );
}
