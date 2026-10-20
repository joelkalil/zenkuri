/*
  Matemática pura do sistema de nível do Zenkuri.

  Sem I/O e sem dependência de `db.ts` — de propósito, seguindo o mesmo motivo de
  `mediaPaths.ts`: mantém o módulo testável isoladamente e evita ciclo de import.

  O XP é derivado exclusivamente do acervo de conquistas já desbloqueadas, então
  o cálculo é determinístico: a mesma coleção sempre produz o mesmo XP e um
  re-sync nunca faz o número regredir. Nada de XP por tempo de jogo ou por data.

  A régua favorece dificuldade sobre volume — raridade global multiplica o XP
  base, de forma que uma conquista de <1% dos jogadores vale mais que dezenas de
  conquistas triviais. Isso mantém a divisão de papéis com o Hall da Platina, que
  já celebra o volume de conclusões.
*/

import type { Platform } from './types';

// ─── Constantes da régua (ponto único de calibração) ────────────────────────

/** XP base por troféu da PSN, por tipo. */
const PSN_BASE_XP: Record<string, number> = {
  bronze: 15,
  silver: 30,
  gold: 90,
  platinum: 300,
};

/** Steam não expõe tipo nem pontuação: toda conquista vale o mesmo XP base. */
const STEAM_BASE_XP = 20;

/** RetroAchievements pontua de 1 a 100; o fator aproxima a escala das outras. */
const RA_POINTS_FACTOR = 1.5;
const RA_MAX_POINTS = 100;

/** Bônus por jogo concluído (platina da PSN ou 100% fora dela). */
export const COMPLETION_BONUS_XP = 500;

/**
 * Faixas de raridade global (% de jogadores que possuem a conquista).
 * Avaliadas em ordem: a primeira faixa cujo teto acomoda a raridade vence.
 */
export const RARITY_TIERS = [
  { key: 'mythic', label: 'Mítica', maxPercent: 1, multiplier: 4.0 },
  { key: 'ultra', label: 'Ultra rara', maxPercent: 5, multiplier: 2.6 },
  { key: 'rare', label: 'Rara', maxPercent: 10, multiplier: 2.0 },
  { key: 'uncommon', label: 'Incomum', maxPercent: 25, multiplier: 1.45 },
  { key: 'common', label: 'Comum', maxPercent: 50, multiplier: 1.15 },
  { key: 'trivial', label: 'Trivial', maxPercent: Infinity, multiplier: 1.0 },
] as const;

/** Conquistas sem raridade informada não são penalizadas nem premiadas. */
const UNKNOWN_RARITY_MULTIPLIER = 1.0;

/**
 * Curva: XP acumulado exigido para atingir `level` = BASE × (level - 1) ^ EXP.
 * Crescimento super-linear, sem teto — subir de nível fica progressivamente
 * mais caro, mas nunca impossível.
 */
export const CURVE_BASE_XP = 300;
export const CURVE_EXPONENT = 1.6;

/** Faixas de progressão. `minLevel` crescente; a última não tem teto. */
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

// ─── Matemática pura (sem I/O, testável isoladamente) ───────────────────────

/** Faixa de raridade de uma conquista; `null` quando a plataforma não informa. */
export function rarityTier(rarity: number | null) {
  if (rarity === null || !Number.isFinite(rarity)) return null;
  return RARITY_TIERS.find((tier) => rarity < tier.maxPercent) ?? RARITY_TIERS[RARITY_TIERS.length - 1];
}

export function rarityMultiplier(rarity: number | null): number {
  return rarityTier(rarity)?.multiplier ?? UNKNOWN_RARITY_MULTIPLIER;
}

/** XP base de uma conquista, antes do multiplicador de raridade. */
export function baseXp(input: { platform: Platform; type?: string | null; points?: number | null }): number {
  if (input.platform === 'psn') {
    return PSN_BASE_XP[String(input.type ?? '').toLowerCase()] ?? PSN_BASE_XP.bronze;
  }
  if (input.platform === 'steam') return STEAM_BASE_XP;

  const points = Number(input.points ?? 0);
  const clamped = Math.min(RA_MAX_POINTS, Math.max(1, Number.isFinite(points) ? points : 1));
  return clamped * RA_POINTS_FACTOR;
}

/** XP final de uma conquista desbloqueada. */
export function achievementXp(input: {
  platform: Platform;
  type?: string | null;
  points?: number | null;
  rarity: number | null;
}): number {
  return Math.round(baseXp(input) * rarityMultiplier(input.rarity));
}

/** XP acumulado necessário para alcançar um nível. Nível 1 custa zero. */
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
  /** XP já acumulado dentro do nível atual. */
  xpIntoLevel: number;
  /** XP que o nível atual exige para virar (0 quando o XP total é 0). */
  xpForNextLevel: number;
  /** 0–100, progresso dentro do nível atual. */
  progressPercent: number;
  tier: LevelTier;
  nextTier: LevelTier | null;
}

/** Converte XP total em nível + progresso dentro do nível. */
export function levelFromXp(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp));

  /*
    A inversa analítica dá o nível quase certo, mas `xpForLevel` arredonda os
    limiares — e sem esta correção os dois discordam justamente na virada, com a
    barra travando em 100% sem subir de nível. Os limiares arredondados são a
    fonte da verdade; o ajuste abaixo custa no máximo uma iteração.
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

/** Exposto para o script de calibração. */
export const LEVEL_CURVE = { CURVE_BASE_XP, CURVE_EXPONENT, LEVEL_TIERS };
