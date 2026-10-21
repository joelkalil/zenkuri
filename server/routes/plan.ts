/*
  Plan and per-game note routes. Mounted under /api after requireAuth:
  everything is scoped to `req.userId`; ids of another user answer 404.
*/

import { Router, type Request, type RequestHandler, type Response } from 'express';
import { getGameById, userOwnsGame } from '../db';
import { ApiError, sendApiError, sendError } from '../errors';
import type { ApiErrorDetail } from '../errorCodes';
import type { Result } from '../validation';
import {
  createPlanIfMissing,
  deleteEntry,
  deleteGameNote,
  deleteMilestone,
  deletePhase,
  deleteRisk,
  deleteVacation,
  getPlanByUser,
  insertEntry,
  insertMilestone,
  insertPhase,
  insertRisk,
  insertVacation,
  listGameNotes,
  reorderEntries,
  reorderMilestones,
  reorderPhases,
  reorderRisks,
  reorderVacations,
  updateEntry,
  updateMilestone,
  updatePhase,
  updatePlan,
  updateRisk,
  updateVacation,
  upsertGameNote,
} from '../plan/store';
import {
  parseEntryInput,
  parseEntryPatch,
  parseGameNoteInput,
  parseMilestoneInput,
  parseMilestonePatch,
  parsePhaseInput,
  parsePhasePatch,
  parsePlanInput,
  parsePlanPatch,
  parseReorder,
  parseRiskInput,
  parseRiskPatch,
  parseVacationInput,
  parseVacationPatch,
  type ReorderInput,
} from '../plan/validate';

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function invalid(res: Response, errors: string[], details: ApiErrorDetail[]) {
  sendError(res, 400, 'validation.invalid', details, errors.join(' | '));
}

/** Maps the plan's typed domain errors (404/400/409) to responses; the rest falls to the global handler. */
function guard(handler: (req: Request, res: Response) => void): RequestHandler {
  return (req, res, next) => {
    try {
      handler(req, res);
    } catch (error) {
      if (error instanceof ApiError) {
        sendApiError(res, error);
      } else {
        next(error);
      }
    }
  };
}

interface CrudSpec<Item, Input, Patch> {
  parseInput: (body: unknown) => Result<Input>;
  parsePatch: (body: unknown) => Result<Patch>;
  insert: (userId: number, input: Input) => Item;
  update: (userId: number, id: number, patch: Patch) => Item;
  remove: (userId: number, id: number) => void;
  /** absent = the /reorder route is up to whoever assembles the router */
  reorder?: (userId: number, input: ReorderInput) => void;
}

/** POST / · PATCH /:id · DELETE /:id · POST /reorder; reorder returns the updated plan. */
function crudRouter<Item, Input, Patch>(spec: CrudSpec<Item, Input, Patch>): Router {
  const router = Router();

  router.post('/', guard((req, res) => {
    const parsed = spec.parseInput(req.body);
    if (!parsed.ok) return invalid(res, parsed.errors, parsed.details);
    res.status(201).json(spec.insert(req.userId!, parsed.value));
  }));

  const { reorder } = spec;
  if (reorder) {
    router.post('/reorder', guard((req, res) => {
      const parsed = parseReorder(req.body, { scoped: false });
      if (!parsed.ok) return invalid(res, parsed.errors, parsed.details);
      reorder(req.userId!, parsed.value);
      res.json(getPlanByUser(req.userId!));
    }));
  }

  router.patch('/:id', guard((req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return void sendError(res, 404, 'plan.item_not_found');
    const parsed = spec.parsePatch(req.body);
    if (!parsed.ok) return invalid(res, parsed.errors, parsed.details);
    res.json(spec.update(req.userId!, id, parsed.value));
  }));

  router.delete('/:id', guard((req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return void sendError(res, 404, 'plan.item_not_found');
    spec.remove(req.userId!, id);
    res.json({ ok: true });
  }));

  return router;
}

export const planRouter = Router();

planRouter.get('/', (req, res) => {
  res.json(getPlanByUser(req.userId!));
});

planRouter.post('/', guard((req, res) => {
  const parsed = parsePlanInput(req.body);
  if (!parsed.ok) return invalid(res, parsed.errors, parsed.details);
  const { plan, created } = createPlanIfMissing(req.userId!, parsed.value);
  if (!created) return void sendError(res, 409, 'plan.already_exists');
  res.status(201).json(plan);
}));

planRouter.patch('/', guard((req, res) => {
  const parsed = parsePlanPatch(req.body);
  if (!parsed.ok) return invalid(res, parsed.errors, parsed.details);
  res.json(updatePlan(req.userId!, parsed.value));
}));

planRouter.use('/phases', crudRouter({
  parseInput: parsePhaseInput,
  parsePatch: parsePhasePatch,
  insert: insertPhase,
  update: updatePhase,
  remove: deletePhase,
  reorder: (userId, input) => reorderPhases(userId, input.ids),
}));

// Entries: reordering is per scope (phase or section), so it has its own route.
const entriesRouter = crudRouter({
  parseInput: parseEntryInput,
  parsePatch: parseEntryPatch,
  insert: insertEntry,
  update: updateEntry,
  remove: deleteEntry,
});
entriesRouter.post('/reorder', guard((req, res) => {
  const parsed = parseReorder(req.body, { scoped: true });
  if (!parsed.ok) return invalid(res, parsed.errors, parsed.details);
  if (parsed.value.section === undefined) return invalid(res, ['body: section: required field is missing'], [{ field: 'section', code: 'required' }]);
  reorderEntries(req.userId!, { section: parsed.value.section, phaseId: parsed.value.phaseId }, parsed.value.ids);
  res.json(getPlanByUser(req.userId!));
}));
planRouter.use('/entries', entriesRouter);

planRouter.use('/milestones', crudRouter({
  parseInput: parseMilestoneInput,
  parsePatch: parseMilestonePatch,
  insert: insertMilestone,
  update: updateMilestone,
  remove: deleteMilestone,
  reorder: (userId, input) => reorderMilestones(userId, input.ids),
}));

planRouter.use('/vacations', crudRouter({
  parseInput: parseVacationInput,
  parsePatch: parseVacationPatch,
  insert: insertVacation,
  update: updateVacation,
  remove: deleteVacation,
  reorder: (userId, input) => reorderVacations(userId, input.ids),
}));

planRouter.use('/risks', crudRouter({
  parseInput: parseRiskInput,
  parsePatch: parseRiskPatch,
  insert: insertRisk,
  update: updateRisk,
  remove: deleteRisk,
  reorder: (userId, input) => reorderRisks(userId, input.ids),
}));

export const gameNotesRouter = Router();

gameNotesRouter.get('/', (req, res) => {
  res.json({ notes: listGameNotes(req.userId!) });
});

function ownedGameId(req: Request): number | null {
  const gameId = parseId(req.params.gameId);
  if (gameId === null || !getGameById(gameId) || !userOwnsGame(req.userId!, gameId)) return null;
  return gameId;
}

gameNotesRouter.put('/:gameId', guard((req, res) => {
  const gameId = ownedGameId(req);
  if (gameId === null) return void sendError(res, 404, 'game.not_found');
  const parsed = parseGameNoteInput(req.body);
  if (!parsed.ok) return invalid(res, parsed.errors, parsed.details);
  res.json(upsertGameNote(req.userId!, gameId, parsed.value));
}));

gameNotesRouter.delete('/:gameId', guard((req, res) => {
  const gameId = ownedGameId(req);
  if (gameId === null) return void sendError(res, 404, 'game.not_found');
  deleteGameNote(req.userId!, gameId);
  res.json({ ok: true });
}));
