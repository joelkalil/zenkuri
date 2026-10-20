export type Platform = 'steam' | 'retroachievements' | 'psn';

export interface StoredCredential {
  platform: Platform;
  data: Record<string, unknown>;
  updatedAt: string;
}

export interface ApiGame {
  id: number;
  appid: number;
  groupId: number;
  groupName: string;
  normalizedTitle: string;
  platform: Platform;
  platformGameId: string;
  name: string;
  coverUrl: string;
  portraitUrl: string;
  heroUrl: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url: string;
  has_community_visible_stats: boolean;
  completion: {
    percent: number;
    unlocked: number;
    total: number;
  };
  metadata?: Record<string, unknown>;
  relatedPlatforms: Platform[];
}

export interface ApiAchievement {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  icongray: string;
  hidden: number;
  achieved: boolean;
  unlocktime: number;
  points?: number;
  type?: string;
  /** % global de jogadores com a conquista (0–100), null quando a plataforma não informa */
  rarity?: number | null;
}

export interface PlanningRecord {
  backlog: string[];
  pinned: string[];
  dropped: string[];
  notes: Record<string, string>;
  effort: Record<string, string>;
  schedule: Record<string, string>;
  guides: Record<string, string>;
  /** coleções manuais (franquias/séries) do usuário */
  collections: { id: number; name: string }[];
  /** game_id -> id da coleção à qual o jogo pertence */
  collectionOf: Record<string, number>;
}

export interface CompletionHistoryItem {
  game: ApiGame;
  completedAt: number;
  kind: 'platinum' | 'perfect';
}
