import type { AchievementWithStatus, Game, PatinaDb, Platform, UnlockItem } from '../types/steam';

const TOKEN_KEY = 'zenkuri-token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    setAuthToken(null);
    window.dispatchEvent(new Event('zenkuri-unauthorized'));
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `API error ${res.status}`);
  return json as T;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
}

export function authRegister(input: { username: string; password: string; displayName?: string }) {
  return apiFetch<{ user: AuthUser; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function authLogin(input: { username: string; password: string }) {
  return apiFetch<{ user: AuthUser; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function authLogout() {
  return apiFetch<{ ok: true }>('/api/auth/logout', { method: 'POST' });
}

export function authMe() {
  return apiFetch<{ user: AuthUser }>('/api/auth/me');
}

export function authChangePassword(input: { currentPassword: string; newPassword: string }) {
  return apiFetch<{ ok: true }>('/api/auth/password', { method: 'POST', body: JSON.stringify(input) });
}

export function authUpdateProfile(input: { displayName: string }) {
  return apiFetch<{ user: AuthUser }>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(input) });
}

export interface PublicCredential {
  platform: Platform;
  /** identificador público vinculado (SteamID64, online ID da PSN ou username do RA) */
  identifier: string;
  verified: boolean;
  configured: boolean;
  /** código de verificação, presente apenas enquanto o vínculo está pendente */
  code?: string;
  updatedAt: string;
}

export function getConfig() {
  return apiFetch<{ configured: { platform: Platform; updatedAt: string; verified: boolean }[]; credentials: PublicCredential[] }>('/api/config');
}

export interface SyncRun {
  id: number;
  platform: Platform;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  message: string | null;
}

export function fetchSyncRuns() {
  return apiFetch<{ runs: SyncRun[]; latest: Record<string, { startedAt: string; status: string; finishedAt: string | null }> }>('/api/sync/runs');
}

export interface CompletionHistoryItem {
  game: Game;
  completedAt: number;
  kind: 'platinum' | 'perfect';
}

export function fetchRecentCompletions(limit = 8) {
  return apiFetch<{ platinums: CompletionHistoryItem[]; perfects: CompletionHistoryItem[] }>(
    `/api/completions/recent?limit=${limit}`,
  );
}

export function fetchUnlocks(year?: number) {
  const suffix = year ? `?year=${year}` : '';
  return apiFetch<{ year: number; years: number[]; unlocks: UnlockItem[] }>(`/api/unlocks${suffix}`);
}

export interface LevelSlice {
  key: string;
  label: string;
  achievements: number;
  xp: number;
}

export interface UserLevel {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  tier: { key: string; label: string; minLevel: number; accent: string };
  nextTier: { key: string; label: string; minLevel: number; accent: string } | null;
  counts: { achievements: number; rare: number; platinums: number; perfects: number };
  breakdown: { platforms: LevelSlice[]; rarity: LevelSlice[]; bonusXp: number };
}

/** Nível da conta, calculado a partir de todas as conquistas desbloqueadas. */
export function fetchUserLevel() {
  return apiFetch<UserLevel>('/api/level');
}

export type PlatformLevel =
  | { platform: 'steam'; status: 'ok'; level: number; xp: number; xpIntoLevel: number; xpForNextLevel: number; progressPercent: number }
  | { platform: 'psn'; status: 'ok'; level: number; progressPercent: number; tier: number; grade: 'Bronze' | 'Prata' | 'Ouro' | 'Platina'; trophies: { platinum: number; gold: number; silver: number; bronze: number } }
  | { platform: 'retroachievements'; status: 'ok'; points: number; softcorePoints: number; truePoints: number; rank: number | null; totalRanked: number | null }
  | { platform: Platform; status: 'unlinked' }
  | { platform: Platform; status: 'error'; message: string };

/** Nível que cada plataforma mostra no próprio perfil, consultado ao vivo. */
export function fetchPlatformLevels(fresh = false) {
  return apiFetch<{ items: PlatformLevel[] }>(`/api/level/platforms${fresh ? '?fresh=1' : ''}`).then((res) => res.items);
}

export function fetchRarestUnlocked(limit = 3) {
  return apiFetch<{ items: UnlockItem[] }>(`/api/showcase/rarest?limit=${limit}`).then((res) => res.items);
}

export function clearMediaCache() {
  return apiFetch<{ removed: boolean }>('/api/media/clear', { method: 'POST' });
}

export function resetPlanning(scope: 'all' | 'notes' | 'backlog') {
  return apiFetch<PatinaDb>('/api/planning/reset', { method: 'POST', body: JSON.stringify({ scope }) });
}

export function importPlanning(record: Partial<PatinaDb>) {
  return apiFetch<PatinaDb>('/api/planning/import', { method: 'POST', body: JSON.stringify(record) });
}

/** Vincula uma conta de plataforma pelo identificador público e retorna o código de verificação. */
export function linkPlatformAccount(platform: Platform, identifier: string) {
  return apiFetch<{ ok: true; credential: PublicCredential }>(`/api/config/${platform}`, {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

/** Confere se o código de verificação já está na descrição do perfil. */
export function verifyPlatformAccount(platform: Platform) {
  return apiFetch<{ ok: true; credential: PublicCredential }>(`/api/config/${platform}/verify`, { method: 'POST' });
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

export interface PlatformSyncResult {
  platform: Platform;
  ok: boolean;
  count?: number;
  achievementSets?: number;
  detailErrors?: number;
  lastDetailError?: string;
  /** Mensagem amigável (ex.: key da Steam inválida) quando `ok` é false. */
  error?: string;
}

export function syncPlatform(platform: Platform) {
  return apiFetch<PlatformSyncResult>(`/api/sync/${platform}`, { method: 'POST' });
}

export function syncAllPlatforms() {
  return apiFetch<{ ok: boolean; results: PlatformSyncResult[] }>('/api/sync', { method: 'POST' });
}

export function fetchPlanning() {
  return apiFetch<PatinaDb>('/api/planning');
}

export function patchPlanning(gameId: string, patch: Record<string, unknown>) {
  return apiFetch<PatinaDb>(`/api/planning/${gameId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function createCollectionApi(name: string, gameIds: string[] = []) {
  return apiFetch<PatinaDb>('/api/collections', { method: 'POST', body: JSON.stringify({ name, gameIds }) });
}

export function renameCollectionApi(id: number, name: string) {
  return apiFetch<PatinaDb>(`/api/collections/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export function deleteCollectionApi(id: number) {
  return apiFetch<PatinaDb>(`/api/collections/${id}`, { method: 'DELETE' });
}

export function reorderBacklogApi(order: string[]) {
  return apiFetch<PatinaDb>('/api/planning/backlog/reorder', {
    method: 'POST',
    body: JSON.stringify({ order }),
  });
}
