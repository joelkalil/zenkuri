/*
  Validation of plan inputs (route bodies and the personal import file).
  Creation requires the mandatory fields; PATCH validates only the keys present.
*/

import type {
  GameNoteInput,
  PlanEntryInput,
  PlanExternal,
  PlanFlag,
  PlanInput,
  PlanKind,
  PlanMilestoneInput,
  PlanPhaseInput,
  PlanRef,
  PlanRiskInput,
  PlanSection,
  PlanVacationInput,
} from '../../src/types/plan';
import { PLAN_FLAGS, PLAN_KINDS, PLAN_SECTIONS } from '../../src/types/plan';
import type { Platform } from '../../src/types/steam';
import {
  Issues,
  isRealIsoDate,
  isRecord,
  joinPath,
  readArray,
  readDate,
  readEnum,
  readNumber,
  readRecord,
  readString,
  rejectUnknownKeys,
  describe,
  type JsonRecord,
  type Result,
} from '../validation';

export const PLATFORMS: readonly Platform[] = ['steam', 'retroachievements', 'psn'];

const MAX_TITLE = 200;
const MAX_TEXT = 4000;
const SLUG_FIELD = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;

function has(obj: JsonRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function optionalText(issues: Issues, obj: JsonRecord, key: string, path: string, max = MAX_TEXT): string {
  if (!has(obj, key) || obj[key] === undefined) return '';
  return readString(issues, obj, key, path, { max });
}

function nullable<T>(obj: JsonRecord, key: string, read: () => T): T | null {
  if (!has(obj, key) || obj[key] === null || obj[key] === undefined) return null;
  return read();
}

function slugField(issues: Issues, obj: JsonRecord, path: string): string {
  return readString(issues, obj, 'slug', path, { min: 1, pattern: SLUG_FIELD, patternHint: 'use letters, numbers, "-" or "_" (up to 32 characters)' });
}

export function readFlags(issues: Issues, obj: JsonRecord, path: string): PlanFlag[] {
  if (!has(obj, 'flags') || obj.flags === undefined) return [];
  const flags = readArray(issues, obj, 'flags', path, (item, itemPath): PlanFlag | null => {
    const match = PLAN_FLAGS.find((flag) => flag === item);
    if (match) return match;
    issues.add(itemPath, 'invalid_value', `invalid flag ${JSON.stringify(item)} (expected one of: ${PLAN_FLAGS.join(', ')})`);
    return null;
  });
  const unique: PlanFlag[] = [];
  for (const flag of flags) if (flag && !unique.includes(flag)) unique.push(flag);
  return unique;
}

export function readRef(issues: Issues, value: unknown, path: string): PlanRef {
  const obj = readRecord(issues, value, path);
  rejectUnknownKeys(issues, obj, path, ['platform', 'id']);
  return {
    platform: readEnum(issues, obj, 'platform', path, PLATFORMS, 'steam'),
    id: readString(issues, obj, 'id', path, { min: 1, max: 100 }),
  };
}

export function readExternal(issues: Issues, value: unknown, path: string): PlanExternal {
  const obj = readRecord(issues, value, path);
  rejectUnknownKeys(issues, obj, path, ['label', 'releaseDate', 'storeAppid']);
  const external: PlanExternal = { label: readString(issues, obj, 'label', path, { min: 1, max: MAX_TITLE }) };
  if (has(obj, 'releaseDate') && obj.releaseDate !== undefined) external.releaseDate = readDate(issues, obj, 'releaseDate', path);
  if (has(obj, 'storeAppid') && obj.storeAppid !== undefined) {
    external.storeAppid = readString(issues, obj, 'storeAppid', path, { min: 1, max: 20, pattern: /^\d+$/, patternHint: 'expected a numeric appid' });
  }
  return external;
}

function readKind(issues: Issues, obj: JsonRecord, path: string): PlanKind {
  return readEnum(issues, obj, 'kind', path, PLAN_KINDS, 'foco');
}

function readHours(issues: Issues, obj: JsonRecord, path: string): number {
  return readNumber(issues, obj, 'hours', path, { min: 0, max: 10000 });
}

function readTarget(issues: Issues, obj: JsonRecord, path: string): number {
  return readNumber(issues, obj, 'target', path, { min: 0, max: 100, integer: true });
}

function entryNeedsKindAndHours(section: PlanSection) {
  return section === 'phase' || section === 'recurring';
}

const ENTRY_KEYS = ['title', 'ref', 'external', 'hours', 'kind', 'target', 'note', 'flags'] as const;

/** Entry fields (without section/phaseId), used by creation and by the personal file. */
export function readEntryFields(
  issues: Issues,
  obj: JsonRecord,
  path: string,
  section: PlanSection,
): Omit<PlanEntryInput, 'section' | 'phaseId'> {
  const strict = entryNeedsKindAndHours(section);
  const entry: Omit<PlanEntryInput, 'section' | 'phaseId'> = {
    title: readString(issues, obj, 'title', path, { min: 1, max: MAX_TITLE }),
    ref: nullable(obj, 'ref', () => readRef(issues, obj.ref, joinPath(path, 'ref'))),
    external: nullable(obj, 'external', () => readExternal(issues, obj.external, joinPath(path, 'external'))),
    hours: strict ? readHours(issues, obj, path) : nullable(obj, 'hours', () => readHours(issues, obj, path)),
    kind: strict ? readKind(issues, obj, path) : nullable(obj, 'kind', () => readKind(issues, obj, path)),
    target: nullable(obj, 'target', () => readTarget(issues, obj, path)),
    note: optionalText(issues, obj, 'note', path),
    flags: readFlags(issues, obj, path),
  };
  if (entry.ref && entry.external) issues.add(path, 'conflict', 'use "ref" (library game) or "external" (outside it), not both');
  return entry;
}

export function parseEntryInput(body: unknown, source = 'body'): Result<PlanEntryInput> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', ['section', 'phaseId', ...ENTRY_KEYS]);
  const section = readEnum(issues, obj, 'section', '', PLAN_SECTIONS, 'phase');
  let phaseId: number | null = null;
  if (section === 'phase') {
    phaseId = readNumber(issues, obj, 'phaseId', '', { min: 1, integer: true });
  } else if (has(obj, 'phaseId') && obj.phaseId !== null) {
    issues.add('phaseId', 'conflict', `only allowed in the "phase" section (current section: ${section})`);
  }
  const fields = readEntryFields(issues, obj, '', section);
  return issues.result({ section, phaseId, ...fields });
}

