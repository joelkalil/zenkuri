/*
  Personal plan and notes: database access.
  Every function takes `userId` and only sees that user's plan; any id that
  belongs to another plan is treated as nonexistent (PlanNotFoundError -> 404).
*/

import { db, parseJson } from '../db';
import type { ApiErrorCode, ApiErrorDetail } from '../errorCodes';
import { ApiError } from '../errors';
import type {
  GameNote,
  GameNoteInput,
  Plan,
  PlanEntry,
  PlanEntryInput,
  PlanExternal,
  PlanFlag,
  PlanInput,
  PlanKind,
  PlanMilestone,
  PlanMilestoneInput,
  PlanPhase,
  PlanPhaseInput,
  PlanRef,
  PlanRisk,
  PlanRiskInput,
  PlanSection,
  PlanVacation,
  PlanVacationInput,
} from '../../src/types/plan';
import type { Platform } from '../../src/types/steam';
import type { PlanEntryPatch } from './validate';

/** A plan resource ('Plan', 'Phase', 'Entry', ...) that does not exist for this user. Maps to 404. */
export class PlanNotFoundError extends ApiError {
  readonly resource: string;

  constructor(resource: string) {
    super(resource === 'Plan' ? 'plan.not_found' : 'plan.item_not_found', 404, { message: `${resource} not found.` });
    this.name = 'PlanNotFoundError';
    this.resource = resource;
  }
}

/** Input that is well-formed but conflicts with the plan state. Maps to 400 (409 for a taken slug). */
export class PlanInputError extends ApiError {
  constructor(code: ApiErrorCode, message?: string, details?: ApiErrorDetail[]) {
    super(code, code === 'plan.slug_taken' ? 409 : 400, { message, details });
    this.name = 'PlanInputError';
  }
}

type ChildTable = 'plan_phases' | 'plan_entries' | 'plan_milestones' | 'plan_vacations' | 'plan_risks';
type SqlValue = string | number | null;

function now() {
  return new Date().toISOString();
}

// ─── Rows and mapping ────────────────────────────────────────────────────

interface PlanRow {
  id: number;
  title: string;
  principle: string;
  weekly_hours: number;
  baseline_avg: number | null;
  target_avg: number | null;
  created_at: string;
  updated_at: string;
}

interface PhaseRow {
  id: number;
  position: number;
  slug: string;
  title: string;
  start_date: string;
  end_date: string;
  capacity_hours: number;
  summary: string;
  floating: number;
}

interface EntryRow {
  id: number;
  phase_id: number | null;
  section: PlanSection;
  position: number;
  title: string;
  platform: Platform | null;
  external_id: string | null;
  external_json: string | null;
  hours: number | null;
  kind: PlanKind | null;
  target: number | null;
  note: string;
  flags_json: string;
}

function mapPhase(row: PhaseRow): Omit<PlanPhase, 'entries'> {
  return {
    id: row.id,
    position: row.position,
    slug: row.slug,
    title: row.title,
    start: row.start_date,
    end: row.end_date,
    capacity: row.capacity_hours,
    summary: row.summary,
    floating: row.floating === 1,
  };
}

function mapEntry(row: EntryRow): PlanEntry {
  const ref: PlanRef | null = row.platform && row.external_id ? { platform: row.platform, id: row.external_id } : null;
  return {
    id: row.id,
    section: row.section,
    phaseId: row.phase_id,
    position: row.position,
    title: row.title,
    ref,
    external: row.external_json ? parseJson<PlanExternal | null>(row.external_json, null) : null,
    hours: row.hours,
    kind: row.kind,
    target: row.target,
    note: row.note,
    flags: parseJson<PlanFlag[]>(row.flags_json, []),
  };
}

function planIdOf(userId: number): number | null {
  const row = db.prepare('select id from plans where user_id = ?').get(userId) as { id: number } | undefined;
  return row?.id ?? null;
}

function requirePlanId(userId: number): number {
  const id = planIdOf(userId);
  if (id === null) throw new PlanNotFoundError('Plan');
  return id;
}

