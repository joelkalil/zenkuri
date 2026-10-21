/*
  Validators for the community packs (community/<space>/...).
  Hand-written, dependency-free: each error names the file and the field.
*/

import type {
  PublicationAuthor,
  PublicationKind,
  RankingPayload,
  SagaEntry,
  SagaOutOfScope,
  SagaPayload,
  SagaPhase,
} from '../../src/types/community';
import { PUBLICATION_KINDS, SAGA_DIFFICULTIES, SAGA_FLAGS, type SagaFlag } from '../../src/types/community';
import type { Platform } from '../../src/types/steam';
import { PACK_LANGUAGES, type PackLanguage } from './language';
import {
  Issues,
  SLUG,
  joinPath,
  readArray,
  readDate,
  readEnum,
  readNumber,
  readObject,
  readRecord,
  readString,
  rejectUnknownKeys,
  describe,
  type JsonRecord,
  type Result,
} from '../validation';

export { PACK_LANGUAGES, type PackLanguage } from './language';

export const SPACE_SCHEMA = 'zenkuri.space/v1';
export const PUBLICATION_SCHEMA = 'zenkuri.publication/v1';

const PLATFORM_VALUES: readonly Platform[] = ['steam', 'retroachievements', 'psn'];
const HANDLE = /^[a-z0-9][a-z0-9_.-]{1,31}$/i;
const SLUG_HINT = 'expected a lowercase slug (a-z, 0-9 and "-")';

export interface SpacePack {
  slug: string;
  language: PackLanguage;
  name: string;
  description: string;
}

interface PublicationBase {
  slug: string;
  language: PackLanguage;
  title: string;
  summary: string;
  author: PublicationAuthor;
  version: number;
  publishedAt: string;
}

export interface SagaPublicationPack extends PublicationBase {
  kind: 'saga';
  payload: SagaPayload;
}

export interface RankingPublicationPack extends PublicationBase {
  kind: 'ranking';
  payload: RankingPayload;
}

export type PublicationPack = SagaPublicationPack | RankingPublicationPack;

export function validateSpace(file: string, raw: unknown): Result<SpacePack> {
  const issues = new Issues(file);
  const obj = readRecord(issues, raw, '');
  const schema = readString(issues, obj, 'schema', '');
  if (schema !== '' && schema !== SPACE_SCHEMA) issues.add('schema', 'invalid_value', `expected "${SPACE_SCHEMA}", got "${schema}"`);
  rejectUnknownKeys(issues, obj, '', ['schema', 'language', 'slug', 'name', 'description']);
  return issues.result({
    language: readEnum(issues, obj, 'language', '', PACK_LANGUAGES, 'pt-BR'),
    slug: readString(issues, obj, 'slug', '', { min: 1, max: 40, pattern: SLUG, patternHint: SLUG_HINT }),
    name: readString(issues, obj, 'name', '', { min: 1, max: 80 }),
    description: readString(issues, obj, 'description', '', { max: 500 }),
  });
}

function readAuthor(issues: Issues, obj: JsonRecord): PublicationAuthor {
  const author = readObject(issues, obj, 'author', '');
  return {
    handle: readString(issues, author, 'handle', 'author', { min: 2, max: 32, pattern: HANDLE, patternHint: 'invalid handle (letters, numbers, ".", "_" or "-")' }),
    name: readString(issues, author, 'name', 'author', { min: 1, max: 80 }),
  };
}

function readStringFlags(issues: Issues, obj: JsonRecord, path: string): SagaFlag[] | undefined {
  if (obj.flags === undefined) return undefined;
  return readArray(issues, obj, 'flags', path, (item, itemPath): SagaFlag => {
    const match = SAGA_FLAGS.find((flag) => flag === item);
    if (match) return match;
    issues.add(itemPath, 'invalid_value', `invalid flag ${JSON.stringify(item)} (expected one of: ${SAGA_FLAGS.join(', ')})`);
    return 'online';
  });
}

