/*
  Automatic rankings (pure, deterministic, no IO).

  Common eligibility
  - Out: total === 0, completed (unlocked >= total or percent >= 100) and
    duplicates of the same groupId (the most advanced version stays: highest
    percent, then unlocked, then playtime, then lowest gameId). Dedupe runs
    before the completed exclusion: if the group's most advanced version is
    completed, the whole group is out.
  - remaining = total - unlocked. remainingRarities is aligned/limited to that
    number; missing positions (e.g. PSN with progress only) count as unknown
    rarity (null).

  Hours estimate (estimateRemainingHours)
  - Each remaining achievement is weighted by rarity (RARITY_WEIGHTS; unknown =
    UNKNOWN_RARITY_WEIGHT). Weight 1 ≈ an "average" achievement.
  - Hours per unit = playtime / unlocked (clamped to [MIN, MAX]_HOURS_PER_UNIT),
    assuming the already unlocked ones weigh 1. Without playtime or without
    unlocked, uses FALLBACK_HOURS_PER_UNIT.
  - mid = hours per unit × sum of weights, clamped to [MIN_HOURS, MAX_HOURS].
  - Range = mid ± 30%, rounded (0.5h < 10h; 1h < 50h; 5h above).
  - Reliable only if there was measured playtime OR >= 50% of the remaining
    rarities are known; otherwise the published range is null (the internal
    mid still orders quick/grind).

  Lists (may overlap, except quick which never includes "home stretch" games)
  - finish    "Finish now": percent >= 60, remaining <= 10 and no blocker
                below 1%. Score = 0.5·percent + 0.3·(closeness by
                remaining) + 0.2·ease (average rarity of the remaining,
                capped at 50%; unknown = 0.5) + up to 0.05 recency.
  - quick     "Quick": percent < 60, remaining <= 12, mid <= 8h, no
                blocker < 1%. Started or not. Score = 0.6·(1 - mid/8) +
                0.25·(1 - remaining/12) + 0.15·ease.
  - grind     "Long projects": remaining >= 25, mid >= 25h and at most 15%
                of the remaining < 1% (feasible). Score = (0.7·min(mid,150)/150 +
                0.3·min(remaining,150)/150) × (1 - ultra-rare fraction).
  - demanding "Demanding": difficulty mass = Σ per remaining
                (3 if < 1%, 1 if < 5%, 0 otherwise) >= 3. Score = mass
                (open scale, not normalized).

  Ordering: score desc, then percent desc, then gameId asc.
*/
import type {
  RankedGame,
  RankingGameInput,
  RankingList,
  RankingListId,
  ReasonCode,
} from './types';

export const RANKING_THRESHOLDS = {
  DEFAULT_LIMIT: 20,
  ULTRA_RARE_PERCENT: 1,
  VERY_RARE_PERCENT: 5,
  ULTRA_RARE_MASS: 3,
  VERY_RARE_MASS: 1,

  FINISH_MIN_PERCENT: 60,
  FINISH_MAX_REMAINING: 10,
  FINISH_RECENCY_DAYS: 180,
  FINISH_RECENCY_BONUS: 0.05,

  QUICK_MAX_REMAINING: 12,
  QUICK_MAX_HOURS: 8,

  GRIND_MIN_REMAINING: 25,
  GRIND_MIN_HOURS: 25,
  GRIND_MAX_ULTRA_SHARE: 0.15,
  GRIND_HOURS_CAP: 150,
  GRIND_REMAINING_CAP: 150,

  DEMANDING_MIN_MASS: 3,

  EASE_RARITY_CAP: 50,
  EASE_UNKNOWN: 0.5,

  UNKNOWN_RARITY_WEIGHT: 1.5,
  FALLBACK_HOURS_PER_UNIT: 0.5,
  MIN_HOURS_PER_UNIT: 0.05,
  MAX_HOURS_PER_UNIT: 2.5,
  MIN_HOURS: 0.5,
  MAX_HOURS: 400,
  RANGE_SPREAD: 0.3,
  MIN_KNOWN_RARITY_SHARE: 0.5,
} as const;

/** The first threshold whose `below` exceeds the rarity defines the weight. */
const RARITY_WEIGHTS = [
  { below: 1, weight: 6 },
  { below: 5, weight: 3 },
  { below: 10, weight: 1.8 },
  { below: 25, weight: 1.2 },
  { below: 50, weight: 0.9 },
  { below: Infinity, weight: 0.6 },
] as const;

const LIST_META: Record<RankingListId, Omit<RankingList, 'id' | 'entries'>> = {
  finish: {
    label: 'Finish now',
    shortLabel: 'Now',
    description: 'Games on the verge of completion: few achievements left and no extreme blockers.',
  },
  quick: {
    label: 'Quick wins',
    shortLabel: 'Quick',
    description: 'Games, started or not, that become one more completion without hijacking the month.',
  },
  grind: {
    label: 'Long projects',
    shortLabel: 'Long',
    description: 'A lot ahead and dozens of estimated hours, but feasible to finish.',
  },
  demanding: {
    label: 'Demanding',
    shortLabel: 'Demanding',
    description: 'Remaining achievements with very low rarity: they take skill, luck or a serious relationship with the game.',
  },
};

