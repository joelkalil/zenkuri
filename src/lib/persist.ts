/**
 * Persistent localStorage storage with no TTL.
 * Used for scanned achievement data that should survive page reloads
 * and only be cleared on explicit user action (Sync).
 */

export function persistSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* storage full — skip silently */ }
}

export function persistGet<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; }
  catch { localStorage.removeItem(key); return null; }
}

export function persistClearPrefix(prefix: string): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
  keys.forEach((k) => localStorage.removeItem(k));
}

/** Approximate bytes used by all platina: keys */
export function persistStorageBytes(): number {
  let bytes = 0;
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('platina:')) bytes += (localStorage.getItem(k)?.length ?? 0) * 2;
  }
  return bytes;
}