function readHoursRange(issues: Issues, obj: JsonRecord, path: string): [number, number] {
  const at = joinPath(path, 'hours');
  const value = obj.hours;
  if (!Array.isArray(value) || value.length !== 2) {
    issues.add(at, 'invalid_type', Array.isArray(value) ? `expected [min, max], got ${value.length} items` : `expected [min, max], got ${describe(value)}`);
    return [0, 0];
  }
  const range: [number, number] = [0, 0];
  for (const index of [0, 1] as const) {
    const item = value[index];
    if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) {
      issues.add(joinPath(at, index), 'invalid_range', `expected a number >= 0, got ${JSON.stringify(item)}`);
    } else {
      range[index] = item;
    }
  }
  if (range[1] < range[0]) issues.add(at, 'invalid_range', `max (${range[1]}) is less than min (${range[0]})`);
  return range;
}

function readSagaEntry(issues: Issues, value: unknown, path: string): SagaEntry {
  const obj = readRecord(issues, value, path);
  const difficulty = SAGA_DIFFICULTIES.find((candidate) => candidate === obj.difficulty);
  if (difficulty === undefined) {
    issues.add(joinPath(path, 'difficulty'), 'invalid_value', `expected ${SAGA_DIFFICULTIES.join('|')}, got ${JSON.stringify(obj.difficulty)}`);
  }
  let priceBRL: number | null = null;
  if (obj.priceBRL !== null) priceBRL = readNumber(issues, obj, 'priceBRL', path, { min: 0 });
  const flags = readStringFlags(issues, obj, path);
  return {
    appid: readString(issues, obj, 'appid', path, { min: 1, pattern: /^\d+$/, patternHint: 'expected a numeric appid (string)' }),
    title: readString(issues, obj, 'title', path, { min: 1 }),
    year: readNumber(issues, obj, 'year', path, { min: 1970, max: 2100, integer: true }),
    achievements: readNumber(issues, obj, 'achievements', path, { min: 0, integer: true }),
    hours: readHoursRange(issues, obj, path),
    difficulty: difficulty ?? 1,
    priceBRL,
    note: readString(issues, obj, 'note', path),
    ...(flags ? { flags } : {}),
  };
}

function readSagaPhase(issues: Issues, value: unknown, path: string): SagaPhase {
  const obj = readRecord(issues, value, path);
  return {
    id: readString(issues, obj, 'id', path, { min: 1 }),
    title: readString(issues, obj, 'title', path, { min: 1 }),
    summary: readString(issues, obj, 'summary', path),
    entries: readArray(issues, obj, 'entries', path, (item, itemPath) => readSagaEntry(issues, item, itemPath)),
  };
}

function readOutOfScope(issues: Issues, value: unknown, path: string): SagaOutOfScope {
  const obj = readRecord(issues, value, path);
  return {
    appid: readString(issues, obj, 'appid', path, { min: 1, pattern: /^\d+$/, patternHint: 'expected a numeric appid (string)' }),
    title: readString(issues, obj, 'title', path, { min: 1 }),
    reason: readString(issues, obj, 'reason', path),
  };
}

function checkDuplicateAppids(issues: Issues, payload: SagaPayload) {
  const seen = new Map<string, string>();
  payload.phases.forEach((phase, phaseIndex) => {
    phase.entries.forEach((entry, entryIndex) => {
      const at = `payload.phases[${phaseIndex}].entries[${entryIndex}].appid`;
      const first = seen.get(entry.appid);
      if (first) issues.add(at, 'duplicate', `appid ${entry.appid} is repeated (already at ${first})`);
      else seen.set(entry.appid, at);
    });
  });
}

