import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';
import { db } from './db';
import type { Platform } from './types';
import {
  MEDIA_ROOT,
  PLACEHOLDER_MARKER,
  achievementSlot,
  coverSlot,
  assertInsideMediaRoot,
  heroSlot,
  iconSlot,
  isInsideMediaRoot,
  isMediaCategory,
  isMediaPlatform,
  isSafeSegment,
  isValidExternalId,
  portraitSlot,
  type MediaCategory,
} from './mediaPaths';
import {
  ASSET_ORIGIN,
  clearSlotFailure,
  getCatalogAsset,
  getCatalogSlot,
  getSlotFailure,
  setCatalogSlot,
  setSlotFailure,
  sha256,
  slotKey,
  type AssetKind,
  type AssetOrigin,
} from './mediaCatalog';
import { IMAGE_EXTS, isPlaceholderFile, slotFiles } from './mediaFiles';
import { steamStoreAssets } from './steamStoreAssets';

/** A download candidate and where it came from (recorded in the catalog). */
interface SourceCandidate {
  url: string;
  origin: AssetOrigin;
}

/** A candidate, or a lookup resolved only if earlier ones fail. */
type MediaSource = SourceCandidate | null | undefined | (() => Promise<SourceCandidate | null>);

type GameCategory = 'covers' | 'portraits' | 'heroes' | 'icons';

interface GameSourceRow {
  title: string;
  cover_url: string | null;
  icon_url: string | null;
}