export type PlanEntryPatch = Partial<Omit<PlanEntryInput, 'section'>>;

export function parseEntryPatch(body: unknown, source = 'body'): Result<PlanEntryPatch> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', ['phaseId', ...ENTRY_KEYS]);
  const patch: PlanEntryPatch = {};
  if (has(obj, 'title')) patch.title = readString(issues, obj, 'title', '', { min: 1, max: MAX_TITLE });
  if (has(obj, 'ref')) patch.ref = nullable(obj, 'ref', () => readRef(issues, obj.ref, 'ref'));
  if (has(obj, 'external')) patch.external = nullable(obj, 'external', () => readExternal(issues, obj.external, 'external'));
  if (has(obj, 'hours')) patch.hours = nullable(obj, 'hours', () => readHours(issues, obj, ''));
  if (has(obj, 'kind')) patch.kind = nullable(obj, 'kind', () => readKind(issues, obj, ''));
  if (has(obj, 'target')) patch.target = nullable(obj, 'target', () => readTarget(issues, obj, ''));
  if (has(obj, 'note')) patch.note = readString(issues, obj, 'note', '', { max: MAX_TEXT });
  if (has(obj, 'flags')) patch.flags = readFlags(issues, obj, '');
  if (has(obj, 'phaseId')) patch.phaseId = readNumber(issues, obj, 'phaseId', '', { min: 1, integer: true });
  if (patch.ref && patch.external) issues.add('', 'conflict', 'use "ref" or "external", not both');
  if (Object.keys(patch).length === 0) issues.add('', 'empty', 'no field to update');
  return issues.result(patch);
}

// ─── Plan ──────────────────────────────────────────────────────────────────

function readPlanFields(issues: Issues, obj: JsonRecord, only: (key: string) => boolean): PlanInput {
  const input: PlanInput = {};
  if (only('title')) input.title = readString(issues, obj, 'title', '', { min: 1, max: MAX_TITLE });
  if (only('principle')) input.principle = readString(issues, obj, 'principle', '', { max: MAX_TEXT });
  if (only('weeklyHours')) input.weeklyHours = readNumber(issues, obj, 'weeklyHours', '', { min: 0, max: 168 });
  if (only('baselineAvg')) input.baselineAvg = nullable(obj, 'baselineAvg', () => readNumber(issues, obj, 'baselineAvg', '', { min: 0, max: 100 }));
  if (only('targetAvg')) input.targetAvg = nullable(obj, 'targetAvg', () => readNumber(issues, obj, 'targetAvg', '', { min: 0, max: 100 }));
  return input;
}

const PLAN_KEYS = ['title', 'principle', 'weeklyHours', 'baselineAvg', 'targetAvg'] as const;

