/*
  Contract of the automatic rankings engine. This file is importable by the
  frontend: it must not import node or server modules.
*/

export type RankingPlatform = 'steam' | 'psn' | 'retroachievements';

export type RankingListId = 'finish' | 'quick' | 'grind' | 'demanding';

export interface RankingGameInput {
  gameId: number;
  groupId: number | null;
  platform: RankingPlatform;
  externalId: string;
  title: string;
  playtimeMinutes: number;
  unlocked: number;
  total: number;
  percent: number;
  /** rarity (0–100, global % of players) of each LOCKED achievement; null when unknown */
  remainingRarities: Array<number | null>;
  /** epoch in milliseconds; optional */
  lastPlayedAt?: number | null;
}

export type ReasonCode =
  | { code: 'remaining'; count: number }
  | { code: 'rarest'; percent: number }
  | { code: 'near'; percent: number }
  | { code: 'long'; hours: number }
  | { code: 'short'; hours: number }
  | { code: 'ultraRare'; count: number }
  | { code: 'notStarted' };

export interface RankedGame {
  gameId: number;
  score: number;
  estimateHours: [number, number] | null;
  reasons: ReasonCode[];
}

export interface RankingList {
  id: RankingListId;
  label: string;
  shortLabel: string;
  description: string;
  entries: RankedGame[];
}

/*
 * Reasons are sent as codes and rendered on the client, in the active locale:
 * see src/i18n/messages/rankings/formatReason.ts.
 */
