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
  /** % global de jogadores com a conquista (0–100), null quando a plataforma não informa */
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
  /** id do jogo (mesmo valor de Game.appid) */
  gameId: number;
  /** só em empresas: papel do estúdio no jogo */
  role?: AutoCollectionRole;
  source: 'store' | 'title';
}

/** Coleção derivada no servidor (franquia ou empresa); somente leitura. */
export interface AutoCollection {
  /** `franchise:<chave>` | `company:<chave>` */
  id: string;
  kind: AutoCollectionKind;
  name: string;
  members: AutoCollectionMember[];
  /** jogos distintos (Steam + PSN do mesmo jogo contam uma vez) */
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
  /** coleções manuais (franquias/séries) criadas pelo usuário */
  collections: GameCollection[];
  /** appid -> id da coleção à qual o jogo pertence */
  collectionOf: Record<string, number>;
}