function touch(planId: number) {
  db.prepare('update plans set updated_at = ? where id = ?').run(now(), planId);
}

// ─── Plan ──────────────────────────────────────────────────────────────────

export function getPlanByUser(userId: number): Plan | null {
  const row = db.prepare('select * from plans where user_id = ?').get(userId) as PlanRow | undefined;
  if (!row) return null;

  const phaseRows = db.prepare('select * from plan_phases where plan_id = ? order by position, id').all(row.id) as PhaseRow[];
  const entries = (db.prepare('select * from plan_entries where plan_id = ? order by position, id').all(row.id) as EntryRow[]).map(mapEntry);
  const inSection = (section: PlanSection) => entries.filter((entry) => entry.section === section);

  return {
    id: row.id,
    title: row.title,
    principle: row.principle,
    weeklyHours: row.weekly_hours,
    baselineAvg: row.baseline_avg,
    targetAvg: row.target_avg,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    phases: phaseRows.map((phase) => ({
      ...mapPhase(phase),
      entries: entries.filter((entry) => entry.section === 'phase' && entry.phaseId === phase.id),
    })),
    recurring: inSection('recurring'),
    afterPlan: inSection('after'),
    acceptAsIs: inSection('accept'),
    ifTime: inSection('if_time'),
    milestones: (db.prepare('select * from plan_milestones where plan_id = ? order by position, id').all(row.id) as Array<{
      id: number; position: number; title: string; date: string | null; label: string; note: string;
    }>).map((item): PlanMilestone => ({
      id: item.id, position: item.position, title: item.title, date: item.date, label: item.label, note: item.note,
    })),
    vacations: (db.prepare('select * from plan_vacations where plan_id = ? order by position, id').all(row.id) as Array<{
      id: number; position: number; slug: string; start_date: string; end_date: string; days: number; purpose: string; note: string;
    }>).map((item): PlanVacation => ({
      id: item.id, position: item.position, slug: item.slug, start: item.start_date, end: item.end_date,
      days: item.days, purpose: item.purpose, note: item.note,
    })),
    risks: (db.prepare('select * from plan_risks where plan_id = ? order by position, id').all(row.id) as Array<{
      id: number; position: number; risk: string; action: string;
    }>).map((item): PlanRisk => ({ id: item.id, position: item.position, risk: item.risk, action: item.action })),
  };
}

function requirePlan(userId: number): Plan {
  const plan = getPlanByUser(userId);
  if (!plan) throw new PlanNotFoundError('Plan');
  return plan;
}

/** Creates the plan if the user does not have one yet; returns `created: false` when it already existed. */
export function createPlanIfMissing(userId: number, input: PlanInput = {}, createdAt: string = now()): { plan: Plan; created: boolean } {
  const existing = getPlanByUser(userId);
  if (existing) return { plan: existing, created: false };
  db.prepare(`
    insert into plans (user_id, title, principle, weekly_hours, baseline_avg, target_avg, created_at, updated_at)
    values (@userId, @title, @principle, @weeklyHours, @baselineAvg, @targetAvg, @createdAt, @updatedAt)
  `).run({
    userId,
    // No server-side display text: the client shows a localized fallback for an empty title.
    title: input.title ?? '',
    principle: input.principle ?? '',
    weeklyHours: input.weeklyHours ?? 0,
    baselineAvg: input.baselineAvg ?? null,
    targetAvg: input.targetAvg ?? null,
    createdAt,
    updatedAt: now(),
  });
  return { plan: requirePlan(userId), created: true };
}

export function updatePlan(userId: number, patch: PlanInput): Plan {
  const planId = requirePlanId(userId);
  const columns: Record<string, SqlValue> = {};
  if (patch.title !== undefined) columns.title = patch.title;
  if (patch.principle !== undefined) columns.principle = patch.principle;
  if (patch.weeklyHours !== undefined) columns.weekly_hours = patch.weeklyHours;
  if (patch.baselineAvg !== undefined) columns.baseline_avg = patch.baselineAvg;
  if (patch.targetAvg !== undefined) columns.target_avg = patch.targetAvg;
  updateColumns('plans', planId, columns, planId);
  touch(planId);
  return requirePlan(userId);
}

