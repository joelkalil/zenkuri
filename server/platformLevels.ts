import { getUserSummary } from '@retroachievements/api';
import { getUserTrophyProfileSummary } from 'psn-api';
import type { Platform } from './types';
import { getCredential } from './db';
import type { ApiErrorCode } from './errorCodes';
import { ApiError } from './errors';
import { SteamAuthError } from './providers/steam';
import { psnServiceAuth, raServiceAuth, steamServiceKey } from './serviceAuth';
import type { PlatformLinkData } from './verification';

/*
  Native level of each platform
  ─────────────────────────────
  The Zenkuri level is computed locally (level.ts). These are the numbers each
  platform shows on its own profile: Steam level, PSN trophy level and
  RetroAchievements points/rank. Queried live with the service credential,
  kept in memory for a few minutes only and never persisted.
  Each platform fails on its own: an expired NPSSO does not take Steam down.
*/

export type PlatformLevel =
  | { platform: 'steam'; status: 'ok'; level: number; xp: number; xpIntoLevel: number; xpForNextLevel: number; progressPercent: number }
  | { platform: 'psn'; status: 'ok'; level: number; progressPercent: number; tier: number; grade: 'Bronze' | 'Prata' | 'Ouro' | 'Platina'; trophies: { platinum: number; gold: number; silver: number; bronze: number } }
  | { platform: 'retroachievements'; status: 'ok'; points: number; softcorePoints: number; truePoints: number; rank: number | null; totalRanked: number | null }
  | { platform: Platform; status: 'unlinked' }
  | { platform: Platform; status: 'error'; message: string; code?: ApiErrorCode };

const TTL_MS = 10 * 60_000;
const cache = new Map<number, { at: number; value: PlatformLevel[] }>();

function linkFor(userId: number, platform: Platform): PlatformLinkData | null {
  const data = getCredential(userId, platform)?.data as PlatformLinkData | undefined;
  return data?.verified ? data : null;
}

function message(err: unknown) {
  return err instanceof Error ? err.message : 'Failed to query the platform.';
}

async function steamLevel(userId: number): Promise<PlatformLevel> {
  const link = linkFor(userId, 'steam');
  const steamid = String(link?.steamid ?? '');
  if (!steamid) return { platform: 'steam', status: 'unlinked' };

  const url = new URL('https://api.steampowered.com/IPlayerService/GetBadges/v1/');
  url.searchParams.set('key', steamServiceKey());
  url.searchParams.set('steamid', steamid);
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) throw new SteamAuthError();
  if (!res.ok) throw new Error(`Steam API error ${res.status}`);
  const json = await res.json() as {
    response?: {
      player_level?: number;
      player_xp?: number;
      player_xp_needed_to_level_up?: number;
      player_xp_needed_current_level?: number;
    };
  };
  const r = json.response;
  if (!r || r.player_level === undefined) throw new ApiError('sync.steam_profile_private', 400);

  const xp = r.player_xp ?? 0;
  const base = r.player_xp_needed_current_level ?? xp;
  const toNext = r.player_xp_needed_to_level_up ?? 0;
  const span = Math.max(1, xp - base + toNext);
  return {
    platform: 'steam',
    status: 'ok',
    level: r.player_level,
    xp,
    xpIntoLevel: xp - base,
    xpForNextLevel: span,
    progressPercent: Math.round(((xp - base) / span) * 100),
  };
}

const PSN_GRADE = ['Bronze', 'Bronze', 'Bronze', 'Prata', 'Prata', 'Prata', 'Ouro', 'Ouro', 'Ouro', 'Platina'] as const;

async function psnLevel(userId: number): Promise<PlatformLevel> {
  const accountId = String(linkFor(userId, 'psn')?.accountId ?? '');
  if (!accountId) return { platform: 'psn', status: 'unlinked' };

  const summary = await getUserTrophyProfileSummary(await psnServiceAuth(), accountId);
  const tier = Math.min(10, Math.max(1, Number(summary.tier) || 1));
  return {
    platform: 'psn',
    status: 'ok',
    level: Number(summary.trophyLevel) || 0,
    progressPercent: Number(summary.progress) || 0,
    tier,
    grade: PSN_GRADE[tier - 1],
    trophies: {
      platinum: Number(summary.earnedTrophies?.platinum ?? 0),
      gold: Number(summary.earnedTrophies?.gold ?? 0),
      silver: Number(summary.earnedTrophies?.silver ?? 0),
      bronze: Number(summary.earnedTrophies?.bronze ?? 0),
    },
  };
}

async function raLevel(userId: number): Promise<PlatformLevel> {
  const username = String(linkFor(userId, 'retroachievements')?.username ?? '');
  if (!username) return { platform: 'retroachievements', status: 'unlinked' };

  const summary = await getUserSummary(raServiceAuth(), { username, recentGamesCount: 0, recentAchievementsCount: 0 });
  return {
    platform: 'retroachievements',
    status: 'ok',
    points: Number(summary.totalPoints) || 0,
    softcorePoints: Number(summary.totalSoftcorePoints) || 0,
    truePoints: Number(summary.totalTruePoints) || 0,
    rank: Number(summary.rank) > 0 ? Number(summary.rank) : null,
    totalRanked: Number(summary.totalRanked) > 0 ? Number(summary.totalRanked) : null,
  };
}

async function settle(platform: Platform, run: () => Promise<PlatformLevel>): Promise<PlatformLevel> {
  try {
    return await run();
  } catch (err) {
    return { platform, status: 'error', message: message(err), code: err instanceof ApiError ? err.code : undefined };
  }
}

export async function getPlatformLevels(userId: number, { fresh = false } = {}): Promise<PlatformLevel[]> {
  const hit = cache.get(userId);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = await Promise.all([
    settle('steam', () => steamLevel(userId)),
    settle('psn', () => psnLevel(userId)),
    settle('retroachievements', () => raLevel(userId)),
  ]);
  // Errors are not cached: the next visit tries again.
  if (value.every((item) => item.status !== 'error')) cache.set(userId, { at: Date.now(), value });
  return value;
}

export function invalidatePlatformLevels(userId: number) {
  cache.delete(userId);
}
