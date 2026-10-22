import type { CommunitySpace, Publication, PublicationKind, PublicationSummary } from '../types/community';
import type {
  GameNote,
  GameNoteInput,
  Plan,
  PlanEntry,
  PlanEntryInput,
  PlanInput,
  PlanMilestone,
  PlanMilestoneInput,
  PlanPhase,
  PlanPhaseInput,
  PlanRisk,
  PlanRiskInput,
  PlanSection,
  PlanVacation,
  PlanVacationInput,
} from '../types/plan';
import type { ApiErrorBody, ApiErrorCode } from '../../server/errorCodes';
import type { RankingList } from '../../server/rankings/types';
import { ApiError } from './apiError';
import type { AchievementWithStatus, AutoCollections, Game, PatinaDb, Platform, UnlockItem } from '../types/steam';

export { ApiError } from './apiError';

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
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (cause) {
    throw new ApiError('Could not reach the server', 0, 'network.unreachable', undefined, { cause });
  }
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    setAuthToken(null);
    window.dispatchEvent(new Event('zenkuri-unauthorized'));
  }
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = (typeof json === 'object' && json !== null ? json : {}) as Partial<ApiErrorBody>;
    throw new ApiError(body.error ?? `API error ${res.status}`, res.status, body.code, body.details);
  }
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
  /** linked public identifier (SteamID64, PSN online ID or RA username) */
  identifier: string;
  verified: boolean;
  configured: boolean;
  /** verification code, present only while the link is pending */
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

/** Account level, computed from every unlocked achievement. */
export function fetchUserLevel() {
  return apiFetch<UserLevel>('/api/level');
}

export type PlatformLevel =
  | { platform: 'steam'; status: 'ok'; level: number; xp: number; xpIntoLevel: number; xpForNextLevel: number; progressPercent: number }
  | { platform: 'psn'; status: 'ok'; level: number; progressPercent: number; tier: number; grade: 'Bronze' | 'Prata' | 'Ouro' | 'Platina'; trophies: { platinum: number; gold: number; silver: number; bronze: number } }
  | { platform: 'retroachievements'; status: 'ok'; points: number; softcorePoints: number; truePoints: number; rank: number | null; totalRanked: number | null }
  | { platform: Platform; status: 'unlinked' }
  | { platform: Platform; status: 'error'; message: string; code?: ApiErrorCode };

/** Level each platform shows on its own profile, queried live. */
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

