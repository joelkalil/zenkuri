import { useMemo, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { Game } from '../types/steam';
import { platformCoverUrl } from '../lib/steamApi';

const STEAM_CDN_URLS = (appid: number) => [
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
  `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
];

/* Fallback art replaces a real cover, so it stays dark and branded in both
   themes (fixed colors, not theme tokens). */
const PLATFORM_STYLE: Record<string, { background: string; color: string; borderColor: string }> = {
  steam: { background: 'linear-gradient(135deg, #0a1d33 0%, #161425 55%, #281147 100%)', color: '#bae2ff', borderColor: 'rgba(56,130,175,0.35)' },
  psn: { background: 'linear-gradient(135deg, #0a1838 0%, #14142e 55%, #1e1a4a 100%)', color: '#bcd2ff', borderColor: 'rgba(60,90,200,0.35)' },
  retroachievements: { background: 'linear-gradient(135deg, #2e0f12 0%, #221423 55%, #3a2410 100%)', color: '#ffd9a8', borderColor: 'rgba(180,120,60,0.35)' },
  default: { background: 'linear-gradient(135deg, #1a1822 0%, #151320 55%, #100e18 100%)', color: '#cbd0e0', borderColor: 'rgba(120,120,150,0.3)' },
};

interface GameCoverProps {
  game: Game;
  className?: string;
  imgClassName?: string;
}

function platformLabel(game: Game) {
  if (game.platform === 'retroachievements') return 'RA';
  if (game.platform === 'psn') return 'PSN';
  return 'Steam';
}

export function GameCover({ game, className = '', imgClassName = '' }: GameCoverProps) {
  const srcs = useMemo(
    () => [platformCoverUrl(game), ...STEAM_CDN_URLS(Number(game.platformGameId ?? game.appid))].filter(Boolean),
    [game],
  );
  const [srcIdx, setSrcIdx] = useState(0);
  const style = PLATFORM_STYLE[game.platform ?? 'default'] ?? PLATFORM_STYLE.default;

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

  return (
    <div
      className={`${className} relative flex flex-col items-center justify-center gap-2 overflow-hidden border`}
      style={{ background: style.background, color: style.color, borderColor: style.borderColor }}
    >
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.16),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.10),transparent_28%)]" />
      <Gamepad2 className="relative w-7 h-7 opacity-80" />
      <span className="relative max-w-full px-3 text-center text-xs font-bold leading-tight line-clamp-2">{game.name}</span>
      <span className="relative text-[10px] font-bold uppercase tracking-normal opacity-70">{platformLabel(game)}</span>
    </div>
  );
}
