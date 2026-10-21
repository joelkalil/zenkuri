/*
  Automatic collection rules
  ──────────────────────────
  Everything here is data + pure normalization. The rules live in code (not in
  the database): changing a rule does not require redoing any store query,
  because `game_store_meta` keeps the raw names exactly as the provider returned them.
*/

import type { SagaPayload } from '../../src/types/community';

export type CollectionKind = 'franchise' | 'company';

const CORPORATE_SUFFIX = /(?:^|[\s,])(?:co\.?,?\s*ltd\.?|ltd\.?|inc\.?|llc|gmbh|s\.a\.|corp\.?|corporation|k\.k\.)$/i;
const TRAILING_PARENTHETICAL = /\s*\([^()]*\)\s*$/;
const TRAILING_LEFTOVERS = /[\s,]+$/;

/** Removes ®™©, any trailing parenthetical (e.g. "(Mac/Linux)") and trailing corporate suffixes; preserves case and accents. */
export function stripDecorations(raw: string): string {
  let value = raw.replace(/[®™©]/g, '').trim();
  for (let guard = 0; guard < 8; guard += 1) {
    const next = value
      .replace(TRAILING_PARENTHETICAL, '')
      .replace(CORPORATE_SUFFIX, '')
      .replace(TRAILING_LEFTOVERS, '')
      .trim();
    if (next === value || next === '') break;
    value = next;
  }
  return value;
}

