import type { AchievementWithStatus, Game, PatinaDb, Platform } from '../types/steam';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `API error ${res.status}`);
  return json as T;
}

export function getConfig() {
  return apiFetch<{ configured: { platform: Platform; updatedAt: string }[]; credentials: unknown[] }>('/api/config');
}

export function saveSteamConfig(input: { key: string; steamid: string }) {
  return apiFetch<{ ok: true }>('/api/config/steam', { method: 'POST', body: JSON.stringify(input) });
}

export function saveRetroAchievementsConfig(input: { username: string; webApiKey: string }) {
  return apiFetch<{ ok: true }>('/api/config/retroachievements', { method: 'POST', body: JSON.stringify(input) });
}

export function savePsnConfig(input: { npsso: string }) {
  return apiFetch<{ ok: true }>('/api/config/psn', { method: 'POST', body: JSON.stringify(input) });
}

export function deletePlatformConfig(platform: Platform) {
  return apiFetch<{ ok: true }>(`/api/config/${platform}`, { method: 'DELETE' });
}

export function fetchGames(platform?: Platform) {
  const suffix = platform ? `?platform=${platform}` : '';
  return apiFetch<{ games: Game[] }>(`/api/games${suffix}`).then((res) => res.games);
}

export function fetchAchievements(gameId: number) {
  return apiFetch<{ achievements: AchievementWithStatus[] }>(`/api/games/${gameId}/achievements`)
    .then((res) => res.achievements);
}

export function syncPlatform(platform: Platform) {
  return apiFetch<{ ok: true; platform: Platform; count: number }>(`/api/sync/${platform}`, { method: 'POST' });
}

export function syncAllPlatforms() {
  return apiFetch<{ ok: true; results: unknown[] }>('/api/sync', { method: 'POST' });
}

export function fetchPlanning() {
  return apiFetch<PatinaDb>('/api/planning');
}

export function patchPlanning(gameId: string, patch: Record<string, unknown>) {
  return apiFetch<PatinaDb>(`/api/planning/${gameId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function reorderBacklogApi(order: string[]) {
  return apiFetch<PatinaDb>('/api/planning/backlog/reorder', {
    method: 'POST',
    body: JSON.stringify({ order }),
  });
}
