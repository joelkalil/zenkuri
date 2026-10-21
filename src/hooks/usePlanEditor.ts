import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  createPlanEntryApi,
  createPlanMilestoneApi,
  createPlanPhaseApi,
  createPlanRiskApi,
  createPlanVacationApi,
  deletePlanEntryApi,
  deletePlanMilestoneApi,
  deletePlanPhaseApi,
  deletePlanRiskApi,
  deletePlanVacationApi,
  fetchPlan,
  reorderPlanEntriesApi,
  reorderPlanMilestonesApi,
  reorderPlanPhasesApi,
  reorderPlanRisksApi,
  reorderPlanVacationsApi,
  updatePlanApi,
  updatePlanEntryApi,
  updatePlanMilestoneApi,
  updatePlanPhaseApi,
  updatePlanRiskApi,
  updatePlanVacationApi,
  type PlanEntryPatchInput,
} from '../lib/api';
import type {
  Plan,
  PlanEntry,
  PlanEntryInput,
  PlanInput,
  PlanMilestoneInput,
  PlanPhaseInput,
  PlanRiskInput,
  PlanSection,
  PlanVacationInput,
} from '../types/plan';

type Direction = -1 | 1;

/** Loose plan lists (outside the phases), by section. */
type LooseSection = Exclude<PlanSection, 'phase'>;

const LOOSE_KEY = {
  recurring: 'recurring',
  after: 'afterPlan',
  accept: 'acceptAsIs',
  if_time: 'ifTime',
} as const satisfies Record<LooseSection, keyof Plan>;

interface Positioned {
  id: number;
  position: number;
}

function withPositions<T extends Positioned>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, position: index }));
}

function moved<T extends Positioned>(items: T[], id: number, direction: Direction): T[] | null {
  const from = items.findIndex((item) => item.id === id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= items.length) return null;
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return withPositions(next);
}

function patched<T extends Positioned>(items: T[], id: number, patch: object): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...definedOnly(patch) } : item));
}

function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function mapEntries(plan: Plan, change: (entries: PlanEntry[]) => PlanEntry[]): Plan {
  return {
    ...plan,
    phases: plan.phases.map((phase) => ({ ...phase, entries: change(phase.entries) })),
    recurring: change(plan.recurring),
    afterPlan: change(plan.afterPlan),
    acceptAsIs: change(plan.acceptAsIs),
    ifTime: change(plan.ifTime),
  };
}

function entryScopeIds(plan: Plan, entry: PlanEntry): PlanEntry[] {
  if (entry.section === 'phase') return plan.phases.find((phase) => phase.id === entry.phaseId)?.entries ?? [];
  return plan[LOOSE_KEY[entry.section]] as PlanEntry[];
}

interface Mutation<T> {
  /** applied immediately; absent = waits for the response (creations, which depend on the server id) */
  optimistic?: (plan: Plan) => Plan;
  request: () => Promise<T>;
  /** applies the server response after success */
  reconcile?: (plan: Plan, result: T) => Plan;
}

export interface PlanEditor {
  /** requests in flight */
  pending: number;
  /** the thrown value of the last failure; describe it with `useErrorMessage` */
  error: unknown;
  dismissError: () => void;

  updatePlan: (patch: PlanInput) => Promise<boolean>;

  addPhase: (input: PlanPhaseInput) => Promise<boolean>;
  updatePhase: (id: number, patch: Partial<PlanPhaseInput>) => Promise<boolean>;
  deletePhase: (id: number) => Promise<boolean>;
  movePhase: (id: number, direction: Direction) => Promise<boolean>;

  addEntry: (input: PlanEntryInput) => Promise<boolean>;
  updateEntry: (entry: PlanEntry, patch: PlanEntryPatchInput) => Promise<boolean>;
  deleteEntry: (entry: PlanEntry) => Promise<boolean>;
  moveEntry: (entry: PlanEntry, direction: Direction) => Promise<boolean>;

  addMilestone: (input: PlanMilestoneInput) => Promise<boolean>;
  updateMilestone: (id: number, patch: Partial<PlanMilestoneInput>) => Promise<boolean>;
  deleteMilestone: (id: number) => Promise<boolean>;
  moveMilestone: (id: number, direction: Direction) => Promise<boolean>;

  addVacation: (input: PlanVacationInput) => Promise<boolean>;
  updateVacation: (id: number, patch: Partial<PlanVacationInput>) => Promise<boolean>;
  deleteVacation: (id: number) => Promise<boolean>;
  moveVacation: (id: number, direction: Direction) => Promise<boolean>;

  addRisk: (input: PlanRiskInput) => Promise<boolean>;
  updateRisk: (id: number, patch: Partial<PlanRiskInput>) => Promise<boolean>;
  deleteRisk: (id: number) => Promise<boolean>;
  moveRisk: (id: number, direction: Direction) => Promise<boolean>;
}

