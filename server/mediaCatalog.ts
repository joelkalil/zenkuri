import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA_ROOT } from './mediaPaths';

/*
  Local game-art catalog
  ──────────────────────
  A JSON file next to the cached images (`data/media/catalog.json`) that records
  (a) which remote art we know about per game and (b) provenance for every file
  we wrote to disk. It is what lets us safely upgrade low-quality art (e.g. the
  square PSN trophy icon) without ever touching files the user dropped in by hand.
*/

export const ASSET_ORIGIN = {
  STEAM_LEGACY: 'steam-legacy',
  STEAM_STORE: 'steam-store',
  PSN_CONCEPT: 'psn-concept',
  PSN_TROPHY_ICON: 'psn-trophy-icon',
  RA: 'ra',
  DB: 'db',
} as const;

export type AssetOrigin = (typeof ASSET_ORIGIN)[keyof typeof ASSET_ORIGIN];
export type SlotOrigin = AssetOrigin | 'manual';
export type AssetKind = 'portrait' | 'cover' | 'hero' | 'icon';

export interface CatalogAsset {
  url: string;
  origin: AssetOrigin;
  imageType?: string;
}

export interface CatalogGame {
  title: string;
  updatedAt: string;
  assets: Partial<Record<AssetKind, CatalogAsset>>;
  psn?: { titleIds: string[]; conceptId?: number };
  /** Steam store lookup bookkeeping, used to negative-cache misses. */
  storeCheck?: { at: string; found: boolean };
}

export interface CatalogSlot {
  origin: SlotOrigin;
  url: string;
  sha256: string;
  fetchedAt: string;
}

export interface Catalog {
  version: 1;
  games: Record<string, CatalogGame>;
  slots: Record<string, CatalogSlot>;
  /** Slot path → epoch ms of the last time every source failed (failure TTL). */
  failures: Record<string, number>;
}

export const CATALOG_PATH = join(MEDIA_ROOT, 'catalog.json');
const WRITE_DEBOUNCE_MS = 500;

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function gameKey(platform: string, externalId: string): string {
  return `${platform}:${externalId}`;
}

export function slotKey(category: string, platform: string, base: string): string {
  return `${category}/${platform}/${base}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCatalog(value: unknown): value is Catalog {
  return isRecord(value) && value.version === 1 && isRecord(value.games) && isRecord(value.slots);
}

/** Drop malformed entries and fill missing containers so readers never throw. */
function repairCatalog(catalog: Catalog): Catalog {
  const games: Catalog['games'] = {};
  for (const [key, entry] of Object.entries(catalog.games)) {
    if (!isRecord(entry)) continue;
    const assets: CatalogGame['assets'] = {};
    if (isRecord(entry.assets)) {
      for (const [kind, asset] of Object.entries(entry.assets)) {
        if (isRecord(asset) && typeof asset.url === 'string' && typeof asset.origin === 'string') {
          assets[kind as AssetKind] = asset as unknown as CatalogAsset;
        }
      }
    }
    games[key] = { ...(entry as unknown as CatalogGame), assets };
  }
  const slots: Catalog['slots'] = {};
  for (const [key, slot] of Object.entries(catalog.slots)) {
    if (isRecord(slot) && typeof slot.sha256 === 'string') slots[key] = slot as unknown as CatalogSlot;
  }
  const failures: Catalog['failures'] = {};
  const rawFailures: unknown = (catalog as { failures?: unknown }).failures;
  if (isRecord(rawFailures)) {
    for (const [key, at] of Object.entries(rawFailures)) {
      if (typeof at === 'number' && Number.isFinite(at)) failures[key] = at;
    }
  }
  return { version: 1, games, slots, failures };
}

/** Pure read of a catalog file. Returns null when missing; throws when corrupt. */
export function readCatalogFile(path: string = CATALOG_PATH): Catalog | null {
  if (!existsSync(path)) return null;
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isCatalog(parsed)) throw new Error('Unexpected catalog shape');
  return repairCatalog(parsed);
}

let catalog: Catalog | null = null;
let timer: NodeJS.Timeout | null = null;
let dirty = false;

function emptyCatalog(): Catalog {
  return { version: 1, games: {}, slots: {}, failures: {} };
}

function load(): Catalog {
  if (catalog) return catalog;
  try {
    catalog = readCatalogFile() ?? emptyCatalog();
  } catch (error) {
    const quarantine = join(MEDIA_ROOT, `catalog.corrupt-${Date.now()}.json`);
    try { renameSync(CATALOG_PATH, quarantine); } catch { /* ignore */ }
    console.warn(`[catalog] corrupt catalog moved to ${quarantine}: ${(error as Error).message}`);
    catalog = emptyCatalog();
  }
  return catalog;
}

/** Atomic write: tmp file + rename. */
function flushSync() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!dirty || !catalog) return;
  dirty = false;
  try {
    mkdirSync(MEDIA_ROOT, { recursive: true });
    const tmp = `${CATALOG_PATH}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(catalog));
    renameSync(tmp, CATALOG_PATH);
  } catch (error) {
    dirty = true;
    console.warn(`[catalog] write failed: ${(error as Error).message}`);
  }
}

function scheduleWrite() {
  dirty = true;
  if (timer) return;
  timer = setTimeout(flushSync, WRITE_DEBOUNCE_MS);
  timer.unref();
}

process.once('exit', flushSync);
// Flush then exit ourselves: a signal listener suppresses Node's default exit.
// tsx watch restarts via SIGTERM, so exit promptly with the conventional code.
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]] as const) {
  process.once(signal, () => {
    flushSync();
    process.exit(code);
  });
}

export function getCatalogGame(platform: string, externalId: string): CatalogGame | undefined {
  return load().games[gameKey(platform, externalId)];
}

/** Merge a patch into a game entry (assets are merged per kind; `removeAssets` deletes kinds). */
export function updateCatalogGame(
  platform: string,
  externalId: string,
  title: string,
  patch: Partial<Omit<CatalogGame, 'title' | 'updatedAt'>>,
  removeAssets: AssetKind[] = [],
): void {
  const games = load().games;
  const key = gameKey(platform, externalId);
  const current = games[key];
  games[key] = {
    ...current,
    ...patch,
    title,
    assets: { ...current?.assets, ...patch.assets },
    updatedAt: new Date().toISOString(),
  };
  for (const kind of removeAssets) {
    if (!patch.assets?.[kind]) delete games[key].assets[kind];
  }
  scheduleWrite();
}

export function getCatalogAsset(platform: string, externalId: string, kind: AssetKind): CatalogAsset | undefined {
  return getCatalogGame(platform, externalId)?.assets[kind];
}

export function getCatalogSlot(key: string): CatalogSlot | undefined {
  return load().slots[key];
}

export function setCatalogSlot(key: string, origin: SlotOrigin, url: string, hash: string): void {
  load().slots[key] = { origin, url, sha256: hash, fetchedAt: new Date().toISOString() };
  scheduleWrite();
}

export function getSlotFailure(key: string): number | undefined {
  return load().failures[key];
}

export function setSlotFailure(key: string): void {
  load().failures[key] = Date.now();
  scheduleWrite();
}

export function clearSlotFailure(key: string): void {
  const failures = load().failures;
  if (!(key in failures)) return;
  delete failures[key];
  scheduleWrite();
}
