/*
  Imports the personal file into the database in a single transaction:
  the full plan (replaceable with `replace`) and per-game notes. With `notesOnly` the plan is left alone and only the
  notes are upserted (e.g. after syncing games that were missing earlier).
*/

import { db } from '../db';
import { createPlanIfMissing, deletePlan, getPlanByUser, insertEntry, insertMilestone, insertPhase, insertRisk, insertVacation, upsertGameNote } from '../plan/store';
import type { PlanSection } from '../../src/types/plan';
import type { PersonalEntry, PersonalFile } from './file';

export class PersonalImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonalImportError';
  }
}

export interface PersonalImportResult {
  planImported: boolean;
  phases: number;
  entries: number;
  milestones: number;
  vacations: number;
  risks: number;
  notesImported: number;
  warnings: string[];
}

export function importPersonal(userId: number, file: PersonalFile, options: { replace: boolean; notesOnly?: boolean }): PersonalImportResult {
  const result: PersonalImportResult = {
    planImported: false, phases: 0, entries: 0, milestones: 0, vacations: 0, risks: 0, notesImported: 0, warnings: [],
  };

  const run = db.transaction(() => {
    const plan = options.notesOnly ? undefined : file.plan;
    if (plan) {
      if (getPlanByUser(userId)) {
        if (!options.replace) {
          throw new PersonalImportError('the user already has a plan; use --replace to replace it.');
        }
        deletePlan(userId);
      }
      createPlanIfMissing(userId, {
        title: plan.title,
        principle: plan.principle,
        weeklyHours: plan.weeklyHours,
        baselineAvg: plan.baselineAvg,
        targetAvg: plan.targetAvg,
      }, `${plan.createdAt}T00:00:00.000Z`);

      const addEntries = (entries: readonly PersonalEntry[], section: PlanSection, phaseId?: number) => {
        for (const entry of entries) {
          insertEntry(userId, { ...entry, section, phaseId: phaseId ?? null });
          result.entries += 1;
        }
      };

      for (const phase of plan.phases) {
        const created = insertPhase(userId, {
          slug: phase.slug, title: phase.title, start: phase.start, end: phase.end,
          capacity: phase.capacity, summary: phase.summary, floating: phase.floating,
        });
        result.phases += 1;
        addEntries(phase.entries, 'phase', created.id);
      }
      addEntries(plan.recurring, 'recurring');
      addEntries(plan.afterPlan, 'after');
      addEntries(plan.acceptAsIs, 'accept');
      addEntries(plan.ifTime, 'if_time');
      for (const item of plan.milestones) {
        insertMilestone(userId, item);
        result.milestones += 1;
      }
      for (const item of plan.vacations) {
        insertVacation(userId, item);
        result.vacations += 1;
      }
      for (const item of plan.risks) {
        insertRisk(userId, item);
        result.risks += 1;
      }
      result.planImported = true;
    }

    const findGame = db.prepare('select id from games where platform = ? and external_id = ?');
    for (const note of file.gameNotes) {
      const game = findGame.get(note.platform, note.externalId) as { id: number } | undefined;
      if (!game) {
        result.warnings.push(`unknown game, note ignored: ${note.platform}:${note.externalId} (sync the game, then run again with --notes-only)`);
        continue;
      }
      upsertGameNote(userId, game.id, { estimate: note.estimate, note: note.note });
      result.notesImported += 1;
    }
  });
  run();
  return result;
}
