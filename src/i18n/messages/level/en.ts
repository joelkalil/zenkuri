import type { Shape } from '../../types';
import type { levelPtBR } from './pt-BR';

export const levelEn = {
  level: 'Level {level}',
  xp: '{xp} XP',
  caption: 'Level {level} · {tier} · {xp} XP',
  progressLabel: 'Progress to level {next}',
  chipLabel: 'Level {level}, {tier}. {percent}% to level {next}. See level details',
  chipTitle: '{percent}% to level {next} · {xp} XP',
  tiers: {
    alvorada: 'Dawn',
    aurora: 'Aurora',
    peregrino: 'Pilgrim',
    artesao: 'Artisan',
    veterano: 'Veteran',
    mestre: 'Master',
    sensei: 'Sensei',
    lenda: 'Legend',
  },
} satisfies Shape<typeof levelPtBR>;
