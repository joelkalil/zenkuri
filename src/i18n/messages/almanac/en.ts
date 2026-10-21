import type { Shape } from '../../types';
import type { almanacPtBR } from './pt-BR';

export const almanacEn = {
  backToHall: '‹ Hall',
  title: 'Almanac',
  description: 'A year of hunting in numbers: each square is a day, each stamp a completion.',
  yearLabel: 'Year',
  print: 'Print',
  summaryLabel: 'Summary of {year}',
  summary: {
    in: 'In',
    achievements: { one: 'achievement', other: 'achievements' },
    platinums: { one: 'platinum', other: 'platinums' },
    perfects: { one: 'game at 100%', other: 'games at 100%' },
    busiestDay: 'Busiest day:',
  },
  heatmap: {
    title: 'A year of unlocks',
    topMonth: 'Busiest month:',
  },
  completions: {
    title: 'Completions in {year}',
    inYear: '{count} this year',
    empty: 'No platinum or 100% recorded this year.',
  },
  kind: { platinum: 'Platinum', perfect: '100%' },
  rarest: {
    title: 'Rarest unlock',
    share: 'of players have this achievement',
  },
  byPlatform: 'By platform',
  errors: { load: 'Could not load the almanac' },
} satisfies Shape<typeof almanacPtBR>;