function steamLegacyUrl(appid: string, file: string): SourceCandidate | null {
  if (!/^\d+$/.test(appid)) return null;
  return { url: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/${file}`, origin: ASSET_ORIGIN.STEAM_LEGACY };
}

function steamStoreSource(appid: string, title: string, kind: AssetKind): MediaSource {
  if (!/^\d+$/.test(appid)) return null;
  return async () => (await steamStoreAssets(appid, title))[kind] ?? null;
}

/** Cover-ish URL stored on the game row, tagged with the right provenance. */
function dbSource(platform: string, url: string | null | undefined): SourceCandidate | null {
  if (!url) return null;
  const origin = platform === 'psn' ? ASSET_ORIGIN.PSN_TROPHY_ICON : platform === 'ra' || platform === 'retroachievements' ? ASSET_ORIGIN.RA : ASSET_ORIGIN.DB;
  return { url, origin };
}

function catalogSource(platform: string, externalId: string, kind: AssetKind, origin: AssetOrigin): SourceCandidate | null {
  const asset = getCatalogAsset(platform, externalId, kind);
  return asset?.origin === origin ? { url: asset.url, origin } : null;
}

/**
 * Single source of truth for where a game's art comes from, in priority order.
 * Used by both the lazy `/media` route and the sync-time warmer.
 *
 *   steam  portrait: legacy 600x900 → store capsule → cover_url
 *          cover:    cover_url → store header → store main capsule
 *          hero:     legacy hero → store hero → cover_url
 *          icon:     icon_url → store community icon
 *   psn    portrait/cover: catalog concept art → trophy icon (cover_url)
 *          hero:     catalog concept art → none (placeholder)
 *   other  cover_url / icon_url
 */
function mediaSources(category: GameCategory, platform: string, externalId: string, row: GameSourceRow | undefined): MediaSource[] {
  const title = row?.title ?? externalId;
  const cover = dbSource(platform, row?.cover_url);
  const icon = dbSource(platform, row?.icon_url);

  if (platform === 'steam') {
    if (category === 'portraits') {
      return [steamLegacyUrl(externalId, 'library_600x900.jpg'), steamStoreSource(externalId, title, 'portrait'), cover];
    }
    if (category === 'covers') return [cover, steamStoreSource(externalId, title, 'cover')];
    if (category === 'heroes') {
      return [steamLegacyUrl(externalId, 'library_hero.jpg'), steamStoreSource(externalId, title, 'hero'), cover];
    }
    return [icon, steamStoreSource(externalId, title, 'icon')];
  }

  if (platform === 'psn') {
    if (category === 'portraits' || category === 'covers') {
      return [catalogSource(platform, externalId, 'portrait', ASSET_ORIGIN.PSN_CONCEPT), cover];
    }
    // No wide banner without concept art: leave a replaceable placeholder
    // instead of stretching the square trophy-title icon across the hero.
    if (category === 'heroes') return [catalogSource(platform, externalId, 'hero', ASSET_ORIGIN.PSN_CONCEPT)];
    return [icon];
  }

  return [category === 'icons' ? icon : cover];
}

/*
  Local media cache (file side)
  ─────────────────────────────
  Every cover, game icon and achievement badge is mirrored to disk under
  `data/media/` so the UI never depends on a remote CDN and the library keeps
  working offline. See `mediaPaths.ts` for the on-disk layout.

  `data/media/catalog.json` (see `mediaCatalog.ts`) sits beside the images: it
  remembers the better art sources we discovered (Steam store assets, PSN concept
  art) and a provenance record (origin, url, sha256) for every file we write. That
  provenance is what makes upgrades safe: only files we can prove are our own
  low-quality download (the PSN trophy icon) are ever replaced.

  When a source has no art (some Steam titles ship without a header image, etc.)
  we drop a branded SVG *placeholder* at the exact path the real art would take.
  The user can download any image, give it the same base name (any image
  extension) and it is picked up on the next render — no resync required, because
  a file counts as a placeholder only while it still carries our marker comment.
  Such manual files are never overwritten.
*/

const CONTENT_TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
};

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

/** Wipe the cached media tree. Re-downloads lazily. */
export function clearMediaCache(): { removed: boolean } {
  for (const sub of ['covers', 'portraits', 'heroes', 'icons', 'achievements']) {
    try { rmSync(join(MEDIA_ROOT, sub), { recursive: true, force: true }); } catch { /* ignore */ }
  }
  return { removed: true };
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string
  ));
}

// Bump when the placeholder look changes: older cached placeholders get regenerated.
const PLACEHOLDER_VERSION = 'v2';
const PLACEHOLDER_VERSION_MARKER = `${PLACEHOLDER_MARKER} ${PLACEHOLDER_VERSION}`;

function isCurrentPlaceholder(filePath: string): boolean {
  try {
    return readFileSync(filePath, 'utf8').includes(PLACEHOLDER_VERSION_MARKER);
  } catch {
    return false;
  }
}

// Brand placeholder: flat sumi background, vermilion hanko seal (public/brand/mark.svg), title below.
function placeholderSvg(category: MediaCategory, label: string): string {
  const portrait = category === 'portraits';
  const square = category === 'icons' || category === 'achievements';
  const hero = category === 'heroes';
  const w = portrait ? 300 : hero ? 960 : square ? 240 : 460;
  const h = portrait ? 450 : hero ? 420 : 240;
  const safe = escapeXml(label.length > 36 ? `${label.slice(0, 35)}…` : label);
  const seal = Math.round(Math.min(w, h) * (square ? 0.34 : 0.28));
  const sealX = Math.round((w - seal) / 2);
  const sealY = Math.round(h * (square ? 0.2 : 0.3));
  const textY = Math.round(sealY + seal + (square ? 26 : 34));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  <!-- ${PLACEHOLDER_VERSION_MARKER}: replace this file with real art (keep the base name, any image extension) -->
  <rect width="${w}" height="${h}" fill="#1A1817"/>
  <g transform="translate(${sealX} ${sealY}) scale(${(seal / 64).toFixed(4)})">
    <path fill="#E5533A" fill-rule="evenodd" d="M13 2H51A11 11 0 0 1 62 13V51A11 11 0 0 1 51 62H13A11 11 0 0 1 2 51V13A11 11 0 0 1 13 2Z"/>
    <path fill="#F3EEE4" fill-rule="evenodd" d="M14 6.5H50A7.5 7.5 0 0 1 57.5 14V50A7.5 7.5 0 0 1 50 57.5H14A7.5 7.5 0 0 1 6.5 50V14A7.5 7.5 0 0 1 14 6.5ZM14 8H50A6 6 0 0 1 56 14V50A6 6 0 0 1 50 56H14A6 6 0 0 1 8 50V14A6 6 0 0 1 14 8Z"/>
    <path fill="#F3EEE4" d="M13.5 28.4L28 11L36 11L50.5 28.4L42.5 28.4L32 15.35L21.5 28.4ZM13.5 47.2L29.4 47.2L29.4 44.2L23 44.2L23 39L29.4 39L29.4 36L18.5 36L18.5 30.8L45.5 30.8L45.5 36L34.6 36L34.6 39L41 39L41 44.2L34.6 44.2L34.6 47.2L50.5 47.2L50.5 52.4L13.5 52.4Z"/>
  </g>
  <text x="50%" y="${textY}" text-anchor="middle" font-family="Inter,system-ui,Segoe UI,sans-serif" font-size="${square ? 14 : 16}" font-weight="600" fill="#A59D92">${safe}</text>
</svg>`;
}

function extFromResponse(url: string, contentType: string | null): string {
  if (contentType) {
    const base = contentType.split(';')[0].trim().toLowerCase();
    if (CONTENT_TYPE_EXT[base]) return CONTENT_TYPE_EXT[base];
  }
  const m = /\.([a-z0-9]{2,4})(?:$|\?)/i.exec(url);
  if (m && IMAGE_EXTS.has(m[1].toLowerCase())) return m[1].toLowerCase();
  return 'jpg';
}

const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;

/** Read the body up to the size cap; null when it is exceeded. */
async function readCapped(res: Response): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_DOWNLOAD_BYTES || !res.body) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    total += chunk.value.byteLength;
    if (total > MAX_DOWNLOAD_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks);
}

