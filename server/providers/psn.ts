import {
  getCredential,
  getGameById,
  refreshGameAchievementFlag,
  setCredential,
  upsertAchievement,
  upsertGame,
} from '../db';
import type { Platform } from '../types';
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getTitleTrophies,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
} from 'psn-api';

type PsnAuthData = {
  npsso?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  refreshExpiresAt?: number;
};

const platform: Platform = 'psn';

function trophyTotal(counts: any) {
  return Number(counts?.bronze ?? 0) + Number(counts?.silver ?? 0) + Number(counts?.gold ?? 0) + Number(counts?.platinum ?? 0);
}

function trophyUnlocked(counts: any) {
  return trophyTotal(counts);
}

async function psnAuthorization() {
  const credential = getCredential(platform);
  const data = (credential?.data ?? {}) as PsnAuthData;
  const now = Date.now();

  if (data.accessToken && data.expiresAt && data.expiresAt - 60_000 > now) {
    return { accessToken: data.accessToken };
  }

  if (data.refreshToken && (!data.refreshExpiresAt || data.refreshExpiresAt > now)) {
    const tokens = await exchangeRefreshTokenForAuthTokens(data.refreshToken);
    const next: PsnAuthData = {
      ...data,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: now + tokens.expiresIn * 1000,
      refreshExpiresAt: now + tokens.refreshTokenExpiresIn * 1000,
    };
    setCredential(platform, next as Record<string, unknown>);
    return { accessToken: tokens.accessToken };
  }

  if (!data.npsso) throw new Error('PSN NPSSO is not configured.');
  const accessCode = await exchangeNpssoForAccessCode(data.npsso);
  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  const next: PsnAuthData = {
    ...data,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: now + tokens.expiresIn * 1000,
    refreshExpiresAt: now + tokens.refreshTokenExpiresIn * 1000,
  };
  setCredential(platform, next as Record<string, unknown>);
  return { accessToken: tokens.accessToken };
}

export async function syncPsnLibrary() {
  const authorization = await psnAuthorization();
  let offset = 0;
  const limit = 800;
  let received = 0;

  while (true) {
    const response = await getUserTitles(authorization, 'me', { limit, offset });
    const titles = response.trophyTitles ?? [];
    const total = response.totalItemCount ?? titles.length;
    received += titles.length;

    for (const title of titles) {
      const totalTrophies = trophyTotal(title.definedTrophies);
      const earned = trophyUnlocked(title.earnedTrophies);
      const game = upsertGame({
        platform,
        externalId: title.npCommunicationId,
        title: title.trophyTitleName,
        coverUrl: title.trophyTitleIconUrl,
        iconUrl: title.trophyTitleIconUrl,
        hasAchievements: totalTrophies > 0,
        metadata: title as unknown as Record<string, unknown>,
      });
      if (totalTrophies > 0 && earned === 0) {
        refreshGameAchievementFlag(game.id);
      }
    }

    offset += limit;
    if (received >= total || titles.length === 0) break;
  }

  return received;
}

export async function syncPsnAchievementsForGame(gameId: number) {
  const game = getGameById(gameId);
  if (!game || game.platform !== platform) throw new Error('PSN game not found.');
  const metadata = JSON.parse(game.metadata_json || '{}') as any;
  const authorization = await psnAuthorization();
  const npServiceName = metadata.npServiceName ?? 'trophy2';

  const [title, user] = await Promise.all([
    getTitleTrophies(authorization, game.external_id, 'all', { npServiceName, limit: 800 }),
    getUserTrophiesEarnedForTitle(authorization, 'me', game.external_id, 'all', { npServiceName, limit: 800 }),
  ]);

  const statusById = new Map((user.trophies ?? []).map((trophy: any) => [String(trophy.trophyId), trophy]));
  for (const trophy of title.trophies ?? []) {
    const status = statusById.get(String(trophy.trophyId)) as any;
    upsertAchievement({
      gameId,
      externalId: String(trophy.trophyId),
      title: trophy.trophyName ?? `Trophy ${trophy.trophyId}`,
      description: trophy.trophyDetail ?? '',
      iconUrl: trophy.trophyIconUrl ?? '',
      lockedIconUrl: trophy.trophyIconUrl ?? '',
      hidden: Boolean(trophy.trophyHidden),
      displayOrder: Number(trophy.trophyId),
      type: trophy.trophyType ?? '',
      achieved: Boolean(status?.earned),
      unlockTime: status?.earnedDateTime ? Math.floor(new Date(status.earnedDateTime).getTime() / 1000) : 0,
      metadata: trophy as unknown as Record<string, unknown>,
      statusMetadata: status ?? {},
    });
  }

  refreshGameAchievementFlag(gameId);
  return title.trophies?.length ?? 0;
}
