import type { ApiErrorDetail, ValidationIssueCode } from './errorCodes';

/*
  Hand-written validation readers (no dependencies).
  Each reader records the problem in `Issues` and returns a neutral value, so a
  single pass collects every error of a file/body instead of stopping at the first.
  Messages: `<source>: <field>: <problem>`, where source is the file path
  (or "body" in routes). Each issue also carries a machine-readable code, exposed
  to API clients as `details: [{ field, code }]`.
*/

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[]; details: ApiErrorDetail[] };

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class Issues {
  readonly errors: string[] = [];
  readonly details: ApiErrorDetail[] = [];
  readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  add(path: string, code: ValidationIssueCode, message: string) {
    this.errors.push(`${this.source}: ${path}: ${message}`);
    this.details.push({ field: path, code });
  }

  get ok() {
    return this.errors.length === 0;
  }

  result<T>(value: T): Result<T> {
    return this.ok ? { ok: true, value } : { ok: false, errors: this.errors, details: this.details };
  }
}

export function joinPath(base: string, key: string | number): string {
  if (typeof key === 'number') return `${base}[${key}]`;
  return base === '' ? key : `${base}.${key}`;
}

export function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function readRecord(issues: Issues, value: unknown, path: string): JsonRecord {
  if (isRecord(value)) return value;
  issues.add(path === '' ? '(root)' : path, 'invalid_type', `expected object, got ${describe(value)}`);
  return {};
}

export interface StringOptions {
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternHint?: string;
}

export function readString(issues: Issues, obj: JsonRecord, key: string, path: string, options: StringOptions = {}): string {
  const at = joinPath(path, key);
  const value = obj[key];
  if (typeof value !== 'string') {
    if (value === undefined) issues.add(at, 'required', 'required field is missing');
    else issues.add(at, 'invalid_type', `expected string, got ${describe(value)}`);
    return '';
  }
  const min = options.min ?? 0;
  if (value.length < min) issues.add(at, min === 1 ? 'empty' : 'too_short', min === 1 ? 'must not be empty' : `minimum of ${min} characters`);
  if (options.max !== undefined && value.length > options.max) issues.add(at, 'too_long', `maximum of ${options.max} characters`);
  if (options.pattern && !options.pattern.test(value)) {
    issues.add(at, 'invalid_format', options.patternHint ?? `invalid format: "${value}"`);
  }
  return value;
}

export function readDate(issues: Issues, obj: JsonRecord, key: string, path: string): string {
  const value = readString(issues, obj, key, path);
  if (value !== '' && !isRealIsoDate(value)) issues.add(joinPath(path, key), 'invalid_format', `expected a YYYY-MM-DD date, got "${value}"`);
  return value;
}

export interface NumberOptions {
  min?: number;
  max?: number;
  integer?: boolean;
}

export function readNumber(issues: Issues, obj: JsonRecord, key: string, path: string, options: NumberOptions = {}): number {
  const at = joinPath(path, key);
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    if (value === undefined) issues.add(at, 'required', 'required field is missing');
    else issues.add(at, 'invalid_type', `expected number, got ${describe(value)}`);
    return 0;
  }
  if (options.integer && !Number.isInteger(value)) issues.add(at, 'invalid_type', `expected integer, got ${value}`);
  if (options.min !== undefined && value < options.min) issues.add(at, 'invalid_range', `minimum ${options.min}, got ${value}`);
  if (options.max !== undefined && value > options.max) issues.add(at, 'invalid_range', `maximum ${options.max}, got ${value}`);
  return value;
}

export function readBoolean(issues: Issues, obj: JsonRecord, key: string, path: string): boolean {
  const value = obj[key];
  if (typeof value !== 'boolean') {
    if (value === undefined) issues.add(joinPath(path, key), 'required', 'required field is missing');
    else issues.add(joinPath(path, key), 'invalid_type', `expected boolean, got ${describe(value)}`);
    return false;
  }
  return value;
}

export function readEnum<T extends string>(
  issues: Issues,
  obj: JsonRecord,
  key: string,
  path: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = obj[key];
  const match = allowed.find((candidate) => candidate === value);
  if (match !== undefined) return match;
  if (value === undefined) issues.add(joinPath(path, key), 'required', `required field is missing (one of: ${allowed.join(', ')})`);
  else issues.add(joinPath(path, key), 'invalid_value', `invalid value ${JSON.stringify(value)} (expected one of: ${allowed.join(', ')})`);
  return fallback;
}

export function readObject(issues: Issues, obj: JsonRecord, key: string, path: string): JsonRecord {
  return readRecord(issues, obj[key], joinPath(path, key));
}

/** Reads an array and validates each item with `readItem`; missing/invalid arrays become `[]` with an error. */
export function readArray<T>(
  issues: Issues,
  obj: JsonRecord,
  key: string,
  path: string,
  readItem: (item: unknown, itemPath: string) => T,
): T[] {
  const at = joinPath(path, key);
  const value = obj[key];
  if (!Array.isArray(value)) {
    if (value === undefined) issues.add(at, 'required', 'required field is missing');
    else issues.add(at, 'invalid_type', `expected array, got ${describe(value)}`);
    return [];
  }
  return value.map((item, index) => readItem(item, joinPath(at, index)));
}

export function rejectUnknownKeys(issues: Issues, obj: JsonRecord, path: string, allowed: readonly string[]) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) issues.add(joinPath(path, key), 'unknown_field', 'unknown field');
  }
}
