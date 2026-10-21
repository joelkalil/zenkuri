import { useEffect, useState } from 'react';
import { fetchUserLevel, type UserLevel } from '../lib/api';
import { useSteam } from '../context/SteamContext';
import { useErrorMessage } from '../i18n/useErrorMessage';

/**
 * Account level. Reloads itself when a sync finishes (`lastSyncAt` changes),
 * the only moment new achievements can enter the calculation.
 */
export function useUserLevel() {
  const { lastSyncAt } = useSteam();
  const [level, setLevel] = useState<UserLevel | null>(null);
  const describe = useErrorMessage();
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUserLevel()
      .then((value) => {
        if (cancelled) return;
        setLevel(value);
        setFailure(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setFailure(err);
      });
    return () => {
      cancelled = true;
    };
  }, [lastSyncAt]);

  const error = failure === null ? null : describe(failure, 'hall.errors.level');

  return { level, error, loading: !level && !error };
}
