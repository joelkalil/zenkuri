import type { Shape } from '../../types';
import type { sagaPtBR } from './pt-BR';

export const sagaEn = {
  chooseSaga: 'Choose a saga',
  eyebrow: { one: 'Saga · {count} game', other: 'Saga · {count} games' },
  priceChecked: 'prices checked on {date}',
  summary: {
    platinated: '{done} of {total} platinumed · {owned} in the library',
    inProgress: '({count} in progress)',
    remaining: '~{hours} left',
    cost: '{cost} to complete the collection ({games}, full price on {date})',
    missingGames: { one: '{count} game', other: '{count} games' },
  },
  hours: { single: '{hours} h', range: '{min}–{max} h' },
  continue: 'Continue: {title}',
  upNext: 'Next: {title}',
  progressLabel: 'Saga platinums',
  method: 'How the order was built',
  queue: {
    next: 'Next in line: {entry}.',
    nextMissing: 'Next in line: {entry}, not on your account yet.',
  },
  phase: {
    title: 'Phase {number}: {title}',
    progress: 'Phase {number} progress',
  },
  entry: {
    next: 'Next',
    achievements: { one: 'achievement', other: 'achievements' },
    progress: 'Progress of {title}',
    owned: 'In library',
    inProgress: 'In progress',
    notOwned: 'Not owned',
    viewOnSteam: 'View on Steam',
  },
  price: { delisted: 'Not for sale', free: 'Free' },
  difficulty: {
    title: 'Platinum difficulty: {label}',
    text: 'Difficulty: {label}',
    levels: { calm: 'relaxed', light: 'light', medium: 'medium', demanding: 'demanding', brutal: 'brutal' },
  },
  flags: {
    online: 'Needs online',
    missable: 'Has missables',
    legacy: 'Delisted',
  },
  outOfScope: {
    title: 'On Steam, outside your account',
    subtitle: 'They exist on the store, but today they cannot be platinumed.',
  },
  error: { title: 'Could not load the sagas', retry: 'Try again' },
  empty: {
    title: 'No sagas published',
    body: 'Sagas come from the packs in `community/`, in the repository.',
    link: 'See the community',
  },
  errors: { load: 'Could not load the sagas' },
} satisfies Shape<typeof sagaPtBR>;
