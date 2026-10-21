import type { Shape } from '../../types';
import type { navPtBR } from './pt-BR';

export const navEn = {
  groups: {
    today: 'Today',
    library: 'Library',
    achievements: 'Achievements',
    community: 'Community',
  },
  short: {
    today: 'Today',
    library: 'Library',
    achievements: 'Trophies',
    community: 'Community',
    profile: 'Profile',
  },
  items: {
    today: 'Today',
    plan: 'Plan',
    games: 'Games',
    collections: 'Collections',
    hall: 'Hall',
    rankings: 'Rankings',
    almanac: 'Almanac',
    community: 'Community',
    sagas: 'Sagas',
  },
  aria: {
    main: 'Main navigation',
    section: 'Section',
    home: 'Zenkuri — Today',
  },
} satisfies Shape<typeof navPtBR>;
