import { Link } from 'react-router-dom';
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

/** Linha da lista (tabela densa): nº, capa, jogo, plataforma, troféus, progresso, tempo e ações. */
export function LibraryRow({ game, rank, completion, isPinned, inBacklog, isDropped, onToggleBacklog, onTogglePinned }: LibraryRowProps) {
  const meta = game.platform ? PLATFORM_META[game.platform] : null;
  const noun = game.platform === 'psn' ? 'troféus' : 'conquistas';
  const trophies = completion ? `${completion.unlocked}/${completion.total}` : '—';

  return (
    <div className="lib-row" role="row">
      <span className="rank hide-sm" role="cell">{rank}</span>
      <span role="cell"><GameCover game={game} portrait className="lib-cover" imgClassName="object-cover" /></span>
      <span role="cell" className="min-w-0">
        <span className="lib-name">
          {isPinned && <Pin size={12} className="pin" aria-label="Fixado" />}
          <Link to={`/game/${game.appid}`} state={{ from: { to: '/library', label: 'Biblioteca' } }} title={game.name}>{game.name}</Link>
          {isDropped && <span className="badge" data-tone="danger">Abandonado</span>}
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
          <button className="plan" aria-label={`${inBacklog ? 'Remover da fila' : 'Adicionar ao plano'}: ${game.name}`} aria-pressed={Boolean(inBacklog)} onClick={() => onToggleBacklog(String(game.appid))} title={inBacklog ? 'Remover da fila' : 'Adicionar ao plano'}>
            {inBacklog ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
          </button>
        )}
        {onTogglePinned && (
          <button aria-label={`${isPinned ? 'Desafixar' : 'Fixar'}: ${game.name}`} aria-pressed={Boolean(isPinned)} onClick={() => onTogglePinned(String(game.appid))} title={isPinned ? 'Desafixar' : 'Fixar como prioridade'}>
            <Pin size={16} fill={isPinned ? 'currentColor' : 'none'} />
          </button>
        )}
      </span>
    </div>
  );
}