/** POST /api/plan: every field is optional (defaults apply). */
export function parsePlanInput(body: unknown, source = 'body'): Result<PlanInput> {
  const issues = new Issues(source);
  const obj = isRecord(body) ? body : {};
  if (body !== undefined && !isRecord(body)) issues.add('(root)', 'invalid_type', `expected object, got ${describe(body)}`);
  rejectUnknownKeys(issues, obj, '', PLAN_KEYS);
  return issues.result(readPlanFields(issues, obj, (key) => has(obj, key)));
}

export function parsePlanPatch(body: unknown, source = 'body'): Result<PlanInput> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', PLAN_KEYS);
  const patch = readPlanFields(issues, obj, (key) => has(obj, key));
  if (Object.keys(patch).length === 0) issues.add('', 'empty', 'no field to update');
  return issues.result(patch);
}

// ─── Phases ──────────────────────────────────────────────────────────────────

const PHASE_KEYS = ['slug', 'title', 'start', 'end', 'capacity', 'summary', 'floating'] as const;

function readFloating(issues: Issues, obj: JsonRecord): boolean {
  if (typeof obj.floating === 'boolean') return obj.floating;
  issues.add('floating', 'invalid_type', `expected boolean, got ${describe(obj.floating)}`);
  return false;
}

function checkRange(issues: Issues, start: string, end: string) {
  if (isRealIsoDate(start) && isRealIsoDate(end) && end < start) issues.add('end', 'invalid_range', `cannot be before start (${start})`);
}

export function parsePhaseInput(body: unknown, source = 'body'): Result<PlanPhaseInput> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', PHASE_KEYS);
  const input: PlanPhaseInput = {
    slug: slugField(issues, obj, ''),
    title: readString(issues, obj, 'title', '', { min: 1, max: MAX_TITLE }),
    start: readDate(issues, obj, 'start', ''),
    end: readDate(issues, obj, 'end', ''),
    capacity: readNumber(issues, obj, 'capacity', '', { min: 0, max: 100000 }),
    summary: optionalText(issues, obj, 'summary', ''),
    floating: has(obj, 'floating') ? readFloating(issues, obj) : false,
  };
  checkRange(issues, input.start, input.end);
  return issues.result(input);
}

export function parsePhasePatch(body: unknown, source = 'body'): Result<Partial<PlanPhaseInput>> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', PHASE_KEYS);
  const patch: Partial<PlanPhaseInput> = {};
  if (has(obj, 'slug')) patch.slug = slugField(issues, obj, '');
  if (has(obj, 'title')) patch.title = readString(issues, obj, 'title', '', { min: 1, max: MAX_TITLE });
  if (has(obj, 'start')) patch.start = readDate(issues, obj, 'start', '');
  if (has(obj, 'end')) patch.end = readDate(issues, obj, 'end', '');
  if (has(obj, 'capacity')) patch.capacity = readNumber(issues, obj, 'capacity', '', { min: 0, max: 100000 });
  if (has(obj, 'summary')) patch.summary = readString(issues, obj, 'summary', '', { max: MAX_TEXT });
  if (has(obj, 'floating')) patch.floating = readFloating(issues, obj);
  if (patch.start && patch.end) checkRange(issues, patch.start, patch.end);
  if (Object.keys(patch).length === 0) issues.add('', 'empty', 'no field to update');
  return issues.result(patch);
}

// ─── Milestones ─────────────────────────────────────────────────────────────────

const MILESTONE_KEYS = ['title', 'date', 'label', 'note'] as const;

export function parseMilestoneInput(body: unknown, source = 'body'): Result<PlanMilestoneInput> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', MILESTONE_KEYS);
  return issues.result({
    title: readString(issues, obj, 'title', '', { min: 1, max: MAX_TITLE }),
    date: nullable(obj, 'date', () => readDate(issues, obj, 'date', '')),
    label: readString(issues, obj, 'label', '', { min: 1, max: MAX_TITLE }),
    note: optionalText(issues, obj, 'note', ''),
  });
}

export function parseMilestonePatch(body: unknown, source = 'body'): Result<Partial<PlanMilestoneInput>> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', MILESTONE_KEYS);
  const patch: Partial<PlanMilestoneInput> = {};
  if (has(obj, 'title')) patch.title = readString(issues, obj, 'title', '', { min: 1, max: MAX_TITLE });
  if (has(obj, 'date')) patch.date = nullable(obj, 'date', () => readDate(issues, obj, 'date', ''));
  if (has(obj, 'label')) patch.label = readString(issues, obj, 'label', '', { min: 1, max: MAX_TITLE });
  if (has(obj, 'note')) patch.note = readString(issues, obj, 'note', '', { max: MAX_TEXT });
  if (Object.keys(patch).length === 0) issues.add('', 'empty', 'no field to update');
  return issues.result(patch);
}

// ─── Vacations ─────────────────────────────────────────────────────────────────