export function readSagaPayload(issues: Issues, value: unknown, path: string): SagaPayload {
  const obj = readRecord(issues, value, path);
  const payload: SagaPayload = {
    priceCheckedAt: readDate(issues, obj, 'priceCheckedAt', path),
    name: readString(issues, obj, 'name', path, { min: 1 }),
    shortName: readString(issues, obj, 'shortName', path, { min: 1 }),
    tagline: readString(issues, obj, 'tagline', path),
    method: readString(issues, obj, 'method', path),
    phases: readArray(issues, obj, 'phases', path, (item, itemPath) => readSagaPhase(issues, item, itemPath)),
    outOfScope: readArray(issues, obj, 'outOfScope', path, (item, itemPath) => readOutOfScope(issues, item, itemPath)),
  };
  if (payload.phases.length === 0 && Array.isArray(obj.phases)) issues.add(joinPath(path, 'phases'), 'empty', 'needs at least one phase');
  checkDuplicateAppids(issues, payload);
  return payload;
}

export function readRankingPayload(issues: Issues, value: unknown, path: string): RankingPayload {
  const obj = readRecord(issues, value, path);
  const entries = readArray(issues, obj, 'entries', path, (item, itemPath) => {
    const entry = readRecord(issues, item, itemPath);
    const result: RankingPayload['entries'][number] = {
      platform: readEnum(issues, entry, 'platform', itemPath, PLATFORM_VALUES, 'steam'),
      externalId: readString(issues, entry, 'externalId', itemPath, { min: 1 }),
      title: readString(issues, entry, 'title', itemPath, { min: 1 }),
      note: readString(issues, entry, 'note', itemPath),
    };
    if (entry.estimate !== undefined) result.estimate = readString(issues, entry, 'estimate', itemPath);
    return result;
  });
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    const key = `${entry.platform}:${entry.externalId}`;
    if (seen.has(key)) issues.add(`${joinPath(path, 'entries')}[${index}]`, 'duplicate', `game ${key} is repeated`);
    seen.add(key);
  });
  return { entries };
}

/** Validates only a saga payload (used when reading from the database). */
export function validateSagaPayload(source: string, raw: unknown): Result<SagaPayload> {
  const issues = new Issues(source);
  return issues.result(readSagaPayload(issues, raw, ''));
}

/** Validates a publication; `expected` ties kind/slug to the directory and the file name. */
export function validatePublication(
  file: string,
  raw: unknown,
  expected?: { kind: PublicationKind; slug: string },
): Result<PublicationPack> {
  const issues = new Issues(file);
  const obj = readRecord(issues, raw, '');
  const schema = readString(issues, obj, 'schema', '');
  if (schema !== '' && schema !== PUBLICATION_SCHEMA) issues.add('schema', 'invalid_value', `expected "${PUBLICATION_SCHEMA}", got "${schema}"`);
  rejectUnknownKeys(issues, obj, '', ['schema', 'language', 'kind', 'slug', 'title', 'summary', 'author', 'version', 'publishedAt', 'payload']);

  const kind = readEnum(issues, obj, 'kind', '', PUBLICATION_KINDS, 'saga');
  const slug = readString(issues, obj, 'slug', '', { min: 1, max: 60, pattern: SLUG, patternHint: SLUG_HINT });
  if (expected) {
    if (PUBLICATION_KINDS.includes(kind) && obj.kind === kind && kind !== expected.kind) {
      issues.add('kind', 'conflict', `"${kind}" does not match the folder (expected "${expected.kind}")`);
    }
    if (slug !== '' && slug !== expected.slug) issues.add('slug', 'conflict', `"${slug}" differs from the file name (expected "${expected.slug}")`);
  }

  const common = {
    language: readEnum(issues, obj, 'language', '', PACK_LANGUAGES, 'pt-BR'),
    slug,
    title: readString(issues, obj, 'title', '', { min: 1, max: 120 }),
    summary: readString(issues, obj, 'summary', '', { max: 600 }),
    author: readAuthor(issues, obj),
    version: readNumber(issues, obj, 'version', '', { min: 1, integer: true }),
    publishedAt: readDate(issues, obj, 'publishedAt', ''),
  };

  if (kind === 'saga') {
    const payload = readSagaPayload(issues, obj.payload, 'payload');
    return issues.result({ kind, ...common, payload });
  }
  const payload = readRankingPayload(issues, obj.payload, 'payload');
  return issues.result({ kind, ...common, payload });
}
