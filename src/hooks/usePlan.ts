import { useCallback, useEffect, useState } from 'react';
import { fetchPlan } from '../lib/api';
import type { Plan } from '../types/plan';

/** The signed-in user's plan (`null` when it does not exist yet). `error` is the thrown value; describe it with `useErrorMessage`. */
export function usePlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const next = await fetchPlan();
        if (cancelled) return;
        setPlan(next);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { plan, loading, error, setPlan, reload };
}
