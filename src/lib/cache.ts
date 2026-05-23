const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export function cacheSet<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, expiresAt: Date.now() + TTL_MS };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full — silently skip
  }
}

export function cacheGet<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function cacheClearAll(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('steam-cache:'));
  keys.forEach((k) => localStorage.removeItem(k));
}