/** Links a platform account by its public identifier and returns the verification code. */
export function linkPlatformAccount(platform: Platform, identifier: string) {
  return apiFetch<{ ok: true; credential: PublicCredential }>(`/api/config/${platform}`, {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

/** Checks whether the verification code is already in the profile description. */
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
  /** English default message (e.g. rejected Steam key) when `ok` is false. */
  error?: string;
  /** Stable code for `error`; render it through i18n instead of the message. */
  code?: ApiErrorCode;
}

export function syncPlatform(platform: Platform) {
  return apiFetch<PlatformSyncResult>(`/api/sync/${platform}`, { method: 'POST' });
}

/** Step of one source during an update; mirrors `SyncStepStatus` on the server. */
export type SyncStepStatus = 'queued' | 'library' | 'media' | 'achievements' | 'done' | 'error';

export interface PlatformProgress {
  platform: Platform;
  status: SyncStepStatus;
  done: number;
  total: number;
  /** Weighted 0-100. */
  percent: number;
  errorCode?: string;
}

export interface SyncProgress {
  runId: string;
  startedAt: number;
  finishedAt?: number;
  platforms: PlatformProgress[];
}

/** Progress of the user's current (or just finished) update, or `null` when there is none. */
export function getSyncProgress() {
  return apiFetch<{ progress: SyncProgress | null }>('/api/sync/progress').then((res) => res.progress);
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

export function fetchAutoCollections() {
  return apiFetch<AutoCollections>('/api/collections/auto');
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

// ─── Personal plan ──────────────────────────────────────────────────────────

const jsonBody = (value: unknown): RequestInit['body'] => JSON.stringify(value);

export function fetchPlan() {
  return apiFetch<Plan | null>('/api/plan');
}

export function createPlanApi(input: PlanInput = {}) {
  return apiFetch<Plan>('/api/plan', { method: 'POST', body: jsonBody(input) });
}

export function updatePlanApi(patch: PlanInput) {
  return apiFetch<Plan>('/api/plan', { method: 'PATCH', body: jsonBody(patch) });
}

export function createPlanPhaseApi(input: PlanPhaseInput) {
  return apiFetch<Omit<PlanPhase, 'entries'>>('/api/plan/phases', { method: 'POST', body: jsonBody(input) });
}

export function updatePlanPhaseApi(id: number, patch: Partial<PlanPhaseInput>) {
  return apiFetch<Omit<PlanPhase, 'entries'>>(`/api/plan/phases/${id}`, { method: 'PATCH', body: jsonBody(patch) });
}

export function deletePlanPhaseApi(id: number) {
  return apiFetch<{ ok: true }>(`/api/plan/phases/${id}`, { method: 'DELETE' });
}

export function reorderPlanPhasesApi(ids: number[]) {
  return apiFetch<Plan>('/api/plan/phases/reorder', { method: 'POST', body: jsonBody({ ids }) });
}

export function createPlanEntryApi(input: PlanEntryInput) {
  return apiFetch<PlanEntry>('/api/plan/entries', { method: 'POST', body: jsonBody(input) });
}

export type PlanEntryPatchInput = Partial<Omit<PlanEntryInput, 'section'>>;

export function updatePlanEntryApi(id: number, patch: PlanEntryPatchInput) {
  return apiFetch<PlanEntry>(`/api/plan/entries/${id}`, { method: 'PATCH', body: jsonBody(patch) });
}

export function deletePlanEntryApi(id: number) {
  return apiFetch<{ ok: true }>(`/api/plan/entries/${id}`, { method: 'DELETE' });
}

/** Reorders within a phase (`phaseId`) or a loose section. */
export function reorderPlanEntriesApi(scope: { section: PlanSection; phaseId?: number }, ids: number[]) {
  return apiFetch<Plan>('/api/plan/entries/reorder', { method: 'POST', body: jsonBody({ ...scope, ids }) });
}

export function createPlanMilestoneApi(input: PlanMilestoneInput) {
  return apiFetch<PlanMilestone>('/api/plan/milestones', { method: 'POST', body: jsonBody(input) });
}

export function updatePlanMilestoneApi(id: number, patch: Partial<PlanMilestoneInput>) {
  return apiFetch<PlanMilestone>(`/api/plan/milestones/${id}`, { method: 'PATCH', body: jsonBody(patch) });
}

export function deletePlanMilestoneApi(id: number) {
  return apiFetch<{ ok: true }>(`/api/plan/milestones/${id}`, { method: 'DELETE' });
}

export function reorderPlanMilestonesApi(ids: number[]) {
  return apiFetch<Plan>('/api/plan/milestones/reorder', { method: 'POST', body: jsonBody({ ids }) });
}

export function createPlanVacationApi(input: PlanVacationInput) {
  return apiFetch<PlanVacation>('/api/plan/vacations', { method: 'POST', body: jsonBody(input) });
}

export function updatePlanVacationApi(id: number, patch: Partial<PlanVacationInput>) {
  return apiFetch<PlanVacation>(`/api/plan/vacations/${id}`, { method: 'PATCH', body: jsonBody(patch) });
}

export function deletePlanVacationApi(id: number) {
  return apiFetch<{ ok: true }>(`/api/plan/vacations/${id}`, { method: 'DELETE' });
}

export function reorderPlanVacationsApi(ids: number[]) {
  return apiFetch<Plan>('/api/plan/vacations/reorder', { method: 'POST', body: jsonBody({ ids }) });
}

export function createPlanRiskApi(input: PlanRiskInput) {
  return apiFetch<PlanRisk>('/api/plan/risks', { method: 'POST', body: jsonBody(input) });
}

export function updatePlanRiskApi(id: number, patch: Partial<PlanRiskInput>) {
  return apiFetch<PlanRisk>(`/api/plan/risks/${id}`, { method: 'PATCH', body: jsonBody(patch) });
}

export function deletePlanRiskApi(id: number) {
  return apiFetch<{ ok: true }>(`/api/plan/risks/${id}`, { method: 'DELETE' });
}

export function reorderPlanRisksApi(ids: number[]) {
  return apiFetch<Plan>('/api/plan/risks/reorder', { method: 'POST', body: jsonBody({ ids }) });
}

// ─── Per-game notes ─────────────────────────────────────────────────────────

export function fetchGameNotes() {
  return apiFetch<{ notes: GameNote[] }>('/api/game-notes');
}

export function putGameNoteApi(gameId: number, input: GameNoteInput) {
  return apiFetch<GameNote>(`/api/game-notes/${gameId}`, { method: 'PUT', body: jsonBody(input) });
}

export function deleteGameNoteApi(gameId: number) {
  return apiFetch<{ ok: true }>(`/api/game-notes/${gameId}`, { method: 'DELETE' });
}

// ─── Community (read-only) ───────────────────────────────────────────

export function fetchCommunitySpaces() {
  return apiFetch<{ spaces: CommunitySpace[] }>('/api/community/spaces');
}

export function fetchPublications(kind?: PublicationKind) {
  const query = kind ? `?kind=${kind}` : '';
  return apiFetch<{ publications: PublicationSummary[] }>(`/api/community/publications${query}`);
}

export function fetchPublication<K extends PublicationKind>(space: string, kind: K, slug: string) {
  return apiFetch<Publication<K>>(
    `/api/community/publications/${encodeURIComponent(space)}/${kind}/${encodeURIComponent(slug)}`,
  );
}

// ─── Automatic rankings ───────────────────────────────────────────────────

/** Lists derived on the server from the user's library; the client joins them with `games` by `gameId`. */
export function fetchAutoRankings() {
  return apiFetch<{ lists: RankingList[] }>('/api/rankings');
}
