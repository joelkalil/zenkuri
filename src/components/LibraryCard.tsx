import { useNavigate } from 'react-router-dom';
import { BookmarkCheck, BookmarkPlus, CircleSlash, Pin } from 'lucide-react';
import { ProgressBar, completionTextColor } from './ProgressBar';
import { GameCover } from './GameCover';
import { PLATFORM_META, psnTrophyBreakdown } from '../lib/platforms';
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

const TROPHY_TYPES = [
  { key: 'platinum', icon: '/trophies/platinum.png' },
  { key: 'gold', icon: '/trophies/gold.png' },
  { key: 'silver', icon: '/trophies/silver.png' },
  { key: 'bronze', icon: '/trophies/bronze.png' },
] as const;

/* Vertical box-art card matching the Game Library art: portrait cover, overlaid
   title, trophy breakdown (PSN) or progress (Steam/RA). */
export function LibraryCard({ game, completion, isPinned, inBacklog, isDropped, onToggleBacklog, onTogglePinned }: LibraryCardProps) {
  const navigate = useNavigate();
  const meta = game.platform ? PLATFORM_META[game.platform as Platform] : null;
  const breakdown = psnTrophyBreakdown(game);

  return (
    <button
      onClick={() => navigate(`/game/${game.appid}`)}
      className="group relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900 text-left transition-all duration-200 hover:border-violet-600/50 hover:shadow-lg hover:shadow-black/40"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-800">
        <GameCover game={game} portrait className="h-full w-full" imgClassName="object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />

        {/* platform badge */}
        <div className="absolute left-2 top-2 flex items-center gap-1">
          {meta && (
            <span className="flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 backdrop-blur-sm">
              <img src={meta.logo} alt="" className="h-3 w-3 object-contain" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/90">{meta.short}</span>
            </span>
          )}
          {game.relatedPlatforms?.map((p) => (
            <span key={p} className="rounded-md bg-black/55 px-1 py-0.5 text-[9px] font-bold uppercase text-white/70 backdrop-blur-sm">
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
          <div className="absolute right-2 top-9 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            {onToggleBacklog && (
              <span role="button" tabIndex={0} onClick={() => onToggleBacklog(String(game.appid))}
                onKeyDown={(e) => e.key === 'Enter' && onToggleBacklog(String(game.appid))}
                title={inBacklog ? 'Remover do backlog' : 'Adicionar ao backlog'}
                className={`grid h-6 w-6 place-items-center rounded-md backdrop-blur-sm ${inBacklog ? 'bg-blue-600/80 text-white' : 'bg-black/70 text-gray-300 hover:text-blue-300'}`}>
                {inBacklog ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
              </span>
            )}
            {onTogglePinned && (
              <span role="button" tabIndex={0} onClick={() => onTogglePinned(String(game.appid))}
                onKeyDown={(e) => e.key === 'Enter' && onTogglePinned(String(game.appid))}
                title={isPinned ? 'Desafixar' : 'Fixar como prioridade'}
                className={`grid h-6 w-6 place-items-center rounded-md backdrop-blur-sm ${isPinned ? 'bg-violet-600/80 text-white' : 'bg-black/70 text-gray-300 hover:text-violet-300'}`}>
                <Pin className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        )}

        {/* title + trophies/progress overlay */}
        <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-2.5">
          <div className="flex items-center gap-1.5">
            {isPinned && <Pin className="h-3 w-3 shrink-0 text-violet-300" />}
            {isDropped && <CircleSlash className="h-3 w-3 shrink-0 text-red-400" />}
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{game.name}</p>
          </div>

          {breakdown ? (
            <div className="flex items-center gap-2.5">
              {TROPHY_TYPES.map(({ key, icon }) => {
                const b = breakdown[key];
                if (b.total === 0) return null;
                return (
                  <span key={key} className="flex items-center gap-0.5" title={`${b.earned}/${b.total} ${key}`}>
                    <img src={icon} alt="" className="h-3.5 w-3.5 object-contain" />
                    <span className="text-[11px] font-bold tabular-nums text-white/85">{b.earned}</span>
                  </span>
                );
              })}
            </div>
          ) : completion ? (
            <p className="text-[11px] text-white/60">{completion.unlocked}/{completion.total} conquistas</p>
          ) : null}

          {completion ? <ProgressBar percent={completion.percent} height="h-1.5" /> : <div className="h-1.5 rounded-full bg-white/15" />}
        </div>
      </div>
    </button>
  );
}
