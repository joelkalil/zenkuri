/*
  Pure math of Zenkuri's level system.

  No I/O and no dependency on `db.ts` — on purpose, for the same reason as
  `mediaPaths.ts`: it keeps the module testable in isolation and avoids an
  import cycle.

  XP is derived exclusively from the set of already unlocked achievements, so
  the computation is deterministic: the same collection always yields the same
  XP and a re-sync never makes the number regress. No XP for playtime or dates.

  The scale favors difficulty over volume — global rarity multiplies the base
  XP, so a <1% achievement is worth more than dozens of trivial ones. This keeps
  the division of roles with the Platinum Hall, which already celebrates the
  volume of completions.
*/

import type { Platform } from './types';

// ─── Scale constants (single calibration point) ────────────────────────

/** Base XP per PSN trophy, by type. */
const PSN_BASE_XP: Record<string, number> = {
  bronze: 15,
  silver: 30,
  gold: 90,
  platinum: 300,
};

/** Steam exposes neither type nor points: every achievement is worth the same base XP. */
const STEAM_BASE_XP = 20;

/** RetroAchievements scores from 1 to 100; the factor brings the scale close to the others. */
const RA_POINTS_FACTOR = 1.5;
const RA_MAX_POINTS = 100;

/** Bonus per completed game (PSN platinum or 100% elsewhere). */
export const COMPLETION_BONUS_XP = 500;

/**
 * Global rarity tiers (% of players who own the achievement).
 * Evaluated in order: the first tier whose ceiling fits the rarity wins.
 */
export const RARITY_TIERS = [
  { key: 'mythic', label: 'Mítica', maxPercent: 1, multiplier: 4.0 },
  { key: 'ultra', label: 'Ultra rara', maxPercent: 5, multiplier: 2.6 },
  { key: 'rare', label: 'Rara', maxPercent: 10, multiplier: 2.0 },
  { key: 'uncommon', label: 'Incomum', maxPercent: 25, multiplier: 1.45 },
  { key: 'common', label: 'Comum', maxPercent: 50, multiplier: 1.15 },
  { key: 'trivial', label: 'Trivial', maxPercent: Infinity, multiplier: 1.0 },
] as const;

/** Achievements with no reported rarity are neither penalized nor rewarded. */
const UNKNOWN_RARITY_MULTIPLIER = 1.0;

/**
 * Curve: cumulative XP required to reach `level` = BASE × (level - 1) ^ EXP.
 * Super-linear growth with no ceiling — leveling up gets progressively more
 * expensive, but never impossible.
 */
export const CURVE_BASE_XP = 300;
export const CURVE_EXPONENT = 1.6;

/** Progression tiers. `minLevel` ascending; the last one has no ceiling. */
export const LEVEL_TIERS = [
  { key: 'alvorada', label: 'Alvorada', minLevel: 1, accent: 'gray' },
  { key: 'aurora', label: 'Aurora', minLevel: 5, accent: 'violet-300' },
  { key: 'peregrino', label: 'Peregrino', minLevel: 10, accent: 'violet-400' },
  { key: 'artesao', label: 'Artesão', minLevel: 18, accent: 'violet-400' },
  { key: 'veterano', label: 'Veterano', minLevel: 28, accent: 'violet-500' },
  { key: 'mestre', label: 'Mestre', minLevel: 40, accent: 'violet-500' },
  { key: 'sensei', label: 'Sensei', minLevel: 55, accent: 'violet-600' },
  { key: 'lenda', label: 'Lenda', minLevel: 75, accent: 'violet-600' },
] as const;

export type LevelTier = (typeof LEVEL_TIERS)[number];
export type RarityTierKey = (typeof RARITY_TIERS)[number]['key'];

// ─── Pure math (no I/O, testable in isolation) ───────────────────────

/** Rarity tier of an achievement; `null` when the platform does not report it. */
export function rarityTier(rarity: number | null) {
  if (rarity === null || !Number.isFinite(rarity)) return null;
  return RARITY_TIERS.find((tier) => rarity < tier.maxPercent) ?? RARITY_TIERS[RARITY_TIERS.length - 1];
}

export function rarityMultiplier(rarity: number | null): number {
  return rarityTier(rarity)?.multiplier ?? UNKNOWN_RARITY_MULTIPLIER;
}

/** Base XP of an achievement, before the rarity multiplier. */
export function baseXp(input: { platform: Platform; type?: string | null; points?: number | null }): number {
  if (input.platform === 'psn') {
    return PSN_BASE_XP[String(input.type ?? '').toLowerCase()] ?? PSN_BASE_XP.bronze;
  }
  if (input.platform === 'steam') return STEAM_BASE_XP;

  const points = Number(input.points ?? 0);
  const clamped = Math.min(RA_MAX_POINTS, Math.max(1, Number.isFinite(points) ? points : 1));
  return clamped * RA_POINTS_FACTOR;
}

/** Final XP of an unlocked achievement. */
export function achievementXp(input: {
  platform: Platform;
  type?: string | null;
  points?: number | null;
  rarity: number | null;
}): number {
  return Math.round(baseXp(input) * rarityMultiplier(input.rarity));
}

/** Cumulative XP needed to reach a level. Level 1 costs zero. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(CURVE_BASE_XP * (level - 1) ** CURVE_EXPONENT);
}

export function tierForLevel(level: number): LevelTier {
  let match: LevelTier = LEVEL_TIERS[0];
  for (const tier of LEVEL_TIERS) if (level >= tier.minLevel) match = tier;
  return match;
}

export interface LevelProgress {
  level: number;
  /** XP already accumulated within the current level. */
  xpIntoLevel: number;
  /** XP the current level requires to roll over (0 when total XP is 0). */
  xpForNextLevel: number;
  /** 0–100, progress within the current level. */
  progressPercent: number;
  tier: LevelTier;
  nextTier: LevelTier | null;
}

/** Converts total XP into a level + progress within the level. */
export function levelFromXp(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp));

  /*
    The analytic inverse gives almost the right level, but `xpForLevel` rounds
    the thresholds — and without this correction the two disagree exactly at the
    rollover, with the bar stuck at 100% without leveling up. The rounded
    thresholds are the source of truth; the adjustment below costs at most one
    iteration.
  */
  let level = Math.max(1, Math.floor((safeXp / CURVE_BASE_XP) ** (1 / CURVE_EXPONENT)) + 1);
  while (xpForLevel(level + 1) <= safeXp) level += 1;
  while (level > 1 && xpForLevel(level) > safeXp) level -= 1;

  const floorXp = xpForLevel(level);
  const ceilingXp = xpForLevel(level + 1);
  const span = Math.max(1, ceilingXp - floorXp);
  const xpIntoLevel = safeXp - floorXp;
  const tier = tierForLevel(level);
  const nextTier = LEVEL_TIERS.find((item) => item.minLevel > level) ?? null;

  return {
    level,
    xpIntoLevel,
    xpForNextLevel: span,
    progressPercent: Math.min(100, Math.max(0, Math.round((xpIntoLevel / span) * 100))),
    tier,
    nextTier,
  };
}

/** Exposed for the calibration script. */
export const LEVEL_CURVE = { CURVE_BASE_XP, CURVE_EXPONENT, LEVEL_TIERS };
