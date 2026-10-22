import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useI18n } from '../i18n';
import { messageForCode, useErrorMessage } from '../i18n/useErrorMessage';
import {
  ApiError,
  fetchGames,
  getConfig,
  getSyncProgress,
  syncAllPlatforms,
  syncPlatform,
  type PlatformSyncResult,
  type SyncProgress,
} from '../lib/api';
import { PLATFORM_META } from '../lib/platforms';
import type { Game, Platform } from '../types/steam';

export interface CompletionEntry {
  percent: number;
  unlocked: number;
  total: number;
}

interface SteamContextValue {
  games: Game[];
  gamesWithStats: Game[];
  loading: boolean;
  error: string | null;
  completionMap: Map<number, CompletionEntry>;
  scanning: boolean;
  scanProgress: { done: number; total: number };
  configuredPlatforms: Platform[];
  /** epoch ms of the last successful sync, or null if never synced this install */
  lastSyncAt: number | null;
  /** average completion across tracked games (0–100) */
  overallPercent: number;
  /** Resolves to `false` when any platform failed (see `error` for the message). */
  sync: () => Promise<boolean>;
  /** Updates a single platform (same progress popup). Rejects with the API error. */
  syncOne: (platform: Platform) => Promise<PlatformSyncResult>;
  /** Per-source progress of the running (or just finished) update; `null` when there is none. */
  progress: SyncProgress | null;
}

/** How often the progress endpoint is polled while an update runs. */
const PROGRESS_POLL_MS = 750;
const HTTP_CONFLICT = 409;

const LAST_SYNC_KEY = 'zenkuri-last-sync';

const SteamContext = createContext<SteamContextValue | null>(null);

