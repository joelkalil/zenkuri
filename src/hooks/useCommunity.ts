import { useEffect, useState } from 'react';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { fetchCommunitySpaces, fetchPublications } from '../lib/api';
import type { CommunitySpace, ContentLanguage, PublicationSummary } from '../types/community';

/** `lang` attribute for authored pack content: the API tags every space and publication with its pack language. */
export function contentLang(item: { language: ContentLanguage }): ContentLanguage {
  return item.language;
}

/** Community spaces and the summary of every publication (read-only). */
export function useCommunity() {
  const [spaces, setSpaces] = useState<CommunitySpace[]>([]);
  const [publications, setPublications] = useState<PublicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const describe = useErrorMessage();
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [spaceResult, publicationResult] = await Promise.all([fetchCommunitySpaces(), fetchPublications()]);
        if (cancelled) return;
        setSpaces(spaceResult.spaces);
        setPublications(publicationResult.publications);
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

  const error = failure === null ? null : describe(failure, 'community.errors.load');

  return { spaces, publications, loading, error, retry: () => setAttempt((value) => value + 1) };
}
