export interface Game {
  appid: number;
  name: string;
  playtime_forever: number; // minutes
  playtime_2weeks?: number; // minutes
  img_icon_url: string;
  has_community_visible_stats?: boolean;
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
}

export type EffortLevel = 'easy' | 'medium' | 'hard' | 'grind';

export interface PatinaDb {
  backlog: string[];
  pinned: string[];
  notes: Record<string, string>;
  effort: Record<string, EffortLevel>;
  schedule: Record<string, string>; // appid -> "YYYY-MM"
}
