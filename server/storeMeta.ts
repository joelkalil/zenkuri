import { getGame } from '@retroachievements/api';
import { getGameStoreMeta, listGamesMissingStoreMeta, upsertGameStoreMeta } from './db';
import type { Platform } from './types';
import { raServiceAuth } from './serviceAuth';
import { fetchSteamStoreMeta, STEAM_META_BATCH_SIZE } from './steamStoreMeta';

export const STORE_META_RETRY_TTL_MS = 24 * 60 * 60 * 1000;

/** Erro constante gravado quando o getGame da RA falha; nunca o erro cru. */
const RA_FETCH_FAILED = 'ra fetch failed';

export type StoreMetaPlatform = Extract<Platform, 'steam' | 'retroachievements'>;

export interface StoreMetaFillResult {
  attempted: number;
  stored: number;
  /** linhas gravadas com `error` (item indisponível na loja). */
  recordedErrors: number;
  /** lotes/jogos que falharam de forma transitória e nada gravaram. */
  transientFailures: number;
}

export function isStoreMetaPlatform(platform: Platform): platform is StoreMetaPlatform {
  return platform === 'steam' || platform === 'retroachievements';
}

export function storeMetaRetryCutoff(): string {
  return new Date(Date.now() - STORE_META_RETRY_TTL_MS).toISOString();
}

/** RA devolve um único texto de developer/publisher; vazio vira lista vazia. */
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
    // O sync por jogo pode ter gravado a linha depois que esta lista foi montada.
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
 * Preenche metadados ausentes (e refaz erros com mais de 24h) da plataforma.
 * Uma execução por plataforma por vez; lança só se a credencial de serviço faltar.
 * Chamada durante uma execução marca "rerun": roda exatamente mais uma passada ao
 * terminar, para pegar jogos sincronizados depois que a lista da passada atual foi montada.
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

/** Disparo não bloqueante usado pelo sync: nunca propaga falha. */
export function scheduleStoreMetaFill(platform: Platform): void {
  if (!isStoreMetaPlatform(platform)) return;
  fillStoreMeta(platform).catch((error: unknown) => {
    console.warn(`[store-meta] ${platform} fill skipped:`, error instanceof Error ? error.message : error);
  });
}
