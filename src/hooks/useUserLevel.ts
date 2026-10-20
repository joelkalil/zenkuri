import { useEffect, useState } from 'react';
import { fetchUserLevel, type UserLevel } from '../lib/api';
import { useSteam } from '../context/SteamContext';

/**
 * Nível da conta. Recarrega sozinho quando um sync termina (`lastSyncAt` muda),
 * que é o único momento em que novas conquistas podem entrar no cálculo.
 */
export function useUserLevel() {
  const { lastSyncAt } = useSteam();
  const [level, setLevel] = useState<UserLevel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUserLevel()
      .then((value) => {
        if (cancelled) return;
        setLevel(value);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Falha ao carregar o nível');
      });
    return () => {
      cancelled = true;
    };
  }, [lastSyncAt]);

  return { level, error, loading: !level && !error };
}
