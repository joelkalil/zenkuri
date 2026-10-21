import { Link } from 'react-router-dom';
import { BookmarkCheck, BookmarkPlus, CircleSlash, Pin } from 'lucide-react';
import { GameCover } from './GameCover';
import { Stamp } from './Stamp';
import { PLATFORM_META, hasPsnPlatinum, psnTrophyBreakdown } from '../lib/platforms';
import type { Game } from '../types/steam';

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
  { key: 'platinum', label: 'platina', icon: '/trophies/platinum.png' },
  { key: 'gold', label: 'ouro', icon: '/trophies/gold.png' },
  { key: 'silver', label: 'prata', icon: '/trophies/silver.png' },
  { key: 'bronze', label: 'bronze', icon: '/trophies/bronze.png' },
] as const;

/**
 * Capa no estilo do launcher: a arte ocupa o cartão, o progresso fica numa
 * barra fina sobre a base da capa e o texto embaixo é só nome + uma linha.
 * Ações (plano, fixar) aparecem no canto ao passar o ponteiro ou focar.
 */
export function LibraryCard({ game, completion, isPinned, inBacklog, isDropped, onToggleBacklog, onTogglePinned }: LibraryCardProps) {
  const meta = game.platform ? PLATFORM_META[game.platform] : null;
  const breakdown = psnTrophyBreakdown(game);
  const complete = completion?.percent === 100;
  const platinum = hasPsnPlatinum(game);
  const noun = game.platform === 'psn' ? 'troféus' : 'conquistas';

  return (
    <article className="game-card">
      <Link to={`/game/${game.appid}`} className="game-card-link" aria-label={`Ver detalhes de ${game.name}`}>
        <div className="game-card-cover">
          <GameCover game={game} portrait className="h-full w-full" imgClassName="object-cover" />
          {(platinum || complete || isDropped) && <div className="game-card-badges">
            {(platinum || complete) && <span className="cover-stamp"><Stamp kind={platinum ? 'platina' : '100'} size={24} /></span>}
            {isDropped && <span className="cover-badge" data-tone="drop"><CircleSlash size={12} aria-hidden="true" />Abandonado</span>}
          </div>}
          {completion && <>
            <div className="game-card-shade" />
            <div className="game-card-meter" role="progressbar" aria-label="Conclusão do jogo" aria-valuenow={completion.percent} aria-valuemin={0} aria-valuemax={100}>
              <span className="game-card-meter-track"><span className="game-card-meter-fill" data-complete={complete} style={{ width: `${Math.min(completion.percent, 100)}%` }} /></span>
              <span>{completion.percent}%</span>
            </div>
          </>}
        </div>
        <h2 className="game-card-name" title={game.name}>{game.name}</h2>
      </Link>
      <div className="game-card-meta">
        {meta && <img src={meta.logo} alt="" />}
        <span>{meta?.short ?? '—'}</span>
        {game.relatedPlatforms?.map((platform) => <span key={platform}>· {PLATFORM_META[platform].short}</span>)}
        <span aria-hidden="true">·</span>
        {completion ? <span>{completion.unlocked}/{completion.total}<span className="sr-only"> {noun}</span></span> : <span>sem {noun}</span>}
      </div>
      {breakdown && <div className="game-card-trophies">
        {TROPHY_TYPES.map(({ key, label, icon }) => {
          const trophy = breakdown[key];
          return trophy.total > 0 ? <span key={key} className="flex items-center gap-1 text-xs tabular-nums text-gray-500" title={`${trophy.earned}/${trophy.total} ${label}`}>
            <img src={icon} alt={label} className="h-3.5 w-3.5 object-contain" />{trophy.earned}
          </span> : null;
        })}
      </div>}
      {(onToggleBacklog || onTogglePinned) && <div className="game-card-actions">
        {onToggleBacklog && <button className="game-card-action" onClick={() => onToggleBacklog(String(game.appid))} aria-pressed={Boolean(inBacklog)} aria-label={`${inBacklog ? 'Remover da fila' : 'Adicionar ao plano'}: ${game.name}`} title={inBacklog ? 'Remover da fila' : 'Adicionar ao plano'}>
          {inBacklog ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />}
        </button>}
        {onTogglePinned && <button className="game-card-action" onClick={() => onTogglePinned(String(game.appid))} aria-pressed={Boolean(isPinned)} aria-label={`${isPinned ? 'Desafixar' : 'Fixar'}: ${game.name}`} title={isPinned ? 'Desafixar' : 'Fixar como prioridade'}>
          <Pin size={15} fill={isPinned ? 'currentColor' : 'none'} />
        </button>}
      </div>}
    </article>
  );
}