async function download(url: string): Promise<{ buffer: Buffer; ext: string } | null> {
  // The timeout covers headers and body; it is only cleared once the body is read.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    // Remote SVG is rejected: it can carry script and would be served from our origin.
    if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') return null;
    const buffer = await readCapped(res);
    if (!buffer || buffer.byteLength === 0) return null;
    return { buffer, ext: extFromResponse(url, contentType) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Write via tmp + rename so a partial file never counts as real art. */
function writeFileAtomic(target: string, data: Buffer | string) {
  assertInsideMediaRoot(target);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, target);
  } catch (error) {
    try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
    throw error;
  }
}

function removeSlot(files: string[]) {
  for (const file of files) {
    try { rmSync(file); } catch { /* ignore */ }
  }
}

interface SlotContext {
  platform: Platform;
  /** The game row's cover_url: for PSN this is the square trophy icon. */
  trophyIconUrl?: string | null;
}

function fileSha(filePath: string): string | null {
  try {
    return sha256(readFileSync(filePath));
  } catch {
    return null;
  }
}

function isCandidate(source: MediaSource): source is SourceCandidate {
  return typeof source === 'object' && source !== null;
}

/**
 * Is this real file provably our own low-quality PSN trophy icon (and therefore
 * safe to replace)? Files without a matching provenance record that don't equal
 * a fresh trophy-icon download are treated as manual drop-ins and left alone.
 */
async function isReplaceableTrophyIcon(key: string, file: string, ctx: SlotContext): Promise<boolean> {
  const fileHash = fileSha(file);
  if (!fileHash) return false;
  const record = getCatalogSlot(key);
  if (record) return record.origin === ASSET_ORIGIN.PSN_TROPHY_ICON && record.sha256 === fileHash;
  if (!ctx.trophyIconUrl) return false;
  const fresh = await download(ctx.trophyIconUrl);
  const isIcon = fresh !== null && sha256(fresh.buffer) === fileHash;
  if (!isIcon) setCatalogSlot(key, 'manual', '', fileHash); // remember: don't re-download to compare
  return isIcon;
}

/** Download the first working candidate and write it to the slot, recording provenance. */
async function fillSlot(
  dir: string,
  base: string,
  key: string | null,
  sources: MediaSource[],
  existing: string[],
): Promise<string | null> {
  for (const source of sources) {
    const candidate = typeof source === 'function' ? await source() : source;
    if (!candidate?.url) continue;
    const downloaded = await download(candidate.url);
    if (!downloaded) continue;
    const target = join(dir, `${base}.${downloaded.ext}`);
    writeFileAtomic(target, downloaded.buffer);
    removeSlot(existing.filter((file) => file !== target));
    if (key) setCatalogSlot(key, candidate.origin, candidate.url, sha256(downloaded.buffer));
    return target;
  }
  return null;
}

interface SlotOptions {
  /** Ignore the failure TTL and retry every source (backfill CLI only). */
  bypassFailureTtl?: boolean;
}

const FAILURE_TTL_MS = 24 * 60 * 60 * 1000;

function isRecentFailure(failureKey: string): boolean {
  const at = getSlotFailure(failureKey);
  return at !== undefined && Date.now() - at < FAILURE_TTL_MS;
}

/**
 * Resolve a slot to a readable file path, caching on demand.
 * - real art already on disk (downloaded or user-supplied) → returned untouched,
 *   except a provable PSN trophy icon, which is upgraded when concept art exists
 * - otherwise try each source in order
 * - if all fail or there are none, leave/refresh a branded placeholder
 * `ctx` enables catalog provenance (omitted for achievement badges).
 */
