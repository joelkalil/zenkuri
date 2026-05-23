import { useState, useEffect, useCallback } from 'react';
import { cacheGet, cacheSet } from '../lib/cache';
import { fetchOwnedGames, fetchPlayerAchievements, fetchGameSchema } from '../lib/steamApi';
import type { Game, SchemaAchievement, PlayerAchievement, AchievementWithStatus } from '../types/steam';

export function useSteamGames() {
  const [games, setGames] = useState<Game[]>(() => cacheGet<Game[]>('steam-cache:owned-games') ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'steam-cache:owned-games';
    if (!forceRefresh) {
      const cached = cacheGet<Game[]>(cacheKey);
      if (cached) {
        setGames(cached);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOwnedGames();
      cacheSet(cacheKey, data);
      setGames(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const key = localStorage.getItem('steam-api-key');
    const id = localStorage.getItem('steam-id');
    if (key && id) load();
  }, [load]);

  return { games, loading, error, reload: load };
}

export interface GameDetails {
  schema: SchemaAchievement[];
  player: PlayerAchievement[];
  merged: AchievementWithStatus[];
  completionPercent: number;
  unlocked: number;
  total: number;
}

export function useGameDetails(appid: number | null) {
  const [data, setData] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appid) return;

    const schemaCacheKey = `steam-cache:schema:${appid}`;
    const playerCacheKey = `steam-cache:player:${appid}`;

    const cachedSchema = cacheGet<SchemaAchievement[]>(schemaCacheKey);
    const cachedPlayer = cacheGet<PlayerAchievement[]>(playerCacheKey);

    if (cachedSchema && cachedPlayer) {
      setData(mergeDetails(cachedSchema, cachedPlayer));
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      cachedSchema ? Promise.resolve(cachedSchema) : fetchGameSchema(appid),
      cachedPlayer ? Promise.resolve(cachedPlayer) : fetchPlayerAchievements(appid),
    ])
      .then(([schema, player]) => {
        if (!cachedSchema) cacheSet(schemaCacheKey, schema);
        if (!cachedPlayer) cacheSet(playerCacheKey, player);
        setData(mergeDetails(schema, player));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load achievements'))
      .finally(() => setLoading(false));
  }, [appid]);

  return { data, loading, error };
}

function mergeDetails(schema: SchemaAchievement[], player: PlayerAchievement[]): GameDetails {
  const playerMap = new Map(player.map((p) => [p.apiname, p]));
  const merged: AchievementWithStatus[] = schema.map((s) => {
    const p = playerMap.get(s.name);
    return { ...s, achieved: (p?.achieved ?? 0) === 1, unlocktime: p?.unlocktime ?? 0 };
  });
  // Sort: unlocked first (by unlock time desc), then locked
  merged.sort((a, b) => {
    if (a.achieved && !b.achieved) return -1;
    if (!a.achieved && b.achieved) return 1;
    return b.unlocktime - a.unlocktime;
  });
  const unlocked = merged.filter((a) => a.achieved).length;
  const total = merged.length;
  const completionPercent = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  return { schema, player, merged, completionPercent, unlocked, total };
}

/** Read completion data from cache without triggering a fetch */
export function getCachedCompletion(appid: number): { percent: number; unlocked: number; total: number } | null {
  const schema = cacheGet<SchemaAchievement[]>(`steam-cache:schema:${appid}`);
  const player = cacheGet<PlayerAchievement[]>(`steam-cache:player:${appid}`);
  if (!schema || !player) return null;
  const details = mergeDetails(schema, player);
  return { percent: details.completionPercent, unlocked: details.unlocked, total: details.total };
}
