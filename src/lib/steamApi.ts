import type { Game, SchemaAchievement, PlayerAchievement } from '../types/steam';

export function getSteamConfig() {
  return {
    key: localStorage.getItem('steam-api-key') ?? '',
    steamid: localStorage.getItem('steam-id') ?? '',
  };
}

export async function fetchOwnedGames(): Promise<Game[]> {
  const { key, steamid } = getSteamConfig();
  const url = `/steam-api/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamid}&include_appinfo=true&include_played_free_games=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API error ${res.status}`);
  const json = await res.json();
  return json.response?.games ?? [];
}

export async function fetchPlayerAchievements(appid: number): Promise<PlayerAchievement[]> {
  const { key, steamid } = getSteamConfig();
  const url = `/steam-api/ISteamUserStats/GetPlayerAchievements/v1/?key=${key}&steamid=${steamid}&appid=${appid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Achievements API error ${res.status} for ${appid}`);
  const json = await res.json();
  if (json.playerstats?.error) return []; // game has no stats
  return json.playerstats?.achievements ?? [];
}

export async function fetchGameSchema(appid: number): Promise<SchemaAchievement[]> {
  const { key } = getSteamConfig();
  const url = `/steam-api/ISteamUserStats/GetSchemaForGame/v2/?key=${key}&appid=${appid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Schema API error ${res.status} for ${appid}`);
  const json = await res.json();
  return json.game?.availableGameStats?.achievements ?? [];
}

export function gameCoverUrl(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

export function platformCoverUrl(game: { platform?: string; platformGameId?: string; coverUrl?: string; appid: number }): string {
  if (game.coverUrl) return game.coverUrl;
  if (game.platform === 'steam' && game.platformGameId) return gameCoverUrl(Number(game.platformGameId));
  return gameCoverUrl(game.appid);
}
