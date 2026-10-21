import { getGame } from '@retroachievements/api';
import { getGameStoreMeta, listGamesMissingStoreMeta, upsertGameStoreMeta } from './db';
import type { Platform } from './types';
import { raServiceAuth } from './serviceAuth';
import { fetchSteamStoreMeta, STEAM_META_BATCH_SIZE } from './steamStoreMeta';

export const STORE_META_RETRY_TTL_MS = 24 * 60 * 60 * 1000;

/** Constant error stored when RA's getGame fails; never the raw error. */
const RA_FETCH_FAILED = 'ra fetch failed';

export type StoreMetaPlatform = Extract<Platform, 'steam' | 'retroachievements'>;

export interface StoreMetaFillResult {
  attempted: number;
  stored: number;
  /** rows stored with `error` (item unavailable in the store). */
  recordedErrors: number;
  /** batches/games that failed transiently and stored nothing. */
  transientFailures: number;
}

export function isStoreMetaPlatform(platform: Platform): platform is StoreMetaPlatform {
  return platform === 'steam' || platform === 'retroachievements';
}

export function storeMetaRetryCutoff(): string {
  return new Date(Date.now() - STORE_META_RETRY_TTL_MS).toISOString();
}

/** RA returns a single developer/publisher text; empty becomes an empty list. */
export function raCredit(value: string | null | undefined): string[] {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? [] : [trimmed];
}

async function fillSteam(result: StoreMetaFillResult, onProgress?: (message: string) => void) {
  const missing = listGamesMissingStoreMeta('steam', storeMetaRetryCutoff())
    .filter((game) => /^\d+$/.test(game.externalId));
  result.attempted += missing.length;
  for (let start = 0; start < missing.length; start += STEAM_META_BATCH_SIZE) {
    const batch = missing.slice(start, start + STEAM_META_BATCH_SIZE);
    try {
      const items = await fetchSteamStoreMeta(batch.map((game) => game.externalId));
      const byAppid = new Map(items.map((item) => [item.appid, item]));
      for (const game of batch) {
        const item = byAppid.get(game.externalId);
        const meta = item ?? { developers: [], publishers: [], franchises: [], error: 'Steam store item missing from response' };
        upsertGameStoreMeta({ gameId: game.id, source: 'steam', ...meta });
        if (meta.error) result.recordedErrors += 1;
        else result.stored += 1;
      }
    } catch (error) {
      result.transientFailures += batch.length;
      onProgress?.(`steam batch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    onProgress?.(`steam ${Math.min(start + batch.length, missing.length)}/${missing.length}`);
  }
}

async function fillRetroAchievements(result: StoreMetaFillResult, onProgress?: (message: string) => void) {
  const missing = listGamesMissingStoreMeta('retroachievements', storeMetaRetryCutoff());
  result.attempted += missing.length;
  if (missing.length === 0) return;
  const authorization = raServiceAuth();
  const startedAt = new Date().toISOString();
  let done = 0;
  for (const game of missing) {
    done += 1;
    // The per-game sync may have stored the row after this list was built.
    const current = getGameStoreMeta([game.id]).find((row) => row.source === 'retroachievements');
    if (current && current.error === null && current.fetchedAt >= startedAt) {
      result.attempted -= 1;
      continue;
    }
    try {
      const info = await getGame(authorization, { gameId: Number(game.externalId) });
      upsertGameStoreMeta({
        gameId: game.id,
        source: 'retroachievements',
        developers: raCredit(info.developer),
        publishers: raCredit(info.publisher),
        franchises: [],
      });
      result.stored += 1;
    } catch (error) {
      upsertGameStoreMeta({ gameId: game.id, source: 'retroachievements', developers: [], publishers: [], franchises: [], error: RA_FETCH_FAILED });
      result.recordedErrors += 1;
      onProgress?.(`ra ${game.externalId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (done % 25 === 0) onProgress?.(`ra ${done}/${missing.length}`);
  }
}

const inflight = new Map<StoreMetaPlatform, Promise<StoreMetaFillResult>>();
const rerunRequested = new Set<StoreMetaPlatform>();

async function runFill(platform: StoreMetaPlatform, onProgress?: (message: string) => void): Promise<StoreMetaFillResult> {
  const result: StoreMetaFillResult = { attempted: 0, stored: 0, recordedErrors: 0, transientFailures: 0 };
  if (platform === 'steam') await fillSteam(result, onProgress);
  else await fillRetroAchievements(result, onProgress);
  return result;
}

/**
 * Fills missing metadata (and redoes errors older than 24h) for the platform.
 * One run per platform at a time; throws only if the service credential is missing.
 * A call made during a run flags a "rerun": exactly one more pass runs when it
 * finishes, to pick up games synced after the current pass built its list.
 */
export function fillStoreMeta(platform: StoreMetaPlatform, onProgress?: (message: string) => void): Promise<StoreMetaFillResult> {
  const pending = inflight.get(platform);
  if (pending) {
    rerunRequested.add(platform);
    return pending;
  }
  const task = (async () => {
    try {
      let result = await runFill(platform, onProgress);
      if (rerunRequested.delete(platform)) result = await runFill(platform, onProgress);
      return result;
    } finally {
      rerunRequested.delete(platform);
      inflight.delete(platform);
    }
  })();
  inflight.set(platform, task);
  return task;
}

/** Non-blocking trigger used by sync: never propagates failures. */
export function scheduleStoreMetaFill(platform: Platform): void {
  if (!isStoreMetaPlatform(platform)) return;
  fillStoreMeta(platform).catch((error: unknown) => {
    console.warn(`[store-meta] ${platform} fill skipped:`, error instanceof Error ? error.message : error);
  });
}
