import {
  getGameById,
  pruneUserGames,
  refreshGameAchievementFlag,
  upsertAchievement,
  upsertGame,
} from '../db';
import {
  getGameInfoAndUserProgress,
  getUserCompletionProgress,
} from '@retroachievements/api';
import { raServiceAuth } from '../serviceAuth';
import { requireVerifiedLink } from '../verification';

function raConfig(userId: number) {
  // Credencial de serviço (.env) consultando o username público vinculado.
  const link = requireVerifiedLink(userId, 'retroachievements');
  const username = String(link.username ?? '');
  if (!username) throw new Error('RetroAchievements is not configured.');
  return { username, authorization: raServiceAuth() };
}

export async function syncRetroAchievementsLibrary(userId: number) {
  const { username, authorization } = raConfig(userId);
  let offset = 0;
  const count = 500;
  let received = 0;
  const seen: string[] = [];

  while (true) {
    const response = await getUserCompletionProgress(authorization, { username, count, offset });
    const results = response.results ?? [];
    const total = response.total ?? results.length;
    received += results.length;

    for (const game of results) {
      const externalId = String(game.gameId);
      seen.push(externalId);
      upsertGame(userId, {
        platform: 'retroachievements',
        externalId,
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

  // Destaca jogos que não pertencem mais a este usuário RA (ex.: username trocado).
  pruneUserGames(userId, 'retroachievements', seen);

  return received;
}

export async function syncRetroAchievementsForGame(userId: number, gameId: number) {
  const game = getGameById(gameId);
  if (!game || game.platform !== 'retroachievements') throw new Error('RetroAchievements game not found.');
  const { username, authorization } = raConfig(userId);
  const response = await getGameInfoAndUserProgress(authorization, {
    username,
    gameId: Number(game.external_id),
  });

  const achievements = Object.values(response.achievements ?? {});
  // Total de jogadores do set: usado para derivar a raridade (numAwarded / players).
  const distinctPlayers = Number(
    (response as any).numDistinctPlayers
      ?? (response as any).numDistinctPlayersHardcore
      ?? (response as any).numDistinctPlayersCasual
      ?? 0,
  );
  for (const achievement of achievements as any[]) {
    const earnedAt = achievement.dateEarnedHardcore ?? achievement.dateEarned;
    upsertAchievement(userId, {
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
      metadata: { ...achievement, numDistinctPlayers: distinctPlayers > 0 ? distinctPlayers : undefined },
      statusMetadata: { dateEarned: achievement.dateEarned, dateEarnedHardcore: achievement.dateEarnedHardcore },
    });
  }

  refreshGameAchievementFlag(gameId);
  return achievements.length;
}
