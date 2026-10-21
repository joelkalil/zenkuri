/*
  Languages a community pack can be authored in (BCP-47 subset). No imports, so
  the frontend can reuse the type and the list later. A pack is written in a
  single language; only these two are allowed for now.
*/

export const PACK_LANGUAGES = ['pt-BR', 'en'] as const;

export type PackLanguage = (typeof PACK_LANGUAGES)[number];

/** Language assumed for content that predates the field (existing rows and packs). */
export const DEFAULT_PACK_LANGUAGE: PackLanguage = 'pt-BR';
