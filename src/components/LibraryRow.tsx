import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { BookmarkCheck, BookmarkPlus, Pin } from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import { GameCover } from './GameCover';
import { PLATFORM_META } from '../lib/platforms';
import { formatMinutes } from '../lib/planDates';
import type { Game } from '../types/steam';

interface LibraryRowProps {
  game: Game;
  rank: number;
  completion?: { percent: number; unlocked: number; total: number } | null;
  isPinned?: boolean;
  inBacklog?: boolean;
  isDropped?: boolean;
  onToggleBacklog?: (appid: string) => void;
  onTogglePinned?: (appid: string) => void;
}

/** List row (dense table): number, cover, game, platform, trophies, progress, time and actions. */
export function LibraryRow({ game, rank, completion, isPinned, inBacklog, isDropped, onToggleBacklog, onTogglePinned }: LibraryRowProps) {
  const t = useT('library');
  const meta = game.platform ? PLATFORM_META[game.platform] : null;
  const noun = game.platform === 'psn' ? t('item.trophies') : t('item.achievements');
  const queueAction = inBacklog ? t('item.removeFromQueue') : t('item.addToPlan');
  const pinAction = isPinned ? t('item.unpin') : t('item.pin');
  const trophies = completion ? `${completion.unlocked}/${completion.total}` : '—';

  return (
    <div className="lib-row" role="row">
      <span className="rank hide-sm" role="cell">{rank}</span>
      <span role="cell"><GameCover game={game} portrait className="lib-cover" imgClassName="object-cover" /></span>
      <span role="cell" className="min-w-0">
        <span className="lib-name">
          {isPinned && <Pin size={12} className="pin" aria-label={t('item.pinned')} />}
          <Link to={`/game/${game.appid}`} state={{ from: { to: '/library', label: t('title.library') } }} title={game.name}>{game.name}</Link>
          {isDropped && <span className="badge" data-tone="danger">{t('item.dropped')}</span>}
        </span>
        <span className="lib-sub">{meta && <><img src={meta.logo} alt="" />{meta.short} ·</>} {trophies}<span className="sr-only"> {noun}</span></span>
        {completion && <ProgressBar className="lib-bar-m mt-1" percent={completion.percent} />}
      </span>
      <span role="cell" className="lib-plat hide-sm hide-md">{meta ? <><img src={meta.logo} alt="" />{meta.short}</> : '—'}</span>
      <span role="cell" className="lib-num r hide-sm">{trophies}<span className="sr-only"> {noun}</span></span>
      <span role="cell" className="lib-prog hide-sm">
        {completion ? (
          <>
            <ProgressBar className="bar" percent={completion.percent} />
            <span className="v">{completion.percent}%</span>
          </>
        ) : <span className="v ml-auto text-gray-500">—</span>}
      </span>
      <span role="cell" className="lib-pct-m">{completion ? `${completion.percent}%` : '—'}</span>
      <span role="cell" className="lib-num r hide-sm hide-md">{game.playtime_forever > 0 ? formatMinutes(game.playtime_forever) : '—'}</span>
      <span role="cell" className="lib-actions">
        {onToggleBacklog && (
          <button className="plan" aria-label={t('item.actionFor', { action: queueAction, name: game.name })} aria-pressed={Boolean(inBacklog)} onClick={() => onToggleBacklog(String(game.appid))} title={queueAction}>
            {inBacklog ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
          </button>
        )}
        {onTogglePinned && (
          <button aria-label={t('item.actionFor', { action: pinAction, name: game.name })} aria-pressed={Boolean(isPinned)} onClick={() => onTogglePinned(String(game.appid))} title={isPinned ? t('item.unpin') : t('item.pinAsPriority')}>
            <Pin size={16} fill={isPinned ? 'currentColor' : 'none'} />
          </button>
        )}
      </span>
    </div>
  );
}