const VACATION_KEYS = ['slug', 'start', 'end', 'days', 'purpose', 'note'] as const;

export function parseVacationInput(body: unknown, source = 'body'): Result<PlanVacationInput> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', VACATION_KEYS);
  const input: PlanVacationInput = {
    slug: slugField(issues, obj, ''),
    start: readDate(issues, obj, 'start', ''),
    end: readDate(issues, obj, 'end', ''),
    days: readNumber(issues, obj, 'days', '', { min: 0, max: 366, integer: true }),
    purpose: readString(issues, obj, 'purpose', '', { min: 1, max: MAX_TITLE }),
    note: optionalText(issues, obj, 'note', ''),
  };
  checkRange(issues, input.start, input.end);
  return issues.result(input);
}

export function parseVacationPatch(body: unknown, source = 'body'): Result<Partial<PlanVacationInput>> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', VACATION_KEYS);
  const patch: Partial<PlanVacationInput> = {};
  if (has(obj, 'slug')) patch.slug = slugField(issues, obj, '');
  if (has(obj, 'start')) patch.start = readDate(issues, obj, 'start', '');
  if (has(obj, 'end')) patch.end = readDate(issues, obj, 'end', '');
  if (has(obj, 'days')) patch.days = readNumber(issues, obj, 'days', '', { min: 0, max: 366, integer: true });
  if (has(obj, 'purpose')) patch.purpose = readString(issues, obj, 'purpose', '', { min: 1, max: MAX_TITLE });
  if (has(obj, 'note')) patch.note = readString(issues, obj, 'note', '', { max: MAX_TEXT });
  if (patch.start && patch.end) checkRange(issues, patch.start, patch.end);
  if (Object.keys(patch).length === 0) issues.add('', 'empty', 'no field to update');
  return issues.result(patch);
}

// ─── Risks ─────────────────────────────────────────────────────────────────

const RISK_KEYS = ['risk', 'action'] as const;

export function parseRiskInput(body: unknown, source = 'body'): Result<PlanRiskInput> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', RISK_KEYS);
  return issues.result({
    risk: readString(issues, obj, 'risk', '', { min: 1, max: MAX_TEXT }),
    action: readString(issues, obj, 'action', '', { max: MAX_TEXT }),
  });
}

export function parseRiskPatch(body: unknown, source = 'body'): Result<Partial<PlanRiskInput>> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', RISK_KEYS);
  const patch: Partial<PlanRiskInput> = {};
  if (has(obj, 'risk')) patch.risk = readString(issues, obj, 'risk', '', { min: 1, max: MAX_TEXT });
  if (has(obj, 'action')) patch.action = readString(issues, obj, 'action', '', { max: MAX_TEXT });
  if (Object.keys(patch).length === 0) issues.add('', 'empty', 'no field to update');
  return issues.result(patch);
}

// ─── Reordering ────────────────────────────────────────────────────────────

export interface ReorderInput {
  ids: number[];
  section?: PlanSection;
  phaseId?: number;
}

export function parseReorder(body: unknown, options: { scoped: boolean }, source = 'body'): Result<ReorderInput> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', options.scoped ? ['ids', 'section', 'phaseId'] : ['ids']);
  const ids = readArray(issues, obj, 'ids', '', (item, itemPath) => {
    if (typeof item === 'number' && Number.isInteger(item) && item > 0) return item;
    issues.add(itemPath, 'invalid_type', `expected a positive integer id, got ${JSON.stringify(item)}`);
    return 0;
  });
  if (new Set(ids).size !== ids.length) issues.add('ids', 'duplicate', 'duplicate ids');
  const input: ReorderInput = { ids };
  if (options.scoped) {
    input.section = readEnum(issues, obj, 'section', '', PLAN_SECTIONS, 'phase');
    if (input.section === 'phase') input.phaseId = readNumber(issues, obj, 'phaseId', '', { min: 1, integer: true });
  }
  return issues.result(input);
}

// ─── Per-game notes ─────────────────────────────────────────────────────────

export function parseGameNoteInput(body: unknown, source = 'body'): Result<GameNoteInput> {
  const issues = new Issues(source);
  const obj = readRecord(issues, body, '');
  rejectUnknownKeys(issues, obj, '', ['estimate', 'note']);
  const input: GameNoteInput = {};
  if (has(obj, 'estimate')) input.estimate = nullable(obj, 'estimate', () => readString(issues, obj, 'estimate', '', { max: 60 }));
  if (has(obj, 'note')) input.note = readString(issues, obj, 'note', '', { max: MAX_TEXT });
  if (Object.keys(input).length === 0) issues.add('', 'empty', 'send "estimate" and/or "note"');
  return issues.result(input);
}
