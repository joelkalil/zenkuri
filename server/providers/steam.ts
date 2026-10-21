import {
  getGameById,
  pruneUserGames,
  refreshGameAchievementFlag,
  upsertAchievement,
  upsertGame,
} from '../db';
import { ApiError } from '../errors';
import { steamServiceKey } from '../serviceAuth';
import { requireVerifiedLink } from '../verification';

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
  img_icon_url?: string;
  has_community_visible_stats?: boolean;
}

interface SteamPlayerAchievement {
  apiname: string;
  achieved: number;
  unlocktime: number;
}

interface SteamSchemaAchievement {
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
  icongray?: string;
  hidden?: number;
}

function steamConfig(userId: number) {
  // Service key (.env) + the public SteamID linked to the user.
  const link = requireVerifiedLink(userId, 'steam');
  const steamid = String(link.steamid ?? '');
  if (!steamid) throw new Error('Steam is not configured.');
  return { key: steamServiceKey(), steamid };
}

/**
 * Thrown when Steam rejects the API key (401/403). Changing the Steam account
 * password usually invalidates the service key, so this must be distinguishable
 * from any other error: it must not be swallowed by the fallback `.catch()`
 * handlers below, and it must surface as an actionable message in the UI
 * instead of a bare "Steam API error 401".
 */
export class SteamAuthError extends ApiError {
  constructor() {
    super('sync.steam_key_rejected', 502);
    this.name = 'SteamAuthError';
  }
}

function rethrowIfAuthError(err: unknown): void {
  if (err instanceof SteamAuthError) throw err;
}

async function steamFetch<T>(path: string, params: Record<string, string | number | boolean>) {
  const url = new URL(`https://api.steampowered.com/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    throw new SteamAuthError();
  }
  if (!res.ok) throw new Error(`Steam API error ${res.status}`);
  return await res.json() as T;
}

export async function syncSteamLibrary(userId: number) {
  const { key, steamid } = steamConfig(userId);
  const json = await steamFetch<{ response?: { games?: SteamGame[] } }>('IPlayerService/GetOwnedGames/v1/', {
    key,
    steamid,
    include_appinfo: true,
    include_played_free_games: true,
    skip_unvetted_apps: false,
  });

  const games = json.response?.games ?? [];
  const seen: string[] = [];
  for (const game of games) {
    const externalId = String(game.appid);
    seen.push(externalId);
    upsertGame(userId, {
      platform: 'steam',
      externalId,
      title: game.name,
      coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      iconUrl: game.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg` : '',
      playtimeMinutes: game.playtime_forever ?? 0,
      recentPlaytimeMinutes: game.playtime_2weeks ?? null,
      hasAchievements: Boolean(game.has_community_visible_stats),
      metadata: game as unknown as Record<string, unknown>,
    });
  }

  // Removes games that no longer belong to this Steam account (e.g. SteamID changed).
  // Only prunes when the API returned games, to avoid wiping everything on a private profile.
  pruneUserGames(userId, 'steam', seen);

  return games.length;
}

export async function syncSteamAchievementsForGame(userId: number, gameId: number) {
  const game = getGameById(gameId);
  if (!game || game.platform !== 'steam') throw new Error('Steam game not found.');
  const { key, steamid } = steamConfig(userId);
  const appid = Number(game.external_id);

  const [schemaJson, playerJson, globalJson] = await Promise.all([
    // The schema and the player's achievements are the source of truth for
    // progress: an invalid key here must abort (rethrow), not silently turn
    // into "0 achievements" — that is exactly what masked the revoked key.
    steamFetch<{ game?: { availableGameStats?: { achievements?: SteamSchemaAchievement[] } } }>('ISteamUserStats/GetSchemaForGame/v2/', {
      key,
      appid,
    }).catch((err) => { rethrowIfAuthError(err); return { game: { availableGameStats: { achievements: [] } } }; }),
    steamFetch<{ playerstats?: { achievements?: SteamPlayerAchievement[]; error?: string } }>('ISteamUserStats/GetPlayerAchievements/v1/', {
      key,
      steamid,
      appid,
    }).catch((err) => { rethrowIfAuthError(err); return { playerstats: { achievements: [] } }; }),
    // Global percentages are just rarity decoration, so they tolerate any
    // failure, including a bad key, and never block the sync.
    steamFetch<{ achievementpercentages?: { achievements?: { name: string; percent: number | string }[] } }>('ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/', {
      gameid: appid,
    }).catch(() => ({ achievementpercentages: { achievements: [] } })),
  ]);

  const schema = schemaJson.game?.availableGameStats?.achievements ?? [];
  const player = playerJson.playerstats?.achievements ?? [];
  const playerMap = new Map(player.map((achievement) => [achievement.apiname, achievement]));
  const globalMap = new Map(
    (globalJson.achievementpercentages?.achievements ?? []).map((item) => [item.name, Number(item.percent)]),
  );

  for (const achievement of schema) {
    const status = playerMap.get(achievement.name);
    const globalPercent = globalMap.get(achievement.name);
    upsertAchievement(userId, {
      gameId,
      externalId: achievement.name,
      title: achievement.displayName || achievement.name,
      description: achievement.description ?? '',
      iconUrl: achievement.icon ?? '',
      lockedIconUrl: achievement.icongray ?? achievement.icon ?? '',
      hidden: Boolean(achievement.hidden),
      displayOrder: schema.indexOf(achievement),
      achieved: status?.achieved === 1,
      unlockTime: status?.unlocktime ?? 0,
      metadata: {
        ...(achievement as unknown as Record<string, unknown>),
        globalPercent: Number.isFinite(globalPercent) ? globalPercent : undefined,
      },
      statusMetadata: status as unknown as Record<string, unknown>,
    });
  }

  refreshGameAchievementFlag(gameId);
  return schema.length;
}
