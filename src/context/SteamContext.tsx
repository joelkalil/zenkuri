import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../i18n';
import { messageForCode, useErrorMessage } from '../i18n/useErrorMessage';
import { fetchGames, getConfig, syncAllPlatforms } from '../lib/api';
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
}

const LAST_SYNC_KEY = 'zenkuri-last-sync';

const SteamContext = createContext<SteamContextValue | null>(null);

export function SteamProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const describeError = useErrorMessage();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
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

  const sync = useCallback(() => {
    setScanning(true);
    setError(null);
    return syncAllPlatforms()
      .then((response) => {
        // The request itself can succeed (200 OK) even when a platform failed
        // inside (e.g. an invalid Steam key), which used to be silent.
        // `results[].ok` is the per-platform source of truth, not the promise.
        const failed = response.results.filter((result) => !result.ok);
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
        const now = Date.now();
        localStorage.setItem(LAST_SYNC_KEY, String(now));
        setLastSyncAt(now);
        setRefreshToken((token) => token + 1);
        return failed.length === 0;
      })
      .catch((err) => {
        setError(describeError(err, 'errors.context.syncFailed'));
        return false;
      })
      .finally(() => setScanning(false));
  }, [describeError, t]);

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