async function ensureSlot(
  dir: string,
  base: string,
  category: MediaCategory,
  label: string,
  sources: MediaSource[],
  ctx?: SlotContext,
  options: SlotOptions = {},
): Promise<string> {
  assertInsideMediaRoot(join(dir, base));
  ensureDir(dir);
  const key = ctx ? slotKey(category, ctx.platform, base) : null;
  const failureKey = relative(MEDIA_ROOT, join(dir, base));
  const recentlyFailed = !options.bypassFailureTtl && isRecentFailure(failureKey);
  const files = slotFiles(dir, base);
  const real = files.find((file) => !isPlaceholderFile(file));
  if (real) {
    // A real image (downloaded or manually dropped in) wins — clear any stale
    // placeholder left next to it so the folder stays tidy.
    removeSlot(files.filter(isPlaceholderFile));
    const better = sources.filter((s) => isCandidate(s) && s.origin === ASSET_ORIGIN.PSN_CONCEPT);
    if (ctx && key && better.length > 0 && !recentlyFailed && await isReplaceableTrophyIcon(key, real, ctx)) {
      const upgraded = await fillSlot(dir, base, key, better, [real]);
      if (upgraded) {
        clearSlotFailure(failureKey);
        return upgraded;
      }
      setSlotFailure(failureKey);
    }
    return real;
  }

  const placeholder = files.find(isPlaceholderFile);
  // Every source failed recently: keep serving the placeholder without any network.
  if (!recentlyFailed) {
    const written = await fillSlot(dir, base, key, sources, files);
    if (written) {
      clearSlotFailure(failureKey);
      return written;
    }
    setSlotFailure(failureKey);
  }

  if (placeholder && isCurrentPlaceholder(placeholder)) return placeholder;
  const target = join(dir, `${base}.svg`);
  writeFileAtomic(target, placeholderSvg(category, label));
  return target;
}

// ── Warmers (called during sync to pre-fill the cache) ────────────────────────

async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) break;
      try { await worker(item); } catch { /* best effort */ }
    }
  });
  await Promise.all(runners);
}

interface GameMediaRow extends GameSourceRow {
  platform: Platform;
  external_id: string;
}

function gameSlot(category: GameCategory, platform: Platform, externalId: string, title: string) {
  if (category === 'covers') return coverSlot(platform, externalId, title);
  if (category === 'portraits') return portraitSlot(platform, externalId, title);
  if (category === 'heroes') return heroSlot(platform, externalId, title);
  return iconSlot(platform, externalId, title);
}

const WARM_CATEGORIES: GameCategory[] = ['covers', 'portraits', 'heroes', 'icons'];

/** Mirror covers + game icons for a platform. Best effort; never throws. */
export async function warmGameMedia(platform: Platform): Promise<number> {
  const rows = db
    .prepare('select platform, external_id, title, cover_url, icon_url from games where platform = ?')
    .all(platform) as GameMediaRow[];
  let cached = 0;
  await pool(rows, 8, async (row) => {
    for (const category of WARM_CATEGORIES) {
      if (category === 'icons' && !row.icon_url) continue;
      const slot = gameSlot(category, row.platform, row.external_id, row.title);
      await ensureSlot(slot.dir, slot.base, category, row.title, mediaSources(category, row.platform, row.external_id, row), {
        platform: row.platform,
        trophyIconUrl: row.cover_url,
      });
    }
    cached += 1;
  });
  return cached;
}

interface AchievementMediaRow {
  external_id: string;
  title: string;
  icon_url: string | null;
  locked_icon_url: string | null;
}

/** Mirror achievement badges (earned + locked variants) for a single game. */
export async function warmAchievementMedia(gameId: number): Promise<number> {
  const game = db
    .prepare('select platform, external_id, title from games where id = ?')
    .get(gameId) as { platform: Platform; external_id: string; title: string } | undefined;
  if (!game) return 0;
  const rows = db
    .prepare('select external_id, title, icon_url, locked_icon_url from achievements where game_id = ?')
    .all(gameId) as AchievementMediaRow[];
  let cached = 0;
  await pool(rows, 8, async (row) => {
    if (row.icon_url) {
      const slot = achievementSlot(game.platform, game.external_id, game.title, row.external_id, row.title, false);
      await ensureSlot(slot.dir, slot.base, 'achievements', row.title, [dbSource('db', row.icon_url)]);
    }
    if (row.locked_icon_url && row.locked_icon_url !== row.icon_url) {
      const slot = achievementSlot(game.platform, game.external_id, game.title, row.external_id, row.title, true);
      await ensureSlot(slot.dir, slot.base, 'achievements', row.title, [dbSource('db', row.locked_icon_url)]);
    }
    cached += 1;
  });
  return cached;
}

