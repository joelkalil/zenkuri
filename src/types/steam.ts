export interface Game {
  id: number;
  appid: number;
  groupId?: number;
  groupName?: string;
  normalizedTitle?: string;
  platform?: Platform;
  platformGameId?: string;
  name: string;
  playtime_forever: number; // minutes
  playtime_2weeks?: number; // minutes
  img_icon_url: string;
  coverUrl?: string;
  portraitUrl?: string;
  heroUrl?: string;
  has_community_visible_stats?: boolean;
  metadata?: Record<string, unknown>;
  completion?: {
    percent: number;
    unlocked: number;
    total: number;
  };
  relatedPlatforms?: Platform[];
}

export interface SchemaAchievement {
  name: string; // apiname
  displayName: string;
  description: string;
  icon: string;
  icongray: string;
  hidden: number;
}

export interface PlayerAchievement {
  apiname: string;
  achieved: number; // 0 or 1
  unlocktime: number; // unix timestamp
}

export interface AchievementWithStatus extends SchemaAchievement {
  achieved: boolean;
  unlocktime: number;
  points?: number;
  type?: string;
  /** global % of players who have the achievement (0–100), null when the platform does not report it */
  rarity?: number | null;
}

export interface UnlockItem {
  unlockTime: number;
  platform: Platform;
  gameId: number;
  gameName: string;
  achievementTitle: string;
  type: string | null;
  rarity: number | null;
  icon: string;
}

export type EffortLevel = 'easy' | 'medium' | 'hard' | 'grind';
export type Platform = 'steam' | 'retroachievements' | 'psn';

export interface GameCollection {
  id: number;
  name: string;
}

export type AutoCollectionKind = 'franchise' | 'company';
export type AutoCollectionRole = 'dev' | 'pub' | 'both';

export interface AutoCollectionMember {
  /** game id (same value as Game.appid) */
  gameId: number;
  /** companies only: the studio's role in the game */
  role?: AutoCollectionRole;
  source: 'store' | 'title';
}

/** Collection derived on the server (franchise or company); read-only. */
export interface AutoCollection {
  /** `franchise:<key>` | `company:<key>` */
  id: string;
  kind: AutoCollectionKind;
  name: string;
  members: AutoCollectionMember[];
  /** distinct games (the same game on Steam + PSN counts once) */
  groupCount: number;
}

export interface AutoCollections {
  franchises: AutoCollection[];
  companies: AutoCollection[];
}

export interface PatinaDb {
  backlog: string[];
  pinned: string[];
  dropped: string[];
  notes: Record<string, string>;
  effort: Record<string, EffortLevel>;
  schedule: Record<string, string>; // appid -> "YYYY-MM"
  guides: Record<string, string>;
  /** manual collections (franchises/series) created by the user */
  collections: GameCollection[];
  /** appid -> id of the collection the game belongs to */
  collectionOf: Record<string, number>;
}
