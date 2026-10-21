import { useMemo, useState } from 'react';
import type { Game } from '../types/steam';
import { platformCoverUrl } from '../lib/steamApi';

const STEAM_CDN_URLS = (appid: number) => [
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
  `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
];

interface GameCoverProps {
  game: Game;
  className?: string;
  imgClassName?: string;
  /** prefer the vertical box art (Steam library_600x900) when available */
  portrait?: boolean;
}

function platformLabel(game: Game) {
  if (game.platform === 'retroachievements') return 'RA';
  if (game.platform === 'psn') return 'PSN';
  return 'Steam';
}

export function GameCover({ game, className = '', imgClassName = '', portrait = false }: GameCoverProps) {
  const srcs = useMemo(
    () => (portrait
      ? [game.portraitUrl, platformCoverUrl(game), ...STEAM_CDN_URLS(Number(game.platformGameId ?? game.appid))]
      : [platformCoverUrl(game), ...STEAM_CDN_URLS(Number(game.platformGameId ?? game.appid))]
    ).filter(Boolean) as string[],
    [game, portrait],
  );
  const [srcIdx, setSrcIdx] = useState(0);

  function handleImgError() {
    if (srcIdx < srcs.length - 1) setSrcIdx((current) => current + 1);
    else setSrcIdx(srcs.length);
  }

  if (srcIdx < srcs.length) {
    return (
      <img
        key={`${game.appid}-${srcIdx}`}
        src={srcs[srcIdx]}
        alt={game.name}
        onError={handleImgError}
        className={`${className} ${imgClassName}`}
      />
    );
  }

  /* No art: flat typographic placeholder (name in display type on paper-2, 全 in the background). */
  return (
    <div
      role="img"
      aria-label={game.name}
      className={`${className} relative flex flex-col items-center justify-center gap-1 overflow-hidden bg-gray-850 text-gray-300`}
    >
      <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-display text-5xl font-black leading-none text-gray-800">全</span>
      <span className="relative max-w-full px-2 text-center font-display text-xs font-bold leading-tight line-clamp-3">{game.name}</span>
      <span className="relative font-mono text-[10px] uppercase text-gray-500">{platformLabel(game)}</span>
    </div>
  );
}
