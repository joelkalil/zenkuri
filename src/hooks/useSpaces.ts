import { useEffect, useState } from 'react';
import { fetchCommunitySpaces } from '../lib/api';

/** Display name of each community space, by slug. Fails silently: the slug is the fallback. */
export function useSpaceNames() {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { spaces } = await fetchCommunitySpaces();
        if (!cancelled) setNames(Object.fromEntries(spaces.map((space) => [space.slug, space.name])));
      } catch {
        // No names: the attribution falls back to the space slug.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return names;
}