/** Removes the plan and, by cascade, its phases, entries, milestones, vacations and risks. */
export function deletePlan(userId: number): boolean {
  return db.prepare('delete from plans where user_id = ?').run(userId).changes > 0;
}

// ─── Generic helpers ──────────────────────────────────────────────────

/** `table`/columns always come from the code, never from the client. */
function updateColumns(table: 'plans' | ChildTable, id: number, columns: Record<string, SqlValue>, planId: number) {
  const names = Object.keys(columns);
  if (names.length === 0) return;
  const assignments = names.map((name) => `${name} = @${name}`).join(', ');
  const ownerClause = table === 'plans' ? 'id = @planId' : 'id = @id and plan_id = @planId';
  db.prepare(`update ${table} set ${assignments} where ${ownerClause}`).run(table === 'plans' ? { ...columns, planId } : { ...columns, id, planId });
}

function nextPosition(table: ChildTable, planId: number, scopeSql = '1 = 1', scopeParams: Record<string, SqlValue> = {}): number {
  const row = db.prepare(`select coalesce(max(position), -1) + 1 as next from ${table} where plan_id = @planId and ${scopeSql}`)
    .get({ planId, ...scopeParams }) as { next: number };
  return row.next;
}

function deleteChild(userId: number, table: ChildTable, id: number): void {
  const planId = requirePlanId(userId);
  const result = db.prepare(`delete from ${table} where id = ? and plan_id = ?`).run(id, planId);
  if (result.changes === 0) throw new PlanNotFoundError('Item');
  touch(planId);
}

/** The listed ids come first, in the given order; the rest keep their current order. */
function reorderChildren(
  userId: number,
  table: ChildTable,
  ids: readonly number[],
  scopeSql = '1 = 1',
  scopeParams: Record<string, SqlValue> = {},
): void {
  const planId = requirePlanId(userId);
  const current = (db.prepare(`select id from ${table} where plan_id = @planId and ${scopeSql} order by position, id`)
    .all({ planId, ...scopeParams }) as Array<{ id: number }>).map((row) => row.id);
  const known = new Set(current);
  if (ids.some((id) => !known.has(id))) throw new PlanNotFoundError('Item');
  const requested = new Set(ids);
  const ordered = [...ids, ...current.filter((id) => !requested.has(id))];
  const setPosition = db.prepare(`update ${table} set position = ? where id = ? and plan_id = ?`);
  db.transaction(() => {
    ordered.forEach((id, index) => setPosition.run(index, id, planId));
    touch(planId);
  })();
}

function assertUniqueSlug(table: 'plan_phases' | 'plan_vacations', planId: number, slug: string, exceptId?: number) {
  const clash = db.prepare(`select id from ${table} where plan_id = ? and slug = ? and id <> ?`).get(planId, slug, exceptId ?? 0);
  if (clash) throw new PlanInputError('plan.slug_taken', `slug "${slug}" already exists in this plan.`, [{ field: 'slug', code: 'duplicate' }]);
}

// ─── Phases ──────────────────────────────────────────────────────────────────

function getPhaseRow(planId: number, id: number): PhaseRow {
  const row = db.prepare('select * from plan_phases where id = ? and plan_id = ?').get(id, planId) as PhaseRow | undefined;
  if (!row) throw new PlanNotFoundError('Phase');
  return row;
}

export function insertPhase(userId: number, input: PlanPhaseInput): Omit<PlanPhase, 'entries'> {
  const planId = requirePlanId(userId);
  assertUniqueSlug('plan_phases', planId, input.slug);
  const result = db.prepare(`
    insert into plan_phases (plan_id, position, slug, title, start_date, end_date, capacity_hours, summary, floating)
    values (@planId, @position, @slug, @title, @start, @end, @capacity, @summary, @floating)
  `).run({
    planId,
    position: nextPosition('plan_phases', planId),
    slug: input.slug,
    title: input.title,
    start: input.start,
    end: input.end,
    capacity: input.capacity,
    summary: input.summary ?? '',
    floating: input.floating ? 1 : 0,
  });
  touch(planId);
  return mapPhase(getPhaseRow(planId, Number(result.lastInsertRowid)));
}

