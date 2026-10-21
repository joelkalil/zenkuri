import { useEffect, useState } from 'react';
import { fetchAutoCollections } from '../lib/api';
import { useSteam } from '../context/SteamContext';
import type { AutoCollections } from '../types/steam';

const EMPTY: AutoCollections = { franchises: [], companies: [] };

/**
 * Franquias e empresas derivadas no servidor. Recarrega quando um sync termina
 * (`lastSyncAt`), pois é quando novos jogos e metadados de loja podem chegar.
 */
export function useAutoCollections() {
  const { lastSyncAt } = useSteam();
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
        setError(err instanceof Error ? err.message : 'Falha ao carregar as coleções automáticas');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lastSyncAt]);

  return { data, loading, error };
}
