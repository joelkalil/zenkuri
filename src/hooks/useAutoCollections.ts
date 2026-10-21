import { useEffect, useState } from 'react';
import { fetchAutoCollections } from '../lib/api';
import { useSteam } from '../context/SteamContext';
import { useErrorMessage } from '../i18n/useErrorMessage';
import type { AutoCollections } from '../types/steam';

const EMPTY: AutoCollections = { franchises: [], companies: [] };

/**
 * Franchises and companies derived on the server. Reloads when a sync finishes
 * (`lastSyncAt`), since that is when new games and store metadata may arrive.
 */
export function useAutoCollections() {
  const { lastSyncAt } = useSteam();
  const describe = useErrorMessage();
  const [data, setData] = useState<AutoCollections>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAutoCollections()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(describe(err, 'collections.auto.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lastSyncAt, describe]);

  return { data, loading, error };
}
