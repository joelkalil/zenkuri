import {
  getCredential,
  getGameById,
  refreshGameAchievementFlag,
  upsertAchievement,
  upsertGame,
} from '../db';

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

function steamConfig() {
  const credential = getCredential('steam');
  const key = String(credential?.data.key ?? '');
  const steamid = String(credential?.data.steamid ?? '');
  if (!key || !steamid) throw new Error('Steam is not configured.');
  return { key, steamid };
}

async function steamFetch<T>(path: string, params: Record<string, string | number | boolean>) {
  const url = new URL(`https://api.steampowered.com/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API error ${res.status}`);
  return await res.json() as T;
}

export async function syncSteamLibrary() {
  const { key, steamid } = steamConfig();
  const json = await steamFetch<{ response?: { games?: SteamGame[] } }>('IPlayerService/GetOwnedGames/v1/', {
    key,
    steamid,
    include_appinfo: true,
    include_played_free_games: true,
    skip_unvetted_apps: false,
  });

  const games = json.response?.games ?? [];
  for (const game of games) {
    upsertGame({
      platform: 'steam',
      externalId: String(game.appid),
      title: game.name,
      coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      iconUrl: game.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg` : '',
      playtimeMinutes: game.playtime_forever ?? 0,
      recentPlaytimeMinutes: game.playtime_2weeks ?? null,
      hasAchievements: Boolean(game.has_community_visible_stats),
      metadata: game as unknown as Record<string, unknown>,
    });
  }

  return games.length;
}

export async function syncSteamAchievementsForGame(gameId: number) {
  const game = getGameById(gameId);
  if (!game || game.platform !== 'steam') throw new Error('Steam game not found.');
  const { key, steamid } = steamConfig();
  const appid = Number(game.external_id);

  const [schemaJson, playerJson] = await Promise.all([
    steamFetch<{ game?: { availableGameStats?: { achievements?: SteamSchemaAchievement[] } } }>('ISteamUserStats/GetSchemaForGame/v2/', {
      key,
      appid,
    }).catch(() => ({ game: { availableGameStats: { achievements: [] } } })),
    steamFetch<{ playerstats?: { achievements?: SteamPlayerAchievement[]; error?: string } }>('ISteamUserStats/GetPlayerAchievements/v1/', {
      key,
      steamid,
      appid,
    }).catch(() => ({ playerstats: { achievements: [] } })),
  ]);

  const schema = schemaJson.game?.availableGameStats?.achievements ?? [];
  const player = playerJson.playerstats?.achievements ?? [];
  const playerMap = new Map(player.map((achievement) => [achievement.apiname, achievement]));

  for (const achievement of schema) {
    const status = playerMap.get(achievement.name);
    upsertAchievement({
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
      metadata: achievement as unknown as Record<string, unknown>,
      statusMetadata: status as unknown as Record<string, unknown>,
    });
  }

  refreshGameAchievementFlag(gameId);
  return schema.length;
}
