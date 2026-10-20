/*
  Agregação do nível por usuário: lê as conquistas desbloqueadas do banco e
  aplica a régua de XP definida em `levelMath.ts` (que é pura e sem I/O).
*/

import { db, extractRarity, parseJson } from './db';
import type { Platform } from './types';
import {
  achievementXp,
  levelFromXp,
  rarityTier,
  COMPLETION_BONUS_XP,
  RARITY_TIERS,
  type LevelProgress,
} from './levelMath';

export * from './levelMath';

// ─── Agregação por usuário ──────────────────────────────────────────────────

export interface LevelSlice {
  key: string;
  label: string;
  achievements: number;
  xp: number;
}

export interface UserLevel extends LevelProgress {
  xp: number;
  counts: {
    achievements: number;
    /** conquistas em faixas de raridade abaixo de 10% */
    rare: number;
    platinums: number;
    perfects: number;
  };
  breakdown: {
    platforms: LevelSlice[];
    rarity: LevelSlice[];
    bonusXp: number;
  };
}

const PLATFORM_LABEL: Record<Platform, string> = {
  steam: 'Steam',
  psn: 'PlayStation',
  retroachievements: 'RetroAchievements',
};

/** Contagem de jogos concluídos, com os mesmos critérios do Hall da Platina. */
function countCompletions(userId: number): { platinums: number; perfects: number } {
  const platinums = db.prepare(`
    select count(distinct g.id) as total
    from games g
    join achievements a on a.game_id = g.id
    join user_achievements ua on ua.achievement_id = a.id and ua.user_id = ?
    where g.platform = 'psn'
      and lower(coalesce(a.type, '')) = 'platinum'
      and ua.achieved = 1
  `).get(userId) as { total: number };

  const perfects = db.prepare(`
    select count(*) as total from (
      select g.id
      from user_games ug
      join games g on g.id = ug.game_id
      join achievements a on a.game_id = g.id
      left join user_achievements ua on ua.achievement_id = a.id and ua.user_id = ug.user_id
      where g.platform != 'psn' and ug.user_id = ?
      group by g.id
      having count(a.id) > 0
        and sum(case when ua.achieved = 1 then 1 else 0 end) = count(a.id)
    )
  `).get(userId) as { total: number };

  return { platinums: platinums?.total ?? 0, perfects: perfects?.total ?? 0 };
}

/** Calcula XP, nível e composição do nível de um usuário. */
export function computeUserLevel(userId: number): UserLevel {
  const rows = db.prepare(`
    select
      g.platform,
      a.type,
      a.points,
      a.metadata_json as achievement_metadata_json,
      ua.metadata_json as status_metadata_json
    from user_achievements ua
    join achievements a on a.id = ua.achievement_id
    join games g on g.id = a.game_id
    where ua.user_id = ? and ua.achieved = 1
  `).all(userId) as Array<{
    platform: Platform;
    type: string | null;
    points: number | null;
    achievement_metadata_json: string | null;
    status_metadata_json: string | null;
  }>;

  const platformTotals = new Map<Platform, { achievements: number; xp: number }>();
  const rarityTotals = new Map<string, { achievements: number; xp: number }>();
  let achievementXpTotal = 0;
  let rare = 0;

  for (const row of rows) {
    const rarity = extractRarity(
      row.platform,
      parseJson<Record<string, any>>(row.achievement_metadata_json, {}),
      parseJson<Record<string, any>>(row.status_metadata_json, {}),
    );
    const xp = achievementXp({ platform: row.platform, type: row.type, points: row.points, rarity });
    achievementXpTotal += xp;

    const platform = platformTotals.get(row.platform) ?? { achievements: 0, xp: 0 };
    platform.achievements += 1;
    platform.xp += xp;
    platformTotals.set(row.platform, platform);

    const tier = rarityTier(rarity);
    const key = tier?.key ?? 'unknown';
    const bucket = rarityTotals.get(key) ?? { achievements: 0, xp: 0 };
    bucket.achievements += 1;
    bucket.xp += xp;
    rarityTotals.set(key, bucket);

    if (tier && tier.maxPercent <= 10) rare += 1;
  }

  const { platinums, perfects } = countCompletions(userId);
  const bonusXp = (platinums + perfects) * COMPLETION_BONUS_XP;
  const xp = achievementXpTotal + bonusXp;

  const platforms: LevelSlice[] = (Object.keys(PLATFORM_LABEL) as Platform[])
    .map((platform) => ({
      key: platform,
      label: PLATFORM_LABEL[platform],
      achievements: platformTotals.get(platform)?.achievements ?? 0,
      xp: platformTotals.get(platform)?.xp ?? 0,
    }))
    .filter((slice) => slice.achievements > 0)
    .sort((a, b) => b.xp - a.xp);

  const rarity: LevelSlice[] = [
    ...RARITY_TIERS.map((tier) => ({
      key: tier.key as string,
      label: tier.label as string,
      achievements: rarityTotals.get(tier.key)?.achievements ?? 0,
      xp: rarityTotals.get(tier.key)?.xp ?? 0,
    })),
    {
      key: 'unknown',
      label: 'Sem raridade',
      achievements: rarityTotals.get('unknown')?.achievements ?? 0,
      xp: rarityTotals.get('unknown')?.xp ?? 0,
    },
  ].filter((slice) => slice.achievements > 0);

  return {
    ...levelFromXp(xp),
    xp,
    counts: { achievements: rows.length, rare, platinums, perfects },
    breakdown: { platforms, rarity, bonusXp },
  };
}

// ─── Cache em memória ───────────────────────────────────────────────────────

/*
  O cálculo varre todas as conquistas do usuário. Como a Sidebar e o Painel
  pedem o nível quase ao mesmo tempo, um TTL curto já elimina o trabalho
  repetido; o sync invalida explicitamente para o ganho aparecer na hora.
*/
const CACHE_TTL_MS = 60_000;
const cache = new Map<number, { value: UserLevel; at: number }>();

export function getUserLevel(userId: number): UserLevel {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  const value = computeUserLevel(userId);
  cache.set(userId, { value, at: Date.now() });
  return value;
}

export function invalidateUserLevel(userId?: number) {
  if (userId === undefined) cache.clear();
  else cache.delete(userId);
}
