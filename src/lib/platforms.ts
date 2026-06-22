import type { Game, Platform } from '../types/steam';

export const PLATFORM_META: Record<Platform, { label: string; short: string; logo: string; color: string }> = {
  steam: {
    label: 'Steam',
    short: 'Steam',
    logo: '/platforms/steam.png',
    color: 'text-sky-400',
  },
  psn: {
    label: 'PlayStation Network',
    short: 'PSN',
    logo: '/platforms/psn.png',
    color: 'text-blue-400',
  },
  retroachievements: {
    label: 'RetroAchievements',
    short: 'RA',
    logo: '/platforms/retroachievements.webp',
    color: 'text-amber-400',
  },
};

export type PlatformFilter = 'all' | Platform;
export type ViewMode = 'common' | 'platform';

export function platformLabel(platform?: string, long = false) {
  if (platform === 'steam' || platform === 'psn' || platform === 'retroachievements') {
    return long ? PLATFORM_META[platform].label : PLATFORM_META[platform].short;
  }
  return long ? 'All platforms' : 'All';
}

function countPsnTrophies(games: Game[]) {
  const total = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const earned = { platinum: 0, gold: 0, silver: 0, bronze: 0 };

  for (const game of games) {
    const metadata = game.metadata ?? {};
    const defined = (metadata.definedTrophies ?? {}) as Record<string, unknown>;
    const unlocked = (metadata.earnedTrophies ?? {}) as Record<string, unknown>;
    total.platinum += Number(defined.platinum ?? 0);
    total.gold += Number(defined.gold ?? 0);
    total.silver += Number(defined.silver ?? 0);
    total.bronze += Number(defined.bronze ?? 0);
    earned.platinum += Number(unlocked.platinum ?? 0);
    earned.gold += Number(unlocked.gold ?? 0);
    earned.silver += Number(unlocked.silver ?? 0);
    earned.bronze += Number(unlocked.bronze ?? 0);
  }

  return { total, earned };
}

export function platformStats(games: Game[]) {
  const psnGames = games.filter((game) => game.platform === 'psn');
  const steamGames = games.filter((game) => game.platform === 'steam');
  const raGames = games.filter((game) => game.platform === 'retroachievements');
  const psn = countPsnTrophies(psnGames);

  return {
    psn,
    steam: {
      perfectGames: steamGames.filter((game) => game.completion?.percent === 100).length,
      unlocked: steamGames.reduce((sum, game) => sum + (game.completion?.unlocked ?? 0), 0),
      total: steamGames.reduce((sum, game) => sum + (game.completion?.total ?? 0), 0),
      recentMinutes: steamGames.reduce((sum, game) => sum + (game.playtime_2weeks ?? 0), 0),
    },
    retroachievements: {
      masteredGames: raGames.filter((game) => game.completion?.percent === 100).length,
      hardcoreUnlocked: raGames.reduce((sum, game) => sum + Number(game.metadata?.numAwardedHardcore ?? game.completion?.unlocked ?? 0), 0),
      hardcoreTotal: raGames.reduce((sum, game) => sum + Number(game.metadata?.maxPossible ?? game.completion?.total ?? 0), 0),
    },
  };
}

export function psnTrophyBreakdown(game?: Game | null) {
  if (!game || game.platform !== 'psn') return null;
  const metadata = game.metadata ?? {};
  const defined = (metadata.definedTrophies ?? {}) as Record<string, unknown>;
  const earned = (metadata.earnedTrophies ?? {}) as Record<string, unknown>;
  return {
    platinum: { total: Number(defined.platinum ?? 0), earned: Number(earned.platinum ?? 0) },
    gold: { total: Number(defined.gold ?? 0), earned: Number(earned.gold ?? 0) },
    silver: { total: Number(defined.silver ?? 0), earned: Number(earned.silver ?? 0) },
    bronze: { total: Number(defined.bronze ?? 0), earned: Number(earned.bronze ?? 0) },
  };
}

export function hasPsnPlatinum(game: Game) {
  if (game.platform !== 'psn') return false;
  const metadata = game.metadata ?? {};
  const earned = (metadata.earnedTrophies ?? {}) as Record<string, unknown>;
  return Number(earned.platinum ?? 0) > 0;
}
