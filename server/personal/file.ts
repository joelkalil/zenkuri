/*
  Personal file format (data/personal/<username>.json, outside git):
  full plan + per-game notes. Generated once by the legacy export and read by
  `npm run personal:import`.
*/

import type { PlanEntryInput, PlanSection } from '../../src/types/plan';
import type { Platform } from '../../src/types/steam';
import {
  Issues,
  isRealIsoDate,
  joinPath,
  readArray,
  readBoolean,
  readDate,
  readEnum,
  readNumber,
  readRecord,
  readString,
  type JsonRecord,
  type Result,
} from '../validation';
import { PLATFORMS, readEntryFields } from '../plan/validate';

export const PERSONAL_SCHEMA = 'zenkuri.personal/v1';

/** Plan entry in the file: the section is given by the container. */
export type PersonalEntry = Omit<PlanEntryInput, 'section' | 'phaseId'>;

export interface PersonalPhase {
  slug: string;
  title: string;
  start: string;
  end: string;
  capacity: number;
  summary: string;
  floating: boolean;
  entries: PersonalEntry[];
}

export interface PersonalPlan {
  title: string;
  principle: string;
  weeklyHours: number;
  baselineAvg: number | null;
  targetAvg: number | null;
  /** YYYY-MM-DD */
  createdAt: string;
  phases: PersonalPhase[];
  recurring: PersonalEntry[];
  afterPlan: PersonalEntry[];
  acceptAsIs: PersonalEntry[];
  ifTime: PersonalEntry[];
  milestones: { title: string; date: string | null; label: string; note: string }[];
  vacations: { slug: string; start: string; end: string; days: number; purpose: string; note: string }[];
  risks: { risk: string; action: string }[];
}

export interface PersonalGameNote {
  platform: Platform;
  externalId: string;
  estimate: string | null;
  note: string;
  /** provenance categories; the database only stores estimate + note */
  category: string[];
}

export interface PersonalFile {
  schema: typeof PERSONAL_SCHEMA;
  plan: PersonalPlan | null;
  gameNotes: PersonalGameNote[];
}

function readEntries(issues: Issues, obj: JsonRecord, key: string, path: string, section: PlanSection): PersonalEntry[] {
  return readArray(issues, obj, key, path, (item, itemPath) =>
    readEntryFields(issues, readRecord(issues, item, itemPath), itemPath, section));
}

function readNullableNumber(issues: Issues, obj: JsonRecord, key: string, path: string): number | null {
  return obj[key] === null ? null : readNumber(issues, obj, key, path, { min: 0, max: 100 });
}

function readPlan(issues: Issues, value: unknown, path: string): PersonalPlan {
  const obj = readRecord(issues, value, path);
  const createdAt = readDate(issues, obj, 'createdAt', path);
  return {
    title: readString(issues, obj, 'title', path, { min: 1 }),
    principle: readString(issues, obj, 'principle', path),
    weeklyHours: readNumber(issues, obj, 'weeklyHours', path, { min: 0, max: 168 }),
    baselineAvg: readNullableNumber(issues, obj, 'baselineAvg', path),
    targetAvg: readNullableNumber(issues, obj, 'targetAvg', path),
    createdAt,
    phases: readArray(issues, obj, 'phases', path, (item, itemPath) => {
      const phase = readRecord(issues, item, itemPath);
      const start = readDate(issues, phase, 'start', itemPath);
      const end = readDate(issues, phase, 'end', itemPath);
      if (isRealIsoDate(start) && isRealIsoDate(end) && end < start) issues.add(joinPath(itemPath, 'end'), 'invalid_range', `before start (${start})`);
      return {
        slug: readString(issues, phase, 'slug', itemPath, { min: 1 }),
        title: readString(issues, phase, 'title', itemPath, { min: 1 }),
        start,
        end,
        capacity: readNumber(issues, phase, 'capacity', itemPath, { min: 0 }),
        summary: readString(issues, phase, 'summary', itemPath),
        floating: readBoolean(issues, phase, 'floating', itemPath),
        entries: readEntries(issues, phase, 'entries', itemPath, 'phase'),
      };
    }),
    recurring: readEntries(issues, obj, 'recurring', path, 'recurring'),
    afterPlan: readEntries(issues, obj, 'afterPlan', path, 'after'),
    acceptAsIs: readEntries(issues, obj, 'acceptAsIs', path, 'accept'),
    ifTime: readEntries(issues, obj, 'ifTime', path, 'if_time'),
    milestones: readArray(issues, obj, 'milestones', path, (item, itemPath) => {
      const milestone = readRecord(issues, item, itemPath);
      return {
        title: readString(issues, milestone, 'title', itemPath, { min: 1 }),
        date: milestone.date === null ? null : readDate(issues, milestone, 'date', itemPath),
        label: readString(issues, milestone, 'label', itemPath),
        note: readString(issues, milestone, 'note', itemPath),
      };
    }),
    vacations: readArray(issues, obj, 'vacations', path, (item, itemPath) => {
      const vacation = readRecord(issues, item, itemPath);
      return {
        slug: readString(issues, vacation, 'slug', itemPath, { min: 1 }),
        start: readDate(issues, vacation, 'start', itemPath),
        end: readDate(issues, vacation, 'end', itemPath),
        days: readNumber(issues, vacation, 'days', itemPath, { min: 0, integer: true }),
        purpose: readString(issues, vacation, 'purpose', itemPath),
        note: readString(issues, vacation, 'note', itemPath),
      };
    }),
    risks: readArray(issues, obj, 'risks', path, (item, itemPath) => {
      const risk = readRecord(issues, item, itemPath);
      return {
        risk: readString(issues, risk, 'risk', itemPath, { min: 1 }),
        action: readString(issues, risk, 'action', itemPath),
      };
    }),
  };
}

export function validatePersonalFile(source: string, raw: unknown): Result<PersonalFile> {
  const issues = new Issues(source);
  const obj = readRecord(issues, raw, '');
  const schema = readString(issues, obj, 'schema', '');
  if (schema !== '' && schema !== PERSONAL_SCHEMA) issues.add('schema', 'invalid_value', `expected "${PERSONAL_SCHEMA}", got "${schema}"`);

  const plan = obj.plan === null ? null : readPlan(issues, obj.plan, 'plan');
  const gameNotes = readArray(issues, obj, 'gameNotes', '', (item, itemPath): PersonalGameNote => {
    const entry = readRecord(issues, item, itemPath);
    return {
      platform: readEnum(issues, entry, 'platform', itemPath, PLATFORMS, 'steam'),
      externalId: readString(issues, entry, 'externalId', itemPath, { min: 1 }),
      estimate: entry.estimate === null ? null : readString(issues, entry, 'estimate', itemPath),
      note: readString(issues, entry, 'note', itemPath),
      category: readArray(issues, entry, 'category', itemPath, (value, valuePath) => {
        if (typeof value === 'string' && value !== '') return value;
        issues.add(valuePath, 'invalid_type', 'expected a non-empty string');
        return '';
      }),
    };
  });

  return issues.result({ schema: PERSONAL_SCHEMA, plan, gameNotes });
}
