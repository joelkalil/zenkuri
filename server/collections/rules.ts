/*
  Regras das coleções automáticas
  ───────────────────────────────
  Tudo aqui é dado + normalização pura. As regras vivem em código (não no banco):
  mudar uma regra não exige refazer nenhuma consulta às lojas, porque
  `game_store_meta` guarda os nomes crus exatamente como o provedor devolveu.
*/

import { SAGAS } from '../../src/data/sagas';

export type CollectionKind = 'franchise' | 'company';

const CORPORATE_SUFFIX = /(?:^|[\s,])(?:co\.?,?\s*ltd\.?|ltd\.?|inc\.?|llc|gmbh|s\.a\.|corp\.?|corporation|k\.k\.)$/i;
const TRAILING_PARENTHETICAL = /\s*\([^()]*\)\s*$/;
const TRAILING_LEFTOVERS = /[\s,]+$/;

/** Remove ®™©, qualquer parêntese final (ex.: "(Mac/Linux)") e sufixos corporativos finais; preserva caixa e acentos. */
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
  // ®™© antes do NFKD: a decomposição de compatibilidade transforma ™ em "tm".
  return value
    .replace(/[®™©]/g, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase();
}

/** Chave canônica: só letras/dígitos, sem acentos, sufixos corporativos nem pontuação. */
export function normalizeKey(raw: string): string {
  const stripped = stripDecorations(foldText(raw));
  return stripped.replace(/[^\p{L}\p{N}]/gu, '');
}

/** Como normalizeKey, mas preserva fronteiras de palavra (espaço simples) para casar prefixos. */
function spacedKey(raw: string): string {
  return stripDecorations(foldText(raw)).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function keyedMap(entries: readonly (readonly [string, string])[]): ReadonlyMap<string, string> {
  return new Map(entries.map(([from, to]) => [normalizeKey(from), to]));
}

function keySet(names: readonly string[]): ReadonlySet<string> {
  return new Set(names.map(normalizeKey));
}

/** Nomes de exibição fixos (por chave). Aliases também definem o nome canônico. */
const COMPANY_DISPLAY_OVERRIDES = [
  'Square Enix', 'Capcom', 'Bandai Namco Entertainment', 'CD Projekt Red', 'FromSoftware',
  'SEGA', 'IO Interactive', 'Koei Tecmo', 'Spike Chunsoft', 'Level-5',
] as const;

const FRANCHISE_DISPLAY_OVERRIDES = [
  'Final Fantasy', 'Kingdom Hearts', 'The Witcher', 'NieR', 'Resident Evil',
  'Grand Theft Auto', 'The Elder Scrolls',
] as const;

/** Aplicados depois da normalização: chave de origem → nome canônico. */
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

/** Estúdios de port/remaster: o crédito é descartado. */
const COMPANY_BLOCKLIST = [
  'Feral Interactive', 'Aspyr', 'Nixxes', 'QLOC', 'Virtuos', 'Blind Squirrel',
  '1C-SoftClub',
] as const;

/** Páginas de loja de publisher que a Steam rotula como franquia. */
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

/** Bloqueio de empresa: chave exata ou começando com um nome bloqueado + espaço ("Aspyr Media"). */
function isCompanyBlocked(raw: string): boolean {
  if (companyBlocked.has(normalizeKey(raw))) return true;
  const spaced = spacedKey(raw);
  return companyBlockedSpaced.some((blocked) => spaced === blocked || spaced.startsWith(`${blocked} `));
}

export interface ResolvedName {
  key: string;
  /** Presente quando há override/alias; senão o display vem do spelling mais frequente. */
  display?: string;
  /** Spelling cru sem sufixos, usado para votar o nome de exibição. */
  spelling: string;
}

/** Resolve um nome cru (empresa ou franquia) para chave + display, ou null se bloqueado/vazio. */
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

/** Títulos que não contam para coleções (demos, trilhas, subsets de RA…). */
const EXCLUDED_TITLE = /\b(demo|playtest|test server|soundtrack|dedicated server|sdk)\b/i;

export function isExcludedTitle(title: string, platform: string): boolean {
  if (EXCLUDED_TITLE.test(title)) return true;
  return platform === 'retroachievements' && title.includes('[Subset');
}

interface TitleRule {
  franchise: string;
  /** Aplicado ao título sem ®™, sem acentos, em minúsculas. */
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

/** Franquias inferidas pelo título (nomes crus; passam por resolveName). */
export function franchisesFromTitle(title: string): string[] {
  const folded = foldText(title).trim();
  return TITLE_RULES.filter((rule) => rule.pattern.test(folded)).map((rule) => rule.franchise);
}

/** appid da Steam → nome da saga curada em src/data/sagas.ts. */
export const SAGA_FRANCHISE_BY_APPID: ReadonlyMap<string, string> = new Map(
  SAGAS.flatMap((saga) => [
    ...saga.phases.flatMap((phase) => phase.entries.map((entry) => [entry.appid, saga.name] as const)),
    ...saga.outOfScope.map((entry) => [entry.appid, saga.name] as const),
  ]),
);
