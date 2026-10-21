/*
  Environment readers. dotenv loads `X=` as an empty string, which would defeat
  a `process.env.X ?? default`; these helpers treat blank values as unset.
*/

function readRaw(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

export function envString(name: string): string | undefined;
export function envString(name: string, fallback: string): string;
export function envString(name: string, fallback?: string): string | undefined {
  return readRaw(name) ?? fallback;
}

/** Integer value, or `fallback` when unset, blank or not an integer. */
export function envInt(name: string, fallback: number): number {
  const raw = readRaw(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : fallback;
}

const TRUE_VALUES = ['1', 'true', 'yes', 'on'];
const FALSE_VALUES = ['0', 'false', 'no', 'off'];

/** Boolean flag (1/true/yes/on, 0/false/no/off), or `fallback` when unset or unrecognised. */
export function envBool(name: string, fallback: boolean): boolean {
  const raw = readRaw(name)?.toLowerCase();
  if (raw === undefined) return fallback;
  if (TRUE_VALUES.includes(raw)) return true;
  if (FALSE_VALUES.includes(raw)) return false;
  return fallback;
}