export function SteamProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const describeError = useErrorMessage();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [configuredPlatforms, setConfiguredPlatforms] = useState<Platform[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(() => {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? Number(raw) : null;
  });

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGames(await fetchGames());
    } catch (err) {
      setError(describeError(err, 'errors.context.loadGamesFailed'));
    } finally {
      setLoading(false);
    }
  }, [describeError]);

  useEffect(() => {
    loadGames();
  }, [loadGames, refreshToken]);

  const loadConfiguredPlatforms = useCallback(() => {
    getConfig()
      .then((config) => setConfiguredPlatforms(config.configured.map((entry) => entry.platform)))
      .catch(() => setConfiguredPlatforms([]));
  }, []);

  useEffect(() => {
    loadConfiguredPlatforms();
    window.addEventListener('zenkuri-config-updated', loadConfiguredPlatforms);
    return () => window.removeEventListener('zenkuri-config-updated', loadConfiguredPlatforms);
  }, [refreshToken, loadConfiguredPlatforms]);

  // Progress polling. `inFlightRef` avoids overlapping requests; the sequence
  // numbers make sure a slow, older response never overwrites a newer one.
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const requestSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  // runId of a run that was already finished before the current scan began: seeing it
  // again (finished) means it is a leftover, not this scan's run. Server ids only, no client clock.
  const leftoverRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** `force` skips the overlap guard (used for the final poll, which must not be dropped). */
  const pollProgress = useCallback(async (force = false): Promise<SyncProgress | null> => {
    if (inFlightRef.current && !force) return null;
    const seq = ++requestSeqRef.current;
    inFlightRef.current = true;
    try {
      const fetched = await getSyncProgress();
      const isLeftover =
        fetched?.finishedAt !== undefined && fetched.runId === leftoverRunIdRef.current;
      const next = isLeftover ? null : fetched;
      if (mountedRef.current && seq > appliedSeqRef.current) {
        appliedSeqRef.current = seq;
        setProgress(next);
      }
      return next;
    } catch {
      // Progress is cosmetic: a failed poll must never break the update itself.
      return null;
    } finally {
      if (seq === requestSeqRef.current) inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!scanning) return undefined;
    void pollProgress();
    const timer = setInterval(() => void pollProgress(), PROGRESS_POLL_MS);
    return () => clearInterval(timer);
  }, [scanning, pollProgress]);

  /** Another update (other tab or device) owns the run: follow its progress until it ends. */
  const waitForRunEnd = useCallback(async () => {
    while (mountedRef.current) {
      const current = await pollProgress(true);
      if (current === null || current.finishedAt !== undefined) return;
      await new Promise((resolve) => setTimeout(resolve, PROGRESS_POLL_MS));
    }
  }, [pollProgress]);

  const finishRun = useCallback(async () => {
    await pollProgress(true);
    if (!mountedRef.current) return;
    const now = Date.now();
    localStorage.setItem(LAST_SYNC_KEY, String(now));
    setLastSyncAt(now);
    setRefreshToken((token) => token + 1);
  }, [pollProgress]);

  /** Records the already-finished run (if any) so it is not mistaken for the one about to start. */
  const markLeftoverRun = useCallback(async () => {
    try {
      const current = await getSyncProgress();
      leftoverRunIdRef.current = current?.finishedAt !== undefined ? current.runId : null;
    } catch {
      // Cosmetic only: without a baseline, a leftover may flash briefly.
      leftoverRunIdRef.current = null;
    }
  }, []);

  const sync = useCallback(async () => {
    await markLeftoverRun();
    setScanning(true);
    setError(null);
    try {
      let failed: PlatformSyncResult[] = [];
      try {
        const response = await syncAllPlatforms();
        // The request itself can succeed (200 OK) even when a platform failed
        // inside (e.g. an invalid Steam key), which used to be silent.
        // `results[].ok` is the per-platform source of truth, not the promise.
        failed = response.results.filter((result) => !result.ok);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === HTTP_CONFLICT)) throw err;
        // Already running elsewhere: not a failure, just follow it.
        await waitForRunEnd();
        await finishRun();
        return true;
      }
      if (failed.length > 0) {
        setError(
          failed
            .map((result) =>
              t('errors.context.syncPlatformFailure', {
                platform: PLATFORM_META[result.platform].short,
                reason: messageForCode(t, result.code) ?? t('errors.context.syncUnknownFailure'),
              }),
            )
            .join(t('errors.context.syncJoiner')),
        );
      }
      await finishRun();
      return failed.length === 0;
    } catch (err) {
      setError(describeError(err, 'errors.context.syncFailed'));
      await pollProgress(true);
      return false;
    } finally {
      if (mountedRef.current) setScanning(false);
    }
  }, [describeError, finishRun, markLeftoverRun, pollProgress, t, waitForRunEnd]);

  const syncOne = useCallback(async (platform: Platform) => {
    await markLeftoverRun();
    setScanning(true);
    setError(null);
    try {
      const result = await syncPlatform(platform);
      await finishRun();
      return result;
    } catch (err) {
      await pollProgress(true);
      throw err;
    } finally {
      if (mountedRef.current) setScanning(false);
    }
  }, [finishRun, markLeftoverRun, pollProgress]);

  const completionMap = useMemo(() => {
    const map = new Map<number, CompletionEntry>();
    for (const game of games) {
      if (game.completion && game.completion.total > 0) {
        map.set(game.appid, game.completion);
      }
    }
    return map;
  }, [games]);

  const gamesWithStats = useMemo(
    () => games.filter((game) => completionMap.has(game.appid) || game.has_community_visible_stats),
    [games, completionMap],
  );

  const overallPercent = useMemo(() => {
    const entries = [...completionMap.values()];
    if (entries.length === 0) return 0;
    const sum = entries.reduce((acc, entry) => acc + entry.percent, 0);
    return Math.round(sum / entries.length);
  }, [completionMap]);

  return (
    <SteamContext.Provider value={{
      games,
      gamesWithStats,
      loading,
      error,
      completionMap,
      scanning,
      scanProgress: { done: scanning ? 0 : games.length, total: games.length },
      configuredPlatforms,
      lastSyncAt,
      overallPercent,
      sync,
      syncOne,
      progress,
    }}>
      {children}
    </SteamContext.Provider>
  );
}

export function useSteam() {
  const ctx = useContext(SteamContext);
  if (!ctx) throw new Error('useSteam must be inside SteamProvider');
  return ctx;
}
