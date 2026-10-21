import { useEffect, useState } from 'react';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { fetchPublication, fetchPublications } from '../lib/api';
import type { PublicationSummary, Saga } from '../types/community';

export interface SagaWithMeta {
  saga: Saga;
  /** author, space, version and date of the publication */
  meta: PublicationSummary;
}

/** Sagas published in the community (payload + metadata of each publication). */
export function useSagas() {
  const [items, setItems] = useState<SagaWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const describe = useErrorMessage();
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { publications } = await fetchPublications('saga');
        const full = await Promise.all(publications.map((item) => fetchPublication(item.space, 'saga', item.slug)));
        if (cancelled) return;
        setItems(full.map((item) => ({ saga: { slug: item.slug, ...item.payload }, meta: item })));
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
  }, []);

  const error = failure === null ? null : describe(failure, 'saga.errors.load');

  return { items, loading, error };
}
