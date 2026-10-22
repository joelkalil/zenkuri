import type { Locale } from '../locales';
import type { Shape } from '../types';
import { authEn } from './auth/en';
import { authPtBR } from './auth/pt-BR';
import { commonEn } from './common/en';
import { commonPtBR } from './common/pt-BR';
import { levelEn } from './level/en';
import { levelPtBR } from './level/pt-BR';
import { navEn } from './nav/en';
import { navPtBR } from './nav/pt-BR';
import { rankingsEn } from './rankings/en';
import { rankingsPtBR } from './rankings/pt-BR';
import { settingsEn } from './settings/en';
import { settingsPtBR } from './settings/pt-BR';
import { setupEn } from './setup/en';
import { setupPtBR } from './setup/pt-BR';
import { shellEn } from './shell/en';
import { shellPtBR } from './shell/pt-BR';
import { tutorialsEn } from './tutorials/en';
import { tutorialsPtBR } from './tutorials/pt-BR';
import { libraryEn } from './library/en';
import { libraryPtBR } from './library/pt-BR';
import { gameEn } from './game/en';
import { gamePtBR } from './game/pt-BR';
import { collectionsEn } from './collections/en';
import { collectionsPtBR } from './collections/pt-BR';
import { planEn } from './plan/en';
import { planPtBR } from './plan/pt-BR';
import { dashboardEn } from './dashboard/en';
import { dashboardPtBR } from './dashboard/pt-BR';
import { hallEn } from './hall/en';
import { hallPtBR } from './hall/pt-BR';
import { almanacEn } from './almanac/en';
import { almanacPtBR } from './almanac/pt-BR';
import { communityEn } from './community/en';
import { communityPtBR } from './community/pt-BR';
import { sagaEn } from './saga/en';
import { sagaPtBR } from './saga/pt-BR';
import { updateEn } from './update/en';
import { updatePtBR } from './update/pt-BR';
import { errorsEn } from './errors/en';
import { errorsPtBR } from './errors/pt-BR';

/*
 * Area registry: one import pair and one entry per locale for each area.
 * Keep one area per line so parallel branches rarely conflict.
 * The pt-BR object is the source of truth for the key types.
 */
const PT_BR = {
  auth: authPtBR,
  common: commonPtBR,
  level: levelPtBR,
  nav: navPtBR,
  rankings: rankingsPtBR,
  settings: settingsPtBR,
  setup: setupPtBR,
  shell: shellPtBR,
  tutorials: tutorialsPtBR,
  library: libraryPtBR,
  game: gamePtBR,
  collections: collectionsPtBR,
  plan: planPtBR,
  dashboard: dashboardPtBR,
  hall: hallPtBR,
  almanac: almanacPtBR,
  community: communityPtBR,
  saga: sagaPtBR,
  errors: errorsPtBR,
  update: updatePtBR,
};

export type Messages = typeof PT_BR;

const EN: Shape<Messages> = {
  auth: authEn,
  common: commonEn,
  level: levelEn,
  nav: navEn,
  rankings: rankingsEn,
  settings: settingsEn,
  setup: setupEn,
  shell: shellEn,
  tutorials: tutorialsEn,
  library: libraryEn,
  game: gameEn,
  collections: collectionsEn,
  plan: planEn,
  dashboard: dashboardEn,
  hall: hallEn,
  almanac: almanacEn,
  community: communityEn,
  saga: sagaEn,
  errors: errorsEn,
  update: updateEn,
};

export const MESSAGES: Record<Locale, Shape<Messages>> = {
  'pt-BR': PT_BR,
  en: EN,
};
