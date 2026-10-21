import { useEffect, useState } from 'react';
import type { RankingList } from '../../server/rankings/types';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { fetchAutoRankings } from '../lib/api';

/** Automatic rankings (Finish now, Quick wins, Long hauls, Demanding) of the signed-in user. */
export function useAutoRankings() {
  const [lists, setLists] = useState<RankingList[]>([]);
  const [loading, setLoading] = useState(true);
  const describe = useErrorMessage();
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await fetchAutoRankings();
        if (cancelled) return;
        setLists(result.lists);
        setFailure(null);
      } catch (err) {
        if (!cancelled) setFailure(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const error = failure === null ? null : describe(failure, 'rankings.errors.load');

  return { lists, loading, error, retry: () => setAttempt((value) => value + 1) };
}
