import type { Shape } from '../../types';
import type { shellPtBR } from './pt-BR';

export const shellEn = {
  skipLink: 'Skip to content',
  logo: {
    tagline: '全クリ — complete everything',
  },
  sync: {
    never: 'Never synced',
    syncing: 'Syncing…',
    failed: 'Sync failed',
    failedWithReason: 'Sync failed: {error}',
    syncedAgo: 'Synced {when}',
    syncNow: 'Sync now',
  },
  profile: {
    openMenu: 'Open profile menu',
    title: 'Profile',
    fallbackName: 'My profile',
    fallbackUsername: 'local',
    settings: 'Settings',
    connections: 'Connections',
    tutorials: 'Tutorials',
    appearance: 'Appearance',
    platforms: 'Platforms',
    connected: 'connected',
    notConfigured: 'not set up',
    recent: 'Recent',
    noRecent: 'No games played in the last 2 weeks.',
    logout: 'Log out',
  },
} satisfies Shape<typeof shellPtBR>;
