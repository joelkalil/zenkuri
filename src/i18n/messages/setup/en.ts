import type { Shape } from '../../types';
import type { setupPtBR } from './pt-BR';

export const setupEn = {
  progressSuffix: 'of {total} connected',
  title: 'Welcome to Zenkuri',
  lede: 'Connect at least one platform to get started. Enter only the public identifier of your profile: no password, token or API key is needed.',
  recommended: 'Recommended',
  connected: 'Connected',
  skipped: 'Skipped',
  skip: 'Skip',
  connect: 'Connect',
  reconnect: 'Reconnect',
  help: 'Need help? See the tutorials',
  backToSetup: 'Back to setup',
  continue: 'Continue',
  platforms: {
    steam: {
      blurb: 'Import your Steam achievements.',
      inputLabel: 'SteamID64 or profile URL',
      placeholder: 'e.g. 76561198000000000 or steamcommunity.com/id/you',
    },
    psn: {
      blurb: 'Import your PlayStation Network trophies.',
      inputLabel: 'Online ID (PSN username)',
      placeholder: 'e.g. your_online_id',
    },
    retroachievements: {
      blurb: 'Import your retro achievements.',
      inputLabel: 'Username',
      placeholder: 'RetroAchievements username',
    },
  },
  dialog: {
    title: 'Connect {platform}',
    close: 'Close',
    publicOnly: 'We only read public profile data, never passwords or tokens.',
    submit: 'Link profile',
    busy: 'Looking up profile…',
  },
  errors: {
    identifierRequired: 'Enter your profile identifier.',
    linkFailed: 'Could not link the account.',
  },
} satisfies Shape<typeof setupPtBR>;
