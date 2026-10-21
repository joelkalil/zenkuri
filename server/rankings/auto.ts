import { db, extractRarity, listGames, parseJson } from '../db';
import type { Platform } from '../types';
import { deriveRankings } from './derive';
import type { RankingGameInput, RankingList } from './types';

interface RawGameRow {
  id: number;
  groupId: number | null;
  playtimeMinutes: number | null;
}

interface RemainingRow {
  gameId: number;
  platform: Platform;
  achievementMeta: string | null;
  statusMeta: string | null;
}

/**
 * Rarity of each still-locked achievement, per game, in a single query
 * (no N+1). Games with no rows in `achievements` do not appear in the map.
 */
export function listRemainingRarities(userId: number): Map<number, Array<number | null>> {
  const rows = db.prepare(`
    select a.game_id as gameId, g.platform as platform,
      a.metadata_json as achievementMeta, ua.metadata_json as statusMeta
    from user_games ug
    join games g on g.id = ug.game_id
    join achievements a on a.game_id = g.id
    left join user_achievements ua on ua.achievement_id = a.id and ua.user_id = ?
    where ug.user_id = ? and coalesce(ua.achieved, 0) = 0
    order by a.game_id, a.id
  `).all(userId, userId) as RemainingRow[];

  const byGame = new Map<number, Array<number | null>>();
  for (const row of rows) {
    const rarity = extractRarity(
      row.platform,
      parseJson<Record<string, unknown>>(row.achievementMeta, {}),
      parseJson<Record<string, unknown>>(row.statusMeta, {}),
    );
    const list = byGame.get(row.gameId);
    if (list) list.push(rarity);
    else byGame.set(row.gameId, [rarity]);
  }
  return byGame;
}

/** Ranking-engine inputs for the user's library. */
export function listRankingInputs(userId: number): RankingGameInput[] {
  const games = listGames(userId); // also ensures the group backfill
  const raw = new Map(
    (db.prepare(`
      select g.id as id, g.group_id as groupId, ug.playtime_minutes as playtimeMinutes
      from user_games ug
      join games g on g.id = ug.game_id
      where ug.user_id = ?
    `).all(userId) as RawGameRow[]).map((row) => [row.id, row]),
  );
  const rarities = listRemainingRarities(userId);

  return games.map((game) => {
    const row = raw.get(game.id);
    return {
      gameId: game.id,
      groupId: row?.groupId ?? null,
      platform: game.platform,
      externalId: game.platformGameId,
      title: game.name,
      playtimeMinutes: row?.playtimeMinutes ?? 0,
      unlocked: game.completion.unlocked,
      total: game.completion.total,
      percent: game.completion.percent,
      remainingRarities: rarities.get(game.id) ?? [],
    };
  });
}

/** Automatic rankings (finish, quick, grind, demanding). */
export function getAutoRankings(userId: number): { lists: RankingList[] } {
  return { lists: deriveRankings(listRankingInputs(userId)) };
}
