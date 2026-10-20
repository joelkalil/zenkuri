import {
  getGameById,
  pruneUserGames,
  refreshGameAchievementFlag,
  upsertAchievement,
  upsertGame,
} from '../db';
import type { Platform } from '../types';
import {
  getTitleTrophies,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
} from 'psn-api';
import { psnServiceAuth } from '../serviceAuth';
import { requireVerifiedLink } from '../verification';

const platform: Platform = 'psn';

function trophyTotal(counts: any) {
  return Number(counts?.bronze ?? 0) + Number(counts?.silver ?? 0) + Number(counts?.gold ?? 0) + Number(counts?.platinum ?? 0);
}

function trophyUnlocked(counts: any) {
  return trophyTotal(counts);
}

function psnAccountId(userId: number) {
  // Conta de serviço (.env) consultando o accountId público vinculado.
  const link = requireVerifiedLink(userId, platform);
  const accountId = String(link.accountId ?? '');
  if (!accountId) throw new Error('PSN is not configured.');
  return accountId;
}

export async function syncPsnLibrary(userId: number) {
  const accountId = psnAccountId(userId);
  const authorization = await psnServiceAuth();
  let offset = 0;
  const limit = 800;
  let received = 0;
  const seen: string[] = [];

  while (true) {
    const response = await getUserTitles(authorization, accountId, { limit, offset });
    const titles = response.trophyTitles ?? [];
    const total = response.totalItemCount ?? titles.length;
    received += titles.length;

    for (const title of titles) {
      const totalTrophies = trophyTotal(title.definedTrophies);
      const earned = trophyUnlocked(title.earnedTrophies);
      seen.push(String(title.npCommunicationId));
      const game = upsertGame(userId, {
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

  // Destaca jogos que não pertencem mais a esta conta PSN (ex.: accountId trocado).
  pruneUserGames(userId, platform, seen);

  return received;
}

export async function syncPsnAchievementsForGame(userId: number, gameId: number) {
  const game = getGameById(gameId);
  if (!game || game.platform !== platform) throw new Error('PSN game not found.');
  const accountId = psnAccountId(userId);
  const metadata = JSON.parse(game.metadata_json || '{}') as any;
  const authorization = await psnServiceAuth();
  const npServiceName = metadata.npServiceName ?? 'trophy2';

  const [title, user] = await Promise.all([
    getTitleTrophies(authorization, game.external_id, 'all', { npServiceName, limit: 800 }),
    getUserTrophiesEarnedForTitle(authorization, accountId, game.external_id, 'all', { npServiceName, limit: 800 }),
  ]);

  const statusById = new Map((user.trophies ?? []).map((trophy: any) => [String(trophy.trophyId), trophy]));
  for (const trophy of title.trophies ?? []) {
    const status = statusById.get(String(trophy.trophyId)) as any;
    upsertAchievement(userId, {
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