// ── Serving (lazy cache-fill on first request) ───────────────────────────────

function lastSegment(base: string): string {
  const idx = base.lastIndexOf('-');
  return idx >= 0 ? base.slice(idx + 1) : base;
}

const MAX_SEGMENT_LENGTH = 200;

export interface ResolvedMedia {
  filePath: string;
  contentType: string;
  body: Buffer;
}

/**
 * Resolve a media request path (`covers/<platform>/<base>` etc.) to bytes,
 * downloading from the original source on first hit. Returns null only for a
 * malformed request — a valid slot always yields at least a placeholder.
 */
export async function serveMedia(parts: string[], options: SlotOptions = {}): Promise<ResolvedMedia | null> {
  const decoded = decodeSegments(parts);
  if (!decoded) return null;
  const [category, platform, ...rest] = decoded;
  if (!isMediaCategory(category) || !isMediaPlatform(platform) || rest.length === 0) return null;

  let dir: string;
  let base: string;
  let label: string;
  let sources: MediaSource[];
  let ctx: SlotContext | undefined;

  if (category === 'achievements') {
    if (rest.length !== 2) return null;
    const [gameDir, achBase] = rest;
    if (rest.some((part) => part.length > MAX_SEGMENT_LENGTH)) return null;
    base = achBase;
    const gameExternalId = lastSegment(gameDir);
    if (!isValidExternalId(platform, gameExternalId)) return null;
    dir = join(MEDIA_ROOT, 'achievements', platform, gameDir);
    const locked = base.endsWith('.locked');
    const achId = lastSegment(locked ? base.slice(0, -'.locked'.length) : base);
    const row = db
      .prepare(`
        select a.title as title, a.icon_url as icon_url, a.locked_icon_url as locked_icon_url, g.title as game_title
        from achievements a
        join games g on g.id = a.game_id
        where g.platform = ? and g.external_id = ? and a.external_id = ?
      `)
      .get(platform, gameExternalId, achId) as
      { title: string; icon_url: string | null; locked_icon_url: string | null; game_title: string } | undefined;
    if (!row) return null;
    // Only the canonical slug is served; anything else would mint arbitrary files/catalog entries.
    const canonical = achievementSlot(platform, gameExternalId, row.game_title, achId, row.title, locked);
    if (gameDir !== basename(canonical.dir) || base !== canonical.base) return null;
    label = row.title;
    sources = [dbSource('db', locked ? (row.locked_icon_url ?? row.icon_url) : row.icon_url)];
  } else {
    if (rest.length !== 1) return null;
    base = rest[0];
    if (base.length > MAX_SEGMENT_LENGTH) return null;
    const externalId = lastSegment(base);
    if (!isValidExternalId(platform, externalId)) return null;
    dir = join(MEDIA_ROOT, category, platform);
    const row = db
      .prepare('select title, cover_url, icon_url from games where platform = ? and external_id = ?')
      .get(platform, externalId) as { title: string; cover_url: string | null; icon_url: string | null } | undefined;
    if (!row) return null;
    if (base !== gameSlot(category, platform, externalId, row.title).base) return null;
    label = row.title;
    sources = mediaSources(category, platform, externalId, row);
    ctx = { platform, trophyIconUrl: row.cover_url };
  }

  if (!isInsideMediaRoot(join(dir, base))) return null;
  const filePath = await ensureSlot(dir, base, category, label, sources, ctx, options);
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase();
  return { filePath, contentType: MIME[ext] ?? 'application/octet-stream', body: readFileSync(filePath) };
}

/** Decode and validate every URL segment; null when any is unsafe. */
function decodeSegments(parts: string[]): string[] | null {
  try {
    const decoded = parts.map((part) => decodeURIComponent(part));
    // category + platform are matched against known sets later; the rest must be plain file names.
    return decoded.every((part, index) => (index < 2 ? /^[a-z]+$/.test(part) : isSafeSegment(part))) ? decoded : null;
  } catch {
    return null;
  }
}