export function updatePhase(userId: number, id: number, patch: Partial<PlanPhaseInput>): Omit<PlanPhase, 'entries'> {
  const planId = requirePlanId(userId);
  const current = getPhaseRow(planId, id);
  const start = patch.start ?? current.start_date;
  const end = patch.end ?? current.end_date;
  if (end < start) throw new PlanInputError('plan.invalid_date_range', `end (${end}) cannot be before start (${start}).`, [{ field: 'end', code: 'invalid_range' }]);
  if (patch.slug !== undefined) assertUniqueSlug('plan_phases', planId, patch.slug, id);
  const columns: Record<string, SqlValue> = {};
  if (patch.slug !== undefined) columns.slug = patch.slug;
  if (patch.title !== undefined) columns.title = patch.title;
  if (patch.start !== undefined) columns.start_date = patch.start;
  if (patch.end !== undefined) columns.end_date = patch.end;
  if (patch.capacity !== undefined) columns.capacity_hours = patch.capacity;
  if (patch.summary !== undefined) columns.summary = patch.summary;
  if (patch.floating !== undefined) columns.floating = patch.floating ? 1 : 0;
  updateColumns('plan_phases', id, columns, planId);
  touch(planId);
  return mapPhase(getPhaseRow(planId, id));
}

export function deletePhase(userId: number, id: number): void {
  deleteChild(userId, 'plan_phases', id);
}

export function reorderPhases(userId: number, ids: readonly number[]): void {
  reorderChildren(userId, 'plan_phases', ids);
}

// ─── Entries ───────────────────────────────────────────────────────────────

function getEntryRow(planId: number, id: number): EntryRow {
  const row = db.prepare('select * from plan_entries where id = ? and plan_id = ?').get(id, planId) as EntryRow | undefined;
  if (!row) throw new PlanNotFoundError('Entry');
  return row;
}

function requiresKindAndHours(section: PlanSection) {
  return section === 'phase' || section === 'recurring';
}

function assertEntryShape(section: PlanSection, hours: number | null, kind: PlanKind | null) {
  if (requiresKindAndHours(section) && (hours === null || kind === null)) {
    throw new PlanInputError('plan.entry_requires_hours_and_kind', `entries in section "${section}" require hours and kind.`, [{ field: 'hours', code: 'required' }, { field: 'kind', code: 'required' }]);
  }
}

export function insertEntry(userId: number, input: PlanEntryInput): PlanEntry {
  const planId = requirePlanId(userId);
  const phaseId = input.section === 'phase' ? input.phaseId ?? null : null;
  if (input.section === 'phase') {
    if (phaseId === null) throw new PlanInputError('plan.phase_id_required', 'phaseId is required in the "phase" section.', [{ field: 'phaseId', code: 'required' }]);
    getPhaseRow(planId, phaseId);
  } else if (input.phaseId) {
    throw new PlanInputError('plan.phase_id_not_allowed', 'phaseId is only allowed in the "phase" section.', [{ field: 'phaseId', code: 'conflict' }]);
  }
  assertEntryShape(input.section, input.hours ?? null, input.kind ?? null);

  const result = db.prepare(`
    insert into plan_entries
      (plan_id, phase_id, section, position, title, platform, external_id, external_json, hours, kind, target, note, flags_json)
    values
      (@planId, @phaseId, @section, @position, @title, @platform, @externalId, @externalJson, @hours, @kind, @target, @note, @flags)
  `).run({
    planId,
    phaseId,
    section: input.section,
    position: input.section === 'phase'
      ? nextPosition('plan_entries', planId, 'phase_id = @phaseId', { phaseId })
      : nextPosition('plan_entries', planId, 'section = @section and phase_id is null', { section: input.section }),
    title: input.title,
    platform: input.ref?.platform ?? null,
    externalId: input.ref?.id ?? null,
    externalJson: input.external ? JSON.stringify(input.external) : null,
    hours: input.hours ?? null,
    kind: input.kind ?? null,
    target: input.target ?? null,
    note: input.note ?? '',
    flags: JSON.stringify(input.flags ?? []),
  });
  touch(planId);
  return mapEntry(getEntryRow(planId, Number(result.lastInsertRowid)));
}

