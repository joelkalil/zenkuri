/*
  Community content: spaces and publications (sagas, rankings).
  Publications come from versioned JSON packs in `community/` (today) and, in the
  future, from a public database/bucket: the format below is the same in both cases.
*/

import type { Platform } from './steam';

export const PUBLICATION_KIND = {
  SAGA: 'saga',
  RANKING: 'ranking',
} as const;

export type PublicationKind = (typeof PUBLICATION_KIND)[keyof typeof PUBLICATION_KIND];

export const PUBLICATION_KINDS: readonly PublicationKind[] = [PUBLICATION_KIND.SAGA, PUBLICATION_KIND.RANKING];

export interface PublicationAuthor {
  handle: string;
  name: string;
}

// ─── Sagas ──────────────────────────────────────────────────────────────────

export type SagaFlag = 'online' | 'missable' | 'legacy';

export const SAGA_FLAGS: readonly SagaFlag[] = ['online', 'missable', 'legacy'];

/** 1 relaxed · 2 light · 3 medium · 4 demanding · 5 brutal */
export type SagaDifficulty = 1 | 2 | 3 | 4 | 5;

export const SAGA_DIFFICULTIES: readonly SagaDifficulty[] = [1, 2, 3, 4, 5];

export interface SagaEntry {
  /** Steam appid */
  appid: string;
  title: string;
  year: number;
  achievements: number;
  /** hour range for the whole list */
  hours: [number, number];
  difficulty: SagaDifficulty;
  /** full price in BRL on the saga's `priceCheckedAt` date; 0 = free; null = not for sale */
  priceBRL: number | null;
  note: string;
  flags?: SagaFlag[];
}

export interface SagaPhase {
  id: string;
  title: string;
  summary: string;
  entries: SagaEntry[];
}

export interface SagaOutOfScope {
  appid: string;
  title: string;
  reason: string;
}

/** Payload of a `saga` publication (the slug is the publication's). */
export interface SagaPayload {
  /** date (YYYY-MM-DD) on which prices were checked on Steam */
  priceCheckedAt: string;
  name: string;
  shortName: string;
  tagline: string;
  method: string;
  phases: SagaPhase[];
  outOfScope: SagaOutOfScope[];
}

export interface Saga extends SagaPayload {
  slug: string;
}

// ─── Rankings ───────────────────────────────────────────────────────────────

export interface RankingPayloadEntry {
  platform: Platform;
  externalId: string;
  /** the title travels in the pack: the reader may not own the game */
  title: string;
  note: string;
  estimate?: string;
}

export interface RankingPayload {
  entries: RankingPayloadEntry[];
}

// ─── Spaces and publications (API shape) ─────────────────────────────────

/** Language the pack content is written in. */
export type ContentLanguage = 'pt-BR' | 'en';

export interface CommunitySpace {
  slug: string;
  language: ContentLanguage;
  name: string;
  description: string;
  source: string;
  updatedAt: string;
  publicationCount: number;
}

export interface PublicationSummary {
  space: string;
  kind: PublicationKind;
  slug: string;
  language: ContentLanguage;
  title: string;
  summary: string;
  author: PublicationAuthor;
  version: number;
  publishedAt: string;
}

export interface PublicationMap {
  saga: SagaPayload;
  ranking: RankingPayload;
}

export interface Publication<K extends PublicationKind = PublicationKind> extends PublicationSummary {
  kind: K;
  source: string;
  /** pack path in the repository (or, in the future, a URL) */
  origin: string;
  contentHash: string;
  importedAt: string;
  payload: PublicationMap[K];
}