const T = RANKING_THRESHOLDS;
const MS_PER_DAY = 86_400_000;

interface Candidate {
  game: RankingGameInput;
  remaining: number;
  rarities: Array<number | null>;
  knownRarities: number[];
  ultraRareCount: number;
  rarestPercent: number | null;
  mass: number;
  ease: number;
  hoursMid: number;
  estimateHours: [number, number] | null;
}

export interface HoursEstimate {
  mid: number;
  range: [number, number] | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function alignRarities(game: RankingGameInput, remaining: number): Array<number | null> {
  const aligned: Array<number | null> = [];
  for (let i = 0; i < remaining; i++) {
    const value = game.remainingRarities[i];
    aligned.push(typeof value === 'number' && Number.isFinite(value) ? value : null);
  }
  return aligned;
}

function rarityWeight(rarity: number | null): number {
  if (rarity === null) return T.UNKNOWN_RARITY_WEIGHT;
  return RARITY_WEIGHTS.find((tier) => rarity < tier.below)?.weight ?? 1;
}

function roundHours(hours: number): number {
  const step = hours < 10 ? 0.5 : hours < 50 ? 1 : 5;
  return Math.round(hours / step) * step;
}

function estimateFrom(game: RankingGameInput, rarities: Array<number | null>): HoursEstimate {
  const remaining = rarities.length;
  const weightSum = rarities.reduce<number>((sum, r) => sum + rarityWeight(r), 0);
  const measured = game.unlocked > 0 && game.playtimeMinutes > 0;
  const perUnit = measured
    ? clamp(game.playtimeMinutes / 60 / game.unlocked, T.MIN_HOURS_PER_UNIT, T.MAX_HOURS_PER_UNIT)
    : T.FALLBACK_HOURS_PER_UNIT;
  const mid = Math.round(clamp(perUnit * weightSum, T.MIN_HOURS, T.MAX_HOURS) * 100) / 100;

  const known = rarities.filter((r) => r !== null).length;
  const reliable = measured || (remaining > 0 && known / remaining >= T.MIN_KNOWN_RARITY_SHARE);
  if (!reliable) return { mid, range: null };

  const step = mid < 10 ? 0.5 : mid < 50 ? 1 : 5;
  const low = Math.max(step, roundHours(mid * (1 - T.RANGE_SPREAD)));
  let high = roundHours(mid * (1 + T.RANGE_SPREAD));
  if (high <= low) high = low + step;
  return { mid, range: [low, high] };
}

/** Public estimate (also used in tests). */
export function estimateRemainingHours(game: RankingGameInput): HoursEstimate {
  return estimateFrom(game, alignRarities(game, Math.max(0, game.total - game.unlocked)));
}

function isCompleted(game: RankingGameInput): boolean {
  return game.unlocked >= game.total || game.percent >= 100;
}

function isMoreAdvanced(a: RankingGameInput, b: RankingGameInput): boolean {
  if (a.percent !== b.percent) return a.percent > b.percent;
  if (a.unlocked !== b.unlocked) return a.unlocked > b.unlocked;
  if (a.playtimeMinutes !== b.playtimeMinutes) return a.playtimeMinutes > b.playtimeMinutes;
  return a.gameId < b.gameId;
}

function dedupeByGroup(games: RankingGameInput[]): RankingGameInput[] {
  const best = new Map<number, RankingGameInput>();
  const result: RankingGameInput[] = [];
  for (const game of games) {
    if (game.groupId === null) {
      result.push(game);
      continue;
    }
    const current = best.get(game.groupId);
    if (!current || isMoreAdvanced(game, current)) best.set(game.groupId, game);
  }
  return [...result, ...best.values()];
}

function toCandidate(game: RankingGameInput): Candidate {
  const remaining = game.total - game.unlocked;
  const rarities = alignRarities(game, remaining);
  const known = rarities.filter((r): r is number => r !== null);
  const estimate = estimateFrom(game, rarities);
  const easeValues = known.map((r) => Math.min(r, T.EASE_RARITY_CAP) / T.EASE_RARITY_CAP);
  return {
    game,
    remaining,
    rarities,
    knownRarities: known,
    ultraRareCount: known.filter((r) => r < T.ULTRA_RARE_PERCENT).length,
    rarestPercent: known.length > 0 ? Math.min(...known) : null,
    mass: known.reduce<number>(
      (sum, r) => sum + (r < T.ULTRA_RARE_PERCENT ? T.ULTRA_RARE_MASS : r < T.VERY_RARE_PERCENT ? T.VERY_RARE_MASS : 0),
      0,
    ),
    ease: easeValues.length > 0 ? easeValues.reduce((a, b) => a + b, 0) / easeValues.length : T.EASE_UNKNOWN,
    hoursMid: estimate.mid,
    estimateHours: estimate.range,
  };
}

function entry(c: Candidate, score: number, reasons: ReasonCode[]): RankedGame {
  return { gameId: c.game.gameId, score: round4(score), estimateHours: c.estimateHours, reasons };
}

function rarestReason(c: Candidate): ReasonCode[] {
  return c.rarestPercent === null ? [] : [{ code: 'rarest', percent: Math.round(c.rarestPercent * 10) / 10 }];
}

function finishEntry(c: Candidate, now: number): RankedGame | null {
  const { game, remaining } = c;
  if (game.percent < T.FINISH_MIN_PERCENT || remaining > T.FINISH_MAX_REMAINING || c.ultraRareCount > 0) return null;
  const proximity = 1 / (1 + (remaining - 1) / 3);
  let recency = 0;
  if (typeof game.lastPlayedAt === 'number') {
    const ageDays = (now - game.lastPlayedAt) / MS_PER_DAY;
    if (ageDays >= 0 && ageDays < T.FINISH_RECENCY_DAYS) {
      recency = T.FINISH_RECENCY_BONUS * (1 - ageDays / T.FINISH_RECENCY_DAYS);
    }
  }
  const score = 0.5 * (game.percent / 100) + 0.3 * proximity + 0.2 * c.ease + recency;
  return entry(c, score, [
    { code: 'near', percent: game.percent },
    { code: 'remaining', count: remaining },
    ...rarestReason(c),
  ]);
}

function quickEntry(c: Candidate): RankedGame | null {
  const { game, remaining } = c;
  if (
    game.percent >= T.FINISH_MIN_PERCENT ||
    remaining > T.QUICK_MAX_REMAINING ||
    c.hoursMid > T.QUICK_MAX_HOURS ||
    c.ultraRareCount > 0
  ) return null;
  const score =
    0.6 * (1 - c.hoursMid / T.QUICK_MAX_HOURS) + 0.25 * (1 - remaining / T.QUICK_MAX_REMAINING) + 0.15 * c.ease;
  const reasons: ReasonCode[] = [
    { code: 'remaining', count: remaining },
    { code: 'short', hours: Math.max(0.5, roundHours(c.hoursMid)) },
  ];
  if (game.unlocked === 0) reasons.push({ code: 'notStarted' });
  return entry(c, score, reasons);
}

function grindEntry(c: Candidate): RankedGame | null {
  const { remaining } = c;
  if (remaining < T.GRIND_MIN_REMAINING || c.hoursMid < T.GRIND_MIN_HOURS) return null;
  const ultraShare = c.ultraRareCount / remaining;
  if (ultraShare > T.GRIND_MAX_ULTRA_SHARE) return null;
  const size =
    0.7 * (Math.min(c.hoursMid, T.GRIND_HOURS_CAP) / T.GRIND_HOURS_CAP) +
    0.3 * (Math.min(remaining, T.GRIND_REMAINING_CAP) / T.GRIND_REMAINING_CAP);
  return entry(c, size * (1 - ultraShare), [
    { code: 'remaining', count: remaining },
    { code: 'long', hours: roundHours(c.hoursMid) },
  ]);
}

function demandingEntry(c: Candidate): RankedGame | null {
  if (c.mass < T.DEMANDING_MIN_MASS) return null;
  const reasons: ReasonCode[] = [];
  if (c.ultraRareCount > 0) reasons.push({ code: 'ultraRare', count: c.ultraRareCount });
  reasons.push(...rarestReason(c), { code: 'remaining', count: c.remaining });
  return entry(c, c.mass, reasons);
}

function rank(
  candidates: Candidate[],
  build: (c: Candidate) => RankedGame | null,
  percentOf: Map<number, number>,
  limit: number,
): RankedGame[] {
  const entries: RankedGame[] = [];
  for (const c of candidates) {
    const built = build(c);
    if (built) entries.push(built);
  }
  entries.sort(
    (a, b) =>
      b.score - a.score ||
      (percentOf.get(b.gameId) ?? 0) - (percentOf.get(a.gameId) ?? 0) ||
      a.gameId - b.gameId,
  );
  return entries.slice(0, limit);
}

export function deriveRankings(
  games: RankingGameInput[],
  opts: { limit?: number; now?: number } = {},
): RankingList[] {
  const limit = Math.max(0, opts.limit ?? T.DEFAULT_LIMIT);
  const now = opts.now ?? Date.now();

  const valid = games.filter((g) => g.total > 0);
  const candidates = dedupeByGroup(valid)
    .filter((g) => !isCompleted(g))
    .map(toCandidate);
  const percentOf = new Map(candidates.map((c) => [c.game.gameId, c.game.percent]));

  const builders: Record<RankingListId, (c: Candidate) => RankedGame | null> = {
    finish: (c) => finishEntry(c, now),
    quick: quickEntry,
    grind: grindEntry,
    demanding: demandingEntry,
  };
  const order: RankingListId[] = ['finish', 'quick', 'grind', 'demanding'];
  return order.map((id) => ({
    id,
    ...LIST_META[id],
    entries: rank(candidates, builders[id], percentOf, limit),
  }));
}
