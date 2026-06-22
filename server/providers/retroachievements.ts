import {
  getCredential,
  getGameById,
  refreshGameAchievementFlag,
  upsertAchievement,
  upsertGame,
} from '../db';
import {
  buildAuthorization,
  getGameInfoAndUserProgress,
  getUserCompletionProgress,
} from '@retroachievements/api';

function raConfig() {
  const credential = getCredential('retroachievements');
  const username = String(credential?.data.username ?? '');
  const webApiKey = String(credential?.data.webApiKey ?? '');
  if (!username || !webApiKey) throw new Error('RetroAchievements is not configured.');
  return { username, webApiKey, authorization: buildAuthorization({ username, webApiKey }) };
}

export async function syncRetroAchievementsLibrary() {
  const { username, authorization } = raConfig();
  let offset = 0;
  const count = 500;
  let received = 0;

  while (true) {
    const response = await getUserCompletionProgress(authorization, { username, count, offset });
    const results = response.results ?? [];
    const total = response.total ?? results.length;
    received += results.length;

    for (const game of results) {
      upsertGame({
        platform: 'retroachievements',
        externalId: String(game.gameId),
        title: game.title,
        coverUrl: game.imageIcon ? `https://media.retroachievements.org${game.imageIcon}` : '',
        iconUrl: game.imageIcon ? `https://media.retroachievements.org${game.imageIcon}` : '',
        hasAchievements: true,
        metadata: game as unknown as Record<string, unknown>,
      });
    }

    offset += count;
    if (received >= total || results.length === 0) break;
  }

  return received;
}

export async function syncRetroAchievementsForGame(gameId: number) {
  const game = getGameById(gameId);
  if (!game || game.platform !== 'retroachievements') throw new Error('RetroAchievements game not found.');
  const { username, authorization } = raConfig();
  const response = await getGameInfoAndUserProgress(authorization, {
    username,
    gameId: Number(game.external_id),
  });

  const achievements = Object.values(response.achievements ?? {});
  for (const achievement of achievements as any[]) {
    const earnedAt = achievement.dateEarnedHardcore ?? achievement.dateEarned;
    upsertAchievement({
      gameId,
      externalId: String(achievement.id),
      title: achievement.title,
      description: achievement.description ?? '',
      iconUrl: achievement.badgeName ? `https://media.retroachievements.org/Badge/${achievement.badgeName}.png` : '',
      lockedIconUrl: achievement.badgeName ? `https://media.retroachievements.org/Badge/${achievement.badgeName}_lock.png` : '',
      hidden: false,
      displayOrder: achievement.displayOrder ?? 0,
      points: achievement.points ?? null,
      type: achievement.type ?? '',
      achieved: Boolean(earnedAt),
      unlockTime: earnedAt ? Math.floor(new Date(earnedAt).getTime() / 1000) : 0,
      metadata: achievement,
      statusMetadata: { dateEarned: achievement.dateEarned, dateEarnedHardcore: achievement.dateEarnedHardcore },
    });
  }

  refreshGameAchievementFlag(gameId);
  return achievements.length;
}