export function updateEntry(userId: number, id: number, patch: PlanEntryPatch): PlanEntry {
  const planId = requirePlanId(userId);
  const current = getEntryRow(planId, id);
  const columns: Record<string, SqlValue> = {};

  if (patch.title !== undefined) columns.title = patch.title;
  if (patch.note !== undefined) columns.note = patch.note;
  if (patch.target !== undefined) columns.target = patch.target;
  if (patch.flags !== undefined) columns.flags_json = JSON.stringify(patch.flags);
  if (patch.ref !== undefined) {
    columns.platform = patch.ref?.platform ?? null;
    columns.external_id = patch.ref?.id ?? null;
    if (patch.ref) columns.external_json = null;
  }
  if (patch.external !== undefined) {
    columns.external_json = patch.external ? JSON.stringify(patch.external) : null;
    if (patch.external) {
      columns.platform = null;
      columns.external_id = null;
    }
  }
  const hours = patch.hours !== undefined ? patch.hours : current.hours;
  const kind = patch.kind !== undefined ? patch.kind : current.kind;
  assertEntryShape(current.section, hours, kind);
  if (patch.hours !== undefined) columns.hours = patch.hours;
  if (patch.kind !== undefined) columns.kind = patch.kind;

  if (patch.phaseId !== undefined && patch.phaseId !== current.phase_id) {
    if (current.section !== 'phase' || patch.phaseId === null) throw new PlanInputError('plan.entry_cannot_change_phase', 'only entries in the "phase" section can change phase, and the phase cannot be null.', [{ field: 'phaseId', code: 'conflict' }]);
    getPhaseRow(planId, patch.phaseId);
    columns.phase_id = patch.phaseId;
    columns.position = nextPosition('plan_entries', planId, 'phase_id = @phaseId', { phaseId: patch.phaseId });
  }

  updateColumns('plan_entries', id, columns, planId);
  touch(planId);
  return mapEntry(getEntryRow(planId, id));
}

export function deleteEntry(userId: number, id: number): void {
  deleteChild(userId, 'plan_entries', id);
}

/** Reorders within a phase (`phaseId`) or a loose section (`section`). */
export function reorderEntries(userId: number, scope: { section: PlanSection; phaseId?: number }, ids: readonly number[]): void {
  const planId = requirePlanId(userId);
  if (scope.section === 'phase') {
    if (scope.phaseId === undefined) throw new PlanInputError('plan.phase_id_required', 'phaseId is required in the "phase" section.', [{ field: 'phaseId', code: 'required' }]);
    getPhaseRow(planId, scope.phaseId);
    reorderChildren(userId, 'plan_entries', ids, 'phase_id = @phaseId', { phaseId: scope.phaseId });
    return;
  }
  reorderChildren(userId, 'plan_entries', ids, 'section = @section and phase_id is null', { section: scope.section });
}

// ─── Milestones ─────────────────────────────────────────────────────────────────

function getMilestone(planId: number, id: number): PlanMilestone {
  const row = db.prepare('select * from plan_milestones where id = ? and plan_id = ?').get(id, planId) as
    { id: number; position: number; title: string; date: string | null; label: string; note: string } | undefined;
  if (!row) throw new PlanNotFoundError('Milestone');
  return { id: row.id, position: row.position, title: row.title, date: row.date, label: row.label, note: row.note };
}