function foldText(value: string): string {
  // ®™© before NFKD: the compatibility decomposition turns ™ into "tm".
  return value
    .replace(/[®™©]/g, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase();
}

/** Canonical key: letters/digits only, no accents, corporate suffixes or punctuation. */
export function normalizeKey(raw: string): string {
  const stripped = stripDecorations(foldText(raw));
  return stripped.replace(/[^\p{L}\p{N}]/gu, '');
}

/** Like normalizeKey, but keeps word boundaries (single space) to match prefixes. */
function spacedKey(raw: string): string {
  return stripDecorations(foldText(raw)).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function keyedMap(entries: readonly (readonly [string, string])[]): ReadonlyMap<string, string> {
  return new Map(entries.map(([from, to]) => [normalizeKey(from), to]));
}

function keySet(names: readonly string[]): ReadonlySet<string> {
  return new Set(names.map(normalizeKey));
}

/** Fixed display names (by key). Aliases also define the canonical name. */
const COMPANY_DISPLAY_OVERRIDES = [
  'Square Enix', 'Capcom', 'Bandai Namco Entertainment', 'CD Projekt Red', 'FromSoftware',
  'SEGA', 'IO Interactive', 'Koei Tecmo', 'Spike Chunsoft', 'Level-5',
] as const;

const FRANCHISE_DISPLAY_OVERRIDES = [
  'Final Fantasy', 'Kingdom Hearts', 'The Witcher', 'NieR', 'Resident Evil',
  'Grand Theft Auto', 'The Elder Scrolls',
] as const;

/** Applied after normalization: source key → canonical name. */
const COMPANY_ALIASES = [
  ['2K Australia', '2K'], ['2K Boston', '2K'], ['2K Marin', '2K'],
  ['2K China', '2K'], ['2K Games', '2K'], ['2K Czech', '2K'],
  ['Gearbox Publishing', 'Gearbox Software'],
  ['Warner Bros. Interactive Entertainment', 'Warner Bros. Games'],
  ['Koei Tecmo Games', 'Koei Tecmo'],
  ['Level5', 'Level-5'],
] as const;

const FRANCHISE_ALIASES = [
  ['Monster Camp', 'Monster Prom'], ['Monster Roadtrip', 'Monster Prom'], ['Monster Con', 'Monster Prom'],
  ['Hellblade Franchise', 'Hellblade'], ["Hellblade: Senua's Sacrifice", 'Hellblade'],
  ['Skyrim', 'The Elder Scrolls'],
  ['Black Ops', 'Call of Duty'], ['Modern Warfare', 'Call of Duty'],
  ['THE WITCHER®', 'The Witcher'],
  ['NIER', 'NieR'],
] as const;

/** Port/remaster studios: the credit is discarded. */
const COMPANY_BLOCKLIST = [
  'Feral Interactive', 'Aspyr', 'Nixxes', 'QLOC', 'Virtuos', 'Blind Squirrel',
  '1C-SoftClub',
] as const;

/** Publisher store pages that Steam labels as a franchise. */
const FRANCHISE_BLOCKLIST = [
  'EA Play', 'EA Originals', 'EA Sports', 'PlayStation Studios', 'PlayStation Publishing LLC',
  'WB Games', '505 Games Official', 'FRANCHISE', 'Arc Games', 'Raw Fury Games',
  'Team17 Digital', 'Thunderful Publishing', 'Landfall',
] as const;

const companyOverrides = keyedMap([
  ...COMPANY_DISPLAY_OVERRIDES.map((name) => [name, name] as const),
  ...COMPANY_ALIASES.map(([, to]) => [to, to] as const),
]);
const franchiseOverrides = keyedMap([
  ...FRANCHISE_DISPLAY_OVERRIDES.map((name) => [name, name] as const),
  ...FRANCHISE_ALIASES.map(([, to]) => [to, to] as const),
]);
const companyAliases = keyedMap(COMPANY_ALIASES);
const franchiseAliases = keyedMap(FRANCHISE_ALIASES);
const companyBlocked = keySet(COMPANY_BLOCKLIST);
const companyBlockedSpaced = COMPANY_BLOCKLIST.map(spacedKey);
const franchiseBlocked = keySet(FRANCHISE_BLOCKLIST);

/** Company blocking: exact key or starting with a blocked name + space ("Aspyr Media"). */
function isCompanyBlocked(raw: string): boolean {
  if (companyBlocked.has(normalizeKey(raw))) return true;
  const spaced = spacedKey(raw);
  return companyBlockedSpaced.some((blocked) => spaced === blocked || spaced.startsWith(`${blocked} `));
}

export interface ResolvedName {
  key: string;
  /** Present when there is an override/alias; otherwise the display comes from the most frequent spelling. */
  display?: string;
  /** Raw spelling without suffixes, used to vote on the display name. */
  spelling: string;
}

/** Resolves a raw name (company or franchise) to key + display, or null if blocked/empty. */
export function resolveName(kind: CollectionKind, raw: string): ResolvedName | null {
  const sourceKey = normalizeKey(raw);
  if (sourceKey === '') return null;
  const blocked = kind === 'company' ? companyBlocked : franchiseBlocked;
  if (kind === 'company' ? isCompanyBlocked(raw) : blocked.has(sourceKey)) return null;

  const aliases = kind === 'company' ? companyAliases : franchiseAliases;
  const overrides = kind === 'company' ? companyOverrides : franchiseOverrides;
  const canonical = aliases.get(sourceKey);
  const key = canonical ? normalizeKey(canonical) : sourceKey;
  if (blocked.has(key)) return null;
  return {
    key,
    display: canonical ?? overrides.get(key),
    spelling: stripDecorations(raw),
  };
}

/** Titles that do not count toward collections (demos, soundtracks, RA subsets…). */
const EXCLUDED_TITLE = /\b(demo|playtest|test server|soundtrack|dedicated server|sdk)\b/i;

export function isExcludedTitle(title: string, platform: string): boolean {
  if (EXCLUDED_TITLE.test(title)) return true;
  return platform === 'retroachievements' && title.includes('[Subset');
}

interface TitleRule {
  franchise: string;
  /** Applied to the title without ®™, without accents, lowercased. */
  pattern: RegExp;
}

const prefix = (franchise: string, pattern: RegExp): TitleRule => ({ franchise, pattern });

export const TITLE_RULES: readonly TitleRule[] = [
  prefix('Final Fantasy', /^final fantasy\b/),
  prefix('Resident Evil', /^(?:resident evil|biohazard)\b/),
  prefix('Kingdom Hearts', /^kingdom hearts\b/),
  prefix('God of War', /^god of war\b/),
  prefix('Divinity', /^(?:divine divinity|beyond divinity|divinity)\b/),
  prefix('Left 4 Dead', /^left 4 dead\b/),
  prefix('Alan Wake', /^alan wake\b/),
  prefix('Ni no Kuni', /^ni no kuni\b/),
  prefix('Elden Ring', /^elden ring\b/),
  prefix('Chrono', /^chrono (?:trigger|cross)\b/),
  prefix('Middle-earth', /^middle[- ]earth\b/),
  prefix('Monster Prom', /^monster prom\b/),
  prefix('Five Hearts Under One Roof', /^five hearts under one roof\b/),
  prefix('The Witcher', /^the witcher\b/),
  prefix('Ghost of Tsushima', /^ghost of (?:tsushima|yotei)\b/),
  prefix('Dark Souls', /^dark souls\b/),
  prefix('Borderlands', /^borderlands\b/),
  prefix('BioShock', /^bioshock\b/),
  prefix('Darksiders', /^darksiders\b/),
  prefix("Assassin's Creed", /^assassin'?s creed\b/),
  prefix('Devil May Cry', /^devil may cry\b/),
  prefix('Tomb Raider', /^(?:(?:rise|shadow) of the )?tomb raider\b/),
  prefix('Fallout', /^fallout\b/),
  prefix('The Elder Scrolls', /^the elder scrolls\b/),
  prefix('Hollow Knight', /^hollow knight\b/),
  prefix('Ori', /^ori and the\b/),
  prefix('Star Wars', /^star wars\b/),
  prefix('Call of Duty', /^call of duty\b/),
  prefix('Grand Theft Auto', /^grand theft auto\b/),
  prefix('Hitman', /^hitman\b/),
  prefix('Portal', /^portal(?:\s*[:\d]|\s+with rtx|\s+reloaded|\s+stories|$)/),
  prefix('Half-Life', /^half[- ]life\b/),
  prefix('Pokémon', /^pokemon\b/),
];

/** Franchises inferred from the title (raw names; they go through resolveName). */
export function franchisesFromTitle(title: string): string[] {
  const folded = foldText(title).trim();
  return TITLE_RULES.filter((rule) => rule.pattern.test(folded)).map((rule) => rule.franchise);
}

/** A published saga reduced to what seeds collections: franchise name + Steam appids. */
export interface SagaSeed {
  name: string;
  appids: readonly string[];
}

export function sagaSeedOf(saga: Pick<SagaPayload, 'name' | 'phases' | 'outOfScope'>): SagaSeed {
  return {
    name: saga.name,
    appids: [
      ...saga.phases.flatMap((phase) => phase.entries.map((entry) => entry.appid)),
      ...saga.outOfScope.map((entry) => entry.appid),
    ],
  };
}

/** Steam appid → name of the saga published in the community. */
export function indexSagaSeeds(seeds: readonly SagaSeed[]): ReadonlyMap<string, string> {
  return new Map(seeds.flatMap((seed) => seed.appids.map((appid) => [appid, seed.name] as const)));
}
