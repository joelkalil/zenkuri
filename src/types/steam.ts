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
}

export type EffortLevel = 'easy' | 'medium' | 'hard' | 'grind';
export type Platform = 'steam' | 'retroachievements' | 'psn';

export interface PatinaDb {
  backlog: string[];
  pinned: string[];
  dropped: string[];
  notes: Record<string, string>;
  effort: Record<string, EffortLevel>;
  schedule: Record<string, string>; // appid -> "YYYY-MM"
  guides: Record<string, string>;
}