export function insertMilestone(userId: number, input: PlanMilestoneInput): PlanMilestone {
  const planId = requirePlanId(userId);
  const result = db.prepare(`
    insert into plan_milestones (plan_id, position, title, date, label, note)
    values (@planId, @position, @title, @date, @label, @note)
  `).run({
    planId,
    position: nextPosition('plan_milestones', planId),
    title: input.title,
    date: input.date ?? null,
    label: input.label,
    note: input.note ?? '',
  });
  touch(planId);
  return getMilestone(planId, Number(result.lastInsertRowid));
}

export function updateMilestone(userId: number, id: number, patch: Partial<PlanMilestoneInput>): PlanMilestone {
  const planId = requirePlanId(userId);
  getMilestone(planId, id);
  const columns: Record<string, SqlValue> = {};
  if (patch.title !== undefined) columns.title = patch.title;
  if (patch.date !== undefined) columns.date = patch.date;
  if (patch.label !== undefined) columns.label = patch.label;
  if (patch.note !== undefined) columns.note = patch.note;
  updateColumns('plan_milestones', id, columns, planId);
  touch(planId);
  return getMilestone(planId, id);
}

export function deleteMilestone(userId: number, id: number): void {
  deleteChild(userId, 'plan_milestones', id);
}

export function reorderMilestones(userId: number, ids: readonly number[]): void {
  reorderChildren(userId, 'plan_milestones', ids);
}

// ─── Vacations ─────────────────────────────────────────────────────────────────

function getVacation(planId: number, id: number): PlanVacation {
  const row = db.prepare('select * from plan_vacations where id = ? and plan_id = ?').get(id, planId) as
    { id: number; position: number; slug: string; start_date: string; end_date: string; days: number; purpose: string; note: string } | undefined;
  if (!row) throw new PlanNotFoundError('Vacation');
  return {
    id: row.id, position: row.position, slug: row.slug, start: row.start_date, end: row.end_date,
    days: row.days, purpose: row.purpose, note: row.note,
  };
}

export function insertVacation(userId: number, input: PlanVacationInput): PlanVacation {
  const planId = requirePlanId(userId);
  assertUniqueSlug('plan_vacations', planId, input.slug);
  const result = db.prepare(`
    insert into plan_vacations (plan_id, position, slug, start_date, end_date, days, purpose, note)
    values (@planId, @position, @slug, @start, @end, @days, @purpose, @note)
  `).run({
    planId,
    position: nextPosition('plan_vacations', planId),
    slug: input.slug,
    start: input.start,
    end: input.end,
    days: input.days,
    purpose: input.purpose,
    note: input.note ?? '',
  });
  touch(planId);
  return getVacation(planId, Number(result.lastInsertRowid));
}

export function updateVacation(userId: number, id: number, patch: Partial<PlanVacationInput>): PlanVacation {
  const planId = requirePlanId(userId);
  const current = getVacation(planId, id);
  const start = patch.start ?? current.start;
  const end = patch.end ?? current.end;
  if (end < start) throw new PlanInputError('plan.invalid_date_range', `end (${end}) cannot be before start (${start}).`, [{ field: 'end', code: 'invalid_range' }]);
  if (patch.slug !== undefined) assertUniqueSlug('plan_vacations', planId, patch.slug, id);
  const columns: Record<string, SqlValue> = {};
  if (patch.slug !== undefined) columns.slug = patch.slug;
  if (patch.start !== undefined) columns.start_date = patch.start;
  if (patch.end !== undefined) columns.end_date = patch.end;
  if (patch.days !== undefined) columns.days = patch.days;
  if (patch.purpose !== undefined) columns.purpose = patch.purpose;
  if (patch.note !== undefined) columns.note = patch.note;
  updateColumns('plan_vacations', id, columns, planId);
  touch(planId);
  return getVacation(planId, id);
}

export function deleteVacation(userId: number, id: number): void {
  deleteChild(userId, 'plan_vacations', id);
}

export function reorderVacations(userId: number, ids: readonly number[]): void {
  reorderChildren(userId, 'plan_vacations', ids);
}

