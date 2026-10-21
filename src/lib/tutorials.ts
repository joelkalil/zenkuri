import type { ScopedStringKey } from '../i18n/types';
import type { Platform } from '../types/steam';

/*
 * Structure of the Tutorials page: which message keys, links and values each
 * tutorial renders. The copy itself lives in src/i18n/messages/tutorials/.
 * Env var names and URLs are facts, not copy, so they are not translated.
 */

type TutorialKey = ScopedStringKey<'tutorials'>;

export type TutorialScope = 'server' | 'user';

export interface TutorialLink {
  href: string;
  labelKey: TutorialKey;
}

export interface TutorialStep {
  key: TutorialKey;
  link?: TutorialLink;
}

export interface TutorialPart {
  titleKey: TutorialKey;
  scope: TutorialScope;
  steps: TutorialStep[];
}

export type TutorialTarget =
  | { kind: 'env'; name: string }
  | { kind: 'settings'; platform: Platform };

export interface TutorialValue {
  labelKey: TutorialKey;
  scope: TutorialScope;
  target: TutorialTarget;
}

export interface TutorialNote {
  key: TutorialKey;
  link?: TutorialLink;
}

export interface TutorialError {
  problemKey: TutorialKey;
  fixKey: TutorialKey;
}

export interface Tutorial {
  id: Platform;
  purposeKey: TutorialKey;
  parts: TutorialPart[];
  values: TutorialValue[];
  privacy: TutorialNote[];
  errors: TutorialError[];
}

export const TUTORIALS: Tutorial[] = [
  {
    id: 'steam',
    purposeKey: 'steam.purpose',
    parts: [
      {
        titleKey: 'steam.serverPart',
        scope: 'server',
        steps: [
          { key: 'steam.serverSteps.s1', link: { href: 'https://steamcommunity.com/dev/apikey', labelKey: 'steam.links.apiKey' } },
          { key: 'steam.serverSteps.s2' },
          { key: 'steam.serverSteps.s3' },
          { key: 'steam.serverSteps.s4' },
          { key: 'steam.serverSteps.s5' },
        ],
      },
      {
        titleKey: 'steam.userPart',
        scope: 'user',
        steps: [
          { key: 'steam.userSteps.u1', link: { href: 'https://steamcommunity.com/my/edit', labelKey: 'steam.links.editProfile' } },
          { key: 'steam.userSteps.u2' },
          { key: 'steam.userSteps.u3' },
        ],
      },
    ],
    values: [
      { labelKey: 'values.steamKey', scope: 'server', target: { kind: 'env', name: 'ZENKURI_STEAM_API_KEY' } },
      { labelKey: 'values.steamId', scope: 'user', target: { kind: 'settings', platform: 'steam' } },
    ],
    privacy: [
      { key: 'steam.privacy.p1' },
      { key: 'steam.privacy.p2', link: { href: 'https://steamcommunity.com/my/edit/settings', labelKey: 'steam.links.privacy' } },
      { key: 'steam.privacy.p3' },
    ],
    errors: [
      { problemKey: 'steam.errors.e1.problem', fixKey: 'steam.errors.e1.fix' },
      { problemKey: 'steam.errors.e2.problem', fixKey: 'steam.errors.e2.fix' },
      { problemKey: 'steam.errors.e3.problem', fixKey: 'steam.errors.e3.fix' },
      { problemKey: 'steam.errors.e4.problem', fixKey: 'steam.errors.e4.fix' },
    ],
  },
  {
    id: 'psn',
    purposeKey: 'psn.purpose',
    parts: [
      {
        titleKey: 'psn.serverPart',
        scope: 'server',
        steps: [
          { key: 'psn.serverSteps.s1', link: { href: 'https://www.playstation.com', labelKey: 'psn.links.site' } },
          { key: 'psn.serverSteps.s2', link: { href: 'https://ca.account.sony.com/api/v1/ssocookie', labelKey: 'psn.links.ssoCookie' } },
          { key: 'psn.serverSteps.s3' },
          { key: 'psn.serverSteps.s4' },
        ],
      },
      {
        titleKey: 'psn.userPart',
        scope: 'user',
        steps: [
          { key: 'psn.userSteps.u1' },
          { key: 'psn.userSteps.u2' },
        ],
      },
    ],
    values: [
      { labelKey: 'values.npsso', scope: 'server', target: { kind: 'env', name: 'ZENKURI_PSN_NPSSO' } },
      { labelKey: 'values.onlineId', scope: 'user', target: { kind: 'settings', platform: 'psn' } },
    ],
    privacy: [
      { key: 'psn.privacy.p1' },
      { key: 'psn.privacy.p2' },
      { key: 'psn.privacy.p3' },
    ],
    errors: [
      { problemKey: 'psn.errors.e1.problem', fixKey: 'psn.errors.e1.fix' },
      { problemKey: 'psn.errors.e2.problem', fixKey: 'psn.errors.e2.fix' },
      { problemKey: 'psn.errors.e3.problem', fixKey: 'psn.errors.e3.fix' },
      { problemKey: 'psn.errors.e4.problem', fixKey: 'psn.errors.e4.fix' },
    ],
  },
  {
    id: 'retroachievements',
    purposeKey: 'retroachievements.purpose',
    parts: [
      {
        titleKey: 'retroachievements.serverPart',
        scope: 'server',
        steps: [
          { key: 'retroachievements.serverSteps.s1', link: { href: 'https://retroachievements.org/settings', labelKey: 'retroachievements.links.settings' } },
          { key: 'retroachievements.serverSteps.s2' },
          { key: 'retroachievements.serverSteps.s3' },
          { key: 'retroachievements.serverSteps.s4' },
        ],
      },
      {
        titleKey: 'retroachievements.userPart',
        scope: 'user',
        steps: [
          { key: 'retroachievements.userSteps.u1' },
          { key: 'retroachievements.userSteps.u2' },
        ],
      },
    ],
    values: [
      { labelKey: 'values.raKey', scope: 'server', target: { kind: 'env', name: 'ZENKURI_RA_API_KEY' } },
      { labelKey: 'values.raServiceUser', scope: 'server', target: { kind: 'env', name: 'ZENKURI_RA_USERNAME' } },
      { labelKey: 'values.raUser', scope: 'user', target: { kind: 'settings', platform: 'retroachievements' } },
    ],
    privacy: [
      { key: 'retroachievements.privacy.p1' },
      { key: 'retroachievements.privacy.p2' },
    ],
    errors: [
      { problemKey: 'retroachievements.errors.e1.problem', fixKey: 'retroachievements.errors.e1.fix' },
      { problemKey: 'retroachievements.errors.e2.problem', fixKey: 'retroachievements.errors.e2.fix' },
      { problemKey: 'retroachievements.errors.e3.problem', fixKey: 'retroachievements.errors.e3.fix' },
    ],
  },
];
