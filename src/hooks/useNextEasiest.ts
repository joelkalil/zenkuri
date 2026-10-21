import { useMemo } from 'react';
import { useGameDetails } from './useSteamApi';
import type { AchievementWithStatus } from '../types/steam';

/**
 * Next 3: the easiest remaining achievements. Global rarity decides
 * (more players have it = easier); RA without rarity falls back to points;
 * with neither there is no way to order them and the list is empty.
 */
export function selectNextEasiest(achievements: AchievementWithStatus[], count = 3): AchievementWithStatus[] {
  const locked = achievements.filter((a) => !a.achieved);
  const ease = (a: AchievementWithStatus) => {
    if (typeof a.rarity === 'number' && a.rarity > 0) return a.rarity;
    if (typeof a.points === 'number' && a.points > 0) return 100 - Math.min(a.points, 99);
    return -1;
  };
  if (!locked.some((a) => ease(a) >= 0)) return [];
  return [...locked].sort((a, b) => ease(b) - ease(a)).slice(0, count);
}

/** Loads the game's achievements (same call as the game page) and returns the next 3. */
export function useNextEasiest(appid: number | null) {
  const { data, loading, error } = useGameDetails(appid);
  const next = useMemo(() => selectNextEasiest(data?.merged ?? []), [data]);
  return { next, loading, error, loaded: data !== null };
}
