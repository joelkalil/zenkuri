/*
  The user's play plan (personal, manual data; no generator).
  The server returns these shapes from /api/plan. Entries match the library
  by (platform, externalId) via `ref` and show real progress.
*/

import type { Platform } from './steam';

export const PLAN_KIND = {
  FOCO: 'foco',
  PLATINA: 'platina',
  LIMPEZA: 'limpeza',
  COLHER: 'colher',
} as const;

export type PlanKind = (typeof PLAN_KIND)[keyof typeof PLAN_KIND];

export const PLAN_KINDS: readonly PlanKind[] = ['foco', 'platina', 'limpeza', 'colher'];

export const PLAN_FLAG = {
  COOP: 'coop',
  ONLINE: 'online',
  RISCO: 'risco',
} as const;

export type PlanFlag = (typeof PLAN_FLAG)[keyof typeof PLAN_FLAG];

export const PLAN_FLAGS: readonly PlanFlag[] = ['coop', 'online', 'risco'];

export const PLAN_SECTION = {
  PHASE: 'phase',
  RECURRING: 'recurring',
  AFTER: 'after',
  ACCEPT: 'accept',
  IF_TIME: 'if_time',
} as const;

export type PlanSection = (typeof PLAN_SECTION)[keyof typeof PLAN_SECTION];

export const PLAN_SECTIONS: readonly PlanSection[] = ['phase', 'recurring', 'after', 'accept', 'if_time'];

export interface PlanRef {
  platform: Platform;
  id: string;
}

/** Game outside the library: where/when. */
export interface PlanExternal {
  label: string;
  releaseDate?: string;
  storeAppid?: string;
}

/**
 * One plan row. In the `after`/`accept`/`if_time` sections (formerly "loose games")
 * `note` holds the reason, `kind` and `target` are usually null and `hours` may be missing.
 */
export interface PlanEntry {
  id: number;
  section: PlanSection;
  /** present only in the `phase` section */
  phaseId: number | null;
  position: number;
  title: string;
  ref: PlanRef | null;
  external: PlanExternal | null;
  hours: number | null;
  kind: PlanKind | null;
  /** % that counts as done in this step (null = 100) */
  target: number | null;
  note: string;
  flags: PlanFlag[];
}

export interface PlanPhase {
  id: number;
  position: number;
  /** short stable identifier (e.g. "F1"), used in URLs */
  slug: string;
  title: string;
  start: string;
  end: string;
  capacity: number;
  summary: string;
  /** dates are a guess and the block slides with an undated release */
  floating: boolean;
  entries: PlanEntry[];
}

export interface PlanMilestone {
  id: number;
  position: number;
  title: string;
  date: string | null;
  label: string;
  note: string;
}

export interface PlanVacation {
  id: number;
  position: number;
  slug: string;
  start: string;
  end: string;
  days: number;
  purpose: string;
  note: string;
}

export interface PlanRisk {
  id: number;
  position: number;
  risk: string;
  action: string;
}

export interface Plan {
  id: number;
  title: string;
  principle: string;
  weeklyHours: number;
  baselineAvg: number | null;
  targetAvg: number | null;
  createdAt: string;
  updatedAt: string;
  phases: PlanPhase[];
  /** played every week, outside the phases */
  recurring: PlanEntry[];
  afterPlan: PlanEntry[];
  acceptAsIs: PlanEntry[];
  ifTime: PlanEntry[];
  milestones: PlanMilestone[];
  vacations: PlanVacation[];
  risks: PlanRisk[];
}

// ─── Write inputs ────────────────────────────────────────────────────

export interface PlanInput {
  title?: string;
  principle?: string;
  weeklyHours?: number;
  baselineAvg?: number | null;
  targetAvg?: number | null;
}

export interface PlanPhaseInput {
  slug: string;
  title: string;
  start: string;
  end: string;
  capacity: number;
  summary?: string;
  floating?: boolean;
}

export interface PlanEntryInput {
  section: PlanSection;
  phaseId?: number | null;
  title: string;
  ref?: PlanRef | null;
  external?: PlanExternal | null;
  hours?: number | null;
  kind?: PlanKind | null;
  target?: number | null;
  note?: string;
  flags?: PlanFlag[];
}

export interface PlanMilestoneInput {
  title: string;
  date?: string | null;
  label: string;
  note?: string;
}

export interface PlanVacationInput {
  slug: string;
  start: string;
  end: string;
  days: number;
  purpose: string;
  note?: string;
}

export interface PlanRiskInput {
  risk: string;
  action: string;
}

/** Personal per-game notes (estimate + annotation). */
export interface GameNote {
  gameId: number;
  platform: Platform;
  externalId: string;
  title: string;
  estimate: string | null;
  note: string;
  updatedAt: string;
}

export interface GameNoteInput {
  estimate?: string | null;
  note?: string;
}