/**
 * Plan editing with optimistic updates. Edits, removals and reorders show up
 * immediately and are sent through a queue (one at a time). `planRef` is the
 * synchronous source of truth: every optimistic update and reconciliation
 * computes the next plan from it, assigns it to the ref and only then calls
 * `setPlan`, so two fast actions never work from a stale plan.
 *
 * If a request fails, the failure is kept in `error` and the resync is
 * deferred: it runs once, when the queue drains (the last queued job finished
 * and nothing is pending), so the optimistic edits of the jobs still queued are
 * not wiped. The resync re-reads the plan from the server; if that read also
 * fails, the plan goes back to the snapshot taken before the first failed
 * mutation. Creations wait for the response to get the id.
 */
export function usePlanEditor(plan: Plan, setPlan: Dispatch<SetStateAction<Plan | null>>): PlanEditor {
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const planRef = useRef(plan);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  /** Jobs started and not yet finished; a ref so it is accurate between renders. */
  const pendingRef = useRef(0);
  /** Snapshot from before the first failed mutation, or null when nothing failed. */
  const failedSnapshot = useRef<Plan | null>(null);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const commit = useCallback((next: Plan) => {
    planRef.current = next;
    setPlan(next);
  }, [setPlan]);

  const apply = useCallback((change: (current: Plan) => Plan) => {
    commit(change(planRef.current));
  }, [commit]);

  const resync = useCallback(async () => {
    const snapshot = failedSnapshot.current;
    if (!snapshot) return;
    failedSnapshot.current = null;
    let fresh: Plan | null | undefined;
    let fetched = true;
    try {
      fresh = await fetchPlan();
    } catch {
      fetched = false;
    }
    // A mutation started during the re-read: its optimistic edit must survive,
    // so keep the failure pending and resync again when the queue drains.
    if (pendingRef.current > 0) {
      failedSnapshot.current = snapshot;
      return;
    }
    if (!fetched) commit(snapshot);
    else if (fresh) commit(fresh);
  }, [commit]);

  const mutate = useCallback(async <T,>({ optimistic, request, reconcile }: Mutation<T>): Promise<boolean> => {
    const snapshot = planRef.current;
    if (optimistic) apply(optimistic);
    pendingRef.current += 1;
    setPending((count) => count + 1);
    setError(null);
    const run = queue.current.then(request, request);
    queue.current = run.catch(() => undefined);
    try {
      const result = await run;
      if (reconcile) apply((current) => reconcile(current, result));
      return true;
    } catch (err) {
      setError(err);
      failedSnapshot.current ??= snapshot;
      return false;
    } finally {
      pendingRef.current -= 1;
      setPending((count) => count - 1);
      if (pendingRef.current === 0) await resync();
    }
  }, [apply, resync]);

  return useMemo<PlanEditor>(() => ({
    pending,
    error,
    dismissError: () => setError(null),

    updatePlan: (patch) => mutate({
      optimistic: (current) => ({ ...current, ...definedOnly(patch) }),
      request: () => updatePlanApi(patch),
      reconcile: (current, saved) => ({ ...current, ...saved, phases: current.phases }),
    }),

    addPhase: (input) => mutate({
      request: () => createPlanPhaseApi(input),
      reconcile: (current, created) => ({ ...current, phases: [...current.phases, { ...created, entries: [] }] }),
    }),
    updatePhase: (id, patch) => mutate({
      optimistic: (current) => ({ ...current, phases: patched(current.phases, id, patch) }),
      request: () => updatePlanPhaseApi(id, patch),
      reconcile: (current, saved) => ({
        ...current,
        phases: current.phases.map((phase) => (phase.id === id ? { ...saved, entries: phase.entries } : phase)),
      }),
    }),
    deletePhase: (id) => mutate({
      optimistic: (current) => ({ ...current, phases: withPositions(current.phases.filter((phase) => phase.id !== id)) }),
      request: () => deletePlanPhaseApi(id),
    }),
    movePhase: (id, direction) => {
      const next = moved(planRef.current.phases, id, direction);
      if (!next) return Promise.resolve(true);
      return mutate({
        // `next` comes from planRef, which apply() reads too: ids and UI share one order
        optimistic: (current) => ({ ...current, phases: next }),
        request: () => reorderPlanPhasesApi(next.map((phase) => phase.id)),
      });
    },

    addEntry: (input) => mutate({
      request: () => createPlanEntryApi(input),
      reconcile: (current, created) => {
        if (created.section === 'phase') {
          return {
            ...current,
            phases: current.phases.map((phase) => (phase.id === created.phaseId ? { ...phase, entries: [...phase.entries, created] } : phase)),
          };
        }
        const key = LOOSE_KEY[created.section];
        return { ...current, [key]: [...(current[key] as PlanEntry[]), created] };
      },
    }),
    updateEntry: (entry, patch) => {
      const phaseChange = patch.phaseId !== undefined && patch.phaseId !== entry.phaseId;
      return mutate({
        optimistic: (current) => {
          const edited: PlanEntry = { ...entry, ...definedOnly(patch) };
          if (!phaseChange) return mapEntries(current, (entries) => entries.map((item) => (item.id === entry.id ? edited : item)));
          const without = mapEntries(current, (entries) => entries.filter((item) => item.id !== entry.id));
          return {
            ...without,
            phases: without.phases.map((phase) => (phase.id === patch.phaseId ? { ...phase, entries: [...phase.entries, edited] } : phase)),
          };
        },
        request: () => updatePlanEntryApi(entry.id, patch),
        reconcile: (current, saved) => mapEntries(current, (entries) => entries.map((item) => (item.id === saved.id ? saved : item))),
      });
    },
    deleteEntry: (entry) => mutate({
      optimistic: (current) => mapEntries(current, (entries) => (entries.some((item) => item.id === entry.id) ? withPositions(entries.filter((item) => item.id !== entry.id)) : entries)),
      request: () => deletePlanEntryApi(entry.id),
    }),
    moveEntry: (entry, direction) => {
      const ids = moved(entryScopeIds(planRef.current, entry), entry.id, direction)?.map((item) => item.id);
      if (!ids) return Promise.resolve(true);
      return mutate({
        optimistic: (current) => mapEntries(current, (entries) => (entries.some((item) => item.id === entry.id) ? moved(entries, entry.id, direction) ?? entries : entries)),
        request: () => reorderPlanEntriesApi({ section: entry.section, phaseId: entry.phaseId ?? undefined }, ids),
      });
    },

    addMilestone: (input) => mutate({
      request: () => createPlanMilestoneApi(input),
      reconcile: (current, created) => ({ ...current, milestones: [...current.milestones, created] }),
    }),
    updateMilestone: (id, patch) => mutate({
      optimistic: (current) => ({ ...current, milestones: patched(current.milestones, id, patch) }),
      request: () => updatePlanMilestoneApi(id, patch),
      reconcile: (current, saved) => ({ ...current, milestones: patched(current.milestones, id, saved) }),
    }),
    deleteMilestone: (id) => mutate({
      optimistic: (current) => ({ ...current, milestones: withPositions(current.milestones.filter((item) => item.id !== id)) }),
      request: () => deletePlanMilestoneApi(id),
    }),
    moveMilestone: (id, direction) => {
      const next = moved(planRef.current.milestones, id, direction);
      if (!next) return Promise.resolve(true);
      return mutate({
        // `next` comes from planRef, which apply() reads too: ids and UI share one order
        optimistic: (current) => ({ ...current, milestones: next }),
        request: () => reorderPlanMilestonesApi(next.map((item) => item.id)),
      });
    },

    addVacation: (input) => mutate({
      request: () => createPlanVacationApi(input),
      reconcile: (current, created) => ({ ...current, vacations: [...current.vacations, created] }),
    }),
    updateVacation: (id, patch) => mutate({
      optimistic: (current) => ({ ...current, vacations: patched(current.vacations, id, patch) }),
      request: () => updatePlanVacationApi(id, patch),
      reconcile: (current, saved) => ({ ...current, vacations: patched(current.vacations, id, saved) }),
    }),
    deleteVacation: (id) => mutate({
      optimistic: (current) => ({ ...current, vacations: withPositions(current.vacations.filter((item) => item.id !== id)) }),
      request: () => deletePlanVacationApi(id),
    }),
    moveVacation: (id, direction) => {
      const next = moved(planRef.current.vacations, id, direction);
      if (!next) return Promise.resolve(true);
      return mutate({
        // `next` comes from planRef, which apply() reads too: ids and UI share one order
        optimistic: (current) => ({ ...current, vacations: next }),
        request: () => reorderPlanVacationsApi(next.map((item) => item.id)),
      });
    },

    addRisk: (input) => mutate({
      request: () => createPlanRiskApi(input),
      reconcile: (current, created) => ({ ...current, risks: [...current.risks, created] }),
    }),
    updateRisk: (id, patch) => mutate({
      optimistic: (current) => ({ ...current, risks: patched(current.risks, id, patch) }),
      request: () => updatePlanRiskApi(id, patch),
      reconcile: (current, saved) => ({ ...current, risks: patched(current.risks, id, saved) }),
    }),
    deleteRisk: (id) => mutate({
      optimistic: (current) => ({ ...current, risks: withPositions(current.risks.filter((item) => item.id !== id)) }),
      request: () => deletePlanRiskApi(id),
    }),
    moveRisk: (id, direction) => {
      const next = moved(planRef.current.risks, id, direction);
      if (!next) return Promise.resolve(true);
      return mutate({
        // `next` comes from planRef, which apply() reads too: ids and UI share one order
        optimistic: (current) => ({ ...current, risks: next }),
        request: () => reorderPlanRisksApi(next.map((item) => item.id)),
      });
    },
  }), [mutate, pending, error]);
}