// ─── Risks ─────────────────────────────────────────────────────────────────

function getRisk(planId: number, id: number): PlanRisk {
  const row = db.prepare('select * from plan_risks where id = ? and plan_id = ?').get(id, planId) as
    { id: number; position: number; risk: string; action: string } | undefined;
  if (!row) throw new PlanNotFoundError('Risk');
  return { id: row.id, position: row.position, risk: row.risk, action: row.action };
}

export function insertRisk(userId: number, input: PlanRiskInput): PlanRisk {
  const planId = requirePlanId(userId);
  const result = db.prepare(`
    insert into plan_risks (plan_id, position, risk, action) values (@planId, @position, @risk, @action)
  `).run({ planId, position: nextPosition('plan_risks', planId), risk: input.risk, action: input.action });
  touch(planId);
  return getRisk(planId, Number(result.lastInsertRowid));
}

export function updateRisk(userId: number, id: number, patch: Partial<PlanRiskInput>): PlanRisk {
  const planId = requirePlanId(userId);
  getRisk(planId, id);
  const columns: Record<string, SqlValue> = {};
  if (patch.risk !== undefined) columns.risk = patch.risk;
  if (patch.action !== undefined) columns.action = patch.action;
  updateColumns('plan_risks', id, columns, planId);
  touch(planId);
  return getRisk(planId, id);
}

export function deleteRisk(userId: number, id: number): void {
  deleteChild(userId, 'plan_risks', id);
}

export function reorderRisks(userId: number, ids: readonly number[]): void {
  reorderChildren(userId, 'plan_risks', ids);
}

// ─── Per-game notes ─────────────────────────────────────────────────────────

interface GameNoteRow {
  game_id: number;
  platform: Platform;
  external_id: string;
  title: string;
  estimate: string | null;
  note: string;
  updated_at: string;
}

function mapGameNote(row: GameNoteRow): GameNote {
  return {
    gameId: row.game_id,
    platform: row.platform,
    externalId: row.external_id,
    title: row.title,
    estimate: row.estimate,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

const GAME_NOTE_SELECT = `
  select n.game_id, g.platform, g.external_id, g.title, n.estimate, n.note, n.updated_at
  from game_notes n join games g on g.id = n.game_id
`;

export function listGameNotes(userId: number): GameNote[] {
  return (db.prepare(`${GAME_NOTE_SELECT} where n.user_id = ? order by g.title collate nocase`).all(userId) as GameNoteRow[])
    .map(mapGameNote);
}

export function getGameNote(userId: number, gameId: number): GameNote | null {
  const row = db.prepare(`${GAME_NOTE_SELECT} where n.user_id = ? and n.game_id = ?`).get(userId, gameId) as GameNoteRow | undefined;
  return row ? mapGameNote(row) : null;
}

/** The game must exist (FK); the route checks ownership before calling. */
export function upsertGameNote(userId: number, gameId: number, input: GameNoteInput): GameNote {
  db.prepare(`
    insert into game_notes (user_id, game_id, estimate, note, updated_at)
    values (@userId, @gameId, @estimate, @note, @updatedAt)
    on conflict(user_id, game_id) do update set
      estimate = case when @hasEstimate = 1 then excluded.estimate else game_notes.estimate end,
      note = case when @hasNote = 1 then excluded.note else game_notes.note end,
      updated_at = excluded.updated_at
  `).run({
    userId,
    gameId,
    estimate: input.estimate ?? null,
    note: input.note ?? '',
    hasEstimate: input.estimate !== undefined ? 1 : 0,
    hasNote: input.note !== undefined ? 1 : 0,
    updatedAt: now(),
  });
  const saved = getGameNote(userId, gameId);
  if (!saved) throw new PlanNotFoundError('Note');
  return saved;
}

export function deleteGameNote(userId: number, gameId: number): boolean {
  return db.prepare('delete from game_notes where user_id = ? and game_id = ?').run(userId, gameId).changes > 0;
}
