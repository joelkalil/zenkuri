import { useEffect, useState } from 'react';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { fetchPublication, fetchPublications } from '../lib/api';
import type { Publication } from '../types/community';

/**
 * Curated ranking published in the community (today: `ranking/essenciais`).
 * `publication` stays `null` when the pack is not published.
 */
export function useCuratedRanking(slug: string) {
  const [publication, setPublication] = useState<Publication<'ranking'> | null>(null);
  const [loading, setLoading] = useState(true);
  const describe = useErrorMessage();
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { publications } = await fetchPublications('ranking');
        const summary = publications.find((item) => item.slug === slug);
        const full = summary ? await fetchPublication(summary.space, 'ranking', summary.slug) : null;
        if (cancelled) return;
        setPublication(full);
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
  }, [slug]);

  const error = failure === null ? null : describe(failure, 'rankings.errors.curated');

  return { publication, loading, error };
}
