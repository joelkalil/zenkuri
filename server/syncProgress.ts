/*
  In-memory progress of the "Update" (sync) run, keyed by user. Nothing is
  persisted: the state only exists so the client can poll it while a request
  to POST /api/sync is still in flight. Finished state is dropped after a TTL.

  The registry is a factory with an injectable clock so it can be tested
  without Express (see syncProgress.test.ts).
*/
import { randomUUID } from 'node:crypto';
import type { Platform } from './types';

export const SYNC_STEP_STATUS = {
  QUEUED: 'queued',
  LIBRARY: 'library',
  MEDIA: 'media',
  ACHIEVEMENTS: 'achievements',
  DONE: 'done',
  ERROR: 'error',
} as const;

export type SyncStepStatus = (typeof SYNC_STEP_STATUS)[keyof typeof SYNC_STEP_STATUS];

export interface PlatformProgress {
  platform: Platform;
  status: SyncStepStatus;
  done: number;
  total: number;
  percent: number;
  errorCode?: string;
}

export interface SyncProgressState {
  runId: string;
  startedAt: number;
  finishedAt?: number;
  platforms: PlatformProgress[];
}

/** What a sync step reports while it runs. `done`/`total` only matter for achievements. */
export interface SyncStepUpdate {
  status: Exclude<SyncStepStatus, 'queued' | 'error'>;
  done?: number;
  total?: number;
}

/** Optional callback threaded through the sync pipeline; omitting it changes nothing. */
export type SyncReporter = (update: SyncStepUpdate) => void;

/** Keep the finished state around for this long so late polls still settle the bars. */
export const FINISHED_TTL_MS = 60_000;

/** An unfinished run with no progress for this long is considered abandoned (safety net). */
export const STALE_RUN_MS = 15 * 60_000;

// Weights of each step on the 0-100 scale.
const LIBRARY_START = 0;
const MEDIA_START = 10;
const ACHIEVEMENTS_START = 15;
const ACHIEVEMENTS_SPAN = 85;

/** Weighted percent (integer 0-100) of one platform. */
export function percentFor(status: SyncStepStatus, done: number, total: number, previous = 0): number {
  switch (status) {
    case 'queued': return 0;
    case 'library': return LIBRARY_START;
    case 'media': return MEDIA_START;
    case 'achievements': {
      if (total <= 0) return 100;
      const ratio = Math.min(1, Math.max(0, done / total));
      return Math.round(ACHIEVEMENTS_START + ACHIEVEMENTS_SPAN * ratio);
    }
    case 'done': return 100;
    case 'error': return previous;
  }
}

export interface SyncProgressRegistry {
  /**
   * Starts a run with every platform queued and returns its `runId`, or `null` when the user
   * already has a run in flight. Every call below must carry that `runId`: calls from a run
   * that was replaced (e.g. a stale one whose request is still alive) are ignored.
   */
  start(userId: number, platforms: Platform[]): string | null;
  update(userId: number, runId: string, platform: Platform, update: SyncStepUpdate): void;
  complete(userId: number, runId: string, platform: Platform): void;
  fail(userId: number, runId: string, platform: Platform, errorCode?: string): void;
  /** Marks the run as finished (also marks anything still queued/running as errored). */
  finish(userId: number, runId: string): void;
  isRunning(userId: number): boolean;
  /** Current state of the user, or `null` (never started, or expired). */
  get(userId: number): SyncProgressState | null;
}

interface RegistryOptions {
  now?: () => number;
  ttlMs?: number;
  staleMs?: number;
}

export function createSyncProgressRegistry(options: RegistryOptions = {}): SyncProgressRegistry {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? FINISHED_TTL_MS;
  const staleMs = options.staleMs ?? STALE_RUN_MS;
  const states = new Map<number, SyncProgressState>();
  // Last progress activity per user (internal; not part of the public state).
  const updatedAt = new Map<number, number>();

  function touch(userId: number) {
    updatedAt.set(userId, now());
  }

  function finalize(userId: number, state: SyncProgressState) {
    for (const item of state.platforms) {
      if (item.status !== 'done' && item.status !== 'error') item.status = 'error';
    }
    state.finishedAt = now();
    touch(userId);
  }

  function read(userId: number): SyncProgressState | null {
    const state = states.get(userId);
    if (!state) return null;
    // Safety net: a run that never finished (e.g. a bug skipped finish()) must not block forever.
    if (state.finishedAt === undefined && now() - (updatedAt.get(userId) ?? state.startedAt) >= staleMs) {
      finalize(userId, state);
    }
    if (state.finishedAt !== undefined && now() - state.finishedAt >= ttlMs) {
      states.delete(userId);
      updatedAt.delete(userId);
      return null;
    }
    return state;
  }

  /** The user's state, only when it still belongs to the given run. */
  function owned(userId: number, runId: string): SyncProgressState | null {
    const state = read(userId);
    return state?.runId === runId ? state : null;
  }

  function entry(userId: number, runId: string, platform: Platform): PlatformProgress | undefined {
    return owned(userId, runId)?.platforms.find((item) => item.platform === platform);
  }

  return {
    start(userId, platforms) {
      const current = read(userId);
      if (current && current.finishedAt === undefined) return null;
      const state: SyncProgressState = {
        runId: randomUUID(),
        startedAt: now(),
        platforms: platforms.map((platform) => ({
          platform,
          status: 'queued',
          done: 0,
          total: 0,
          percent: 0,
        })),
      };
      states.set(userId, state);
      touch(userId);
      return state.runId;
    },

    update(userId, runId, platform, update) {
      const item = entry(userId, runId, platform);
      if (!item || item.status === 'error' || item.status === 'done') return;
      touch(userId);
      item.status = update.status;
      item.done = update.done ?? item.done;
      item.total = update.total ?? item.total;
      item.percent = percentFor(item.status, item.done, item.total, item.percent);
    },

    complete(userId, runId, platform) {
      const item = entry(userId, runId, platform);
      if (!item || item.status === 'error') return;
      touch(userId);
      item.status = 'done';
      item.done = item.total;
      item.percent = 100;
    },

    fail(userId, runId, platform, errorCode) {
      const item = entry(userId, runId, platform);
      if (!item) return;
      touch(userId);
      item.percent = percentFor('error', item.done, item.total, item.percent);
      item.status = 'error';
      item.errorCode = errorCode;
    },

    finish(userId, runId) {
      const state = owned(userId, runId);
      if (!state || state.finishedAt !== undefined) return;
      finalize(userId, state);
    },

    isRunning(userId) {
      const state = read(userId);
      return state !== null && state.finishedAt === undefined;
    },

    get(userId) {
      return read(userId);
    },
  };
}

/** Process-wide registry used by the routes. */
export const syncProgress = createSyncProgressRegistry();
