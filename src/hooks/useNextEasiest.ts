import { useMemo } from 'react';
import { useGameDetails } from './useSteamApi';
import type { AchievementWithStatus } from '../types/steam';

/**
 * Próximos 3: as conquistas restantes mais fáceis. Raridade global manda
 * (mais jogadores têm = mais fácil); RA sem raridade cai para pontos; sem
 * nenhum dos dois não há como ordenar e a lista fica vazia.
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

/** Carrega as conquistas do jogo (mesma chamada da página do jogo) e devolve os próximos 3. */
export function useNextEasiest(appid: number | null) {
  const { data, loading, error } = useGameDetails(appid);
  const next = useMemo(() => selectNextEasiest(data?.merged ?? []), [data]);
  return { next, loading, error, loaded: data !== null };
}
