import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { db } from './db';
import type { Platform } from './types';
import {
  MEDIA_ROOT,
  PLACEHOLDER_MARKER,
  achievementSlot,
  coverSlot,
  heroSlot,
  iconSlot,
  portraitSlot,
  type MediaCategory,
} from './mediaPaths';

/** Steam's vertical library capsule (portrait box art). */
function steamPortraitUrl(appid: string) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
}

/** Steam's wide cinematic library hero banner (1920x620). */
function steamHeroUrl(appid: string) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero.jpg`;
}

/**
 * Newer Steam apps only publish the hero under a hashed path, which the store
 * API hands out. Only called when the legacy URL above already failed.
 */
async function steamStoreHeroUrl(appid: string): Promise<string | null> {
  const input = {
    ids: [{ appid: Number(appid) }],
    context: { language: 'english', country_code: 'US' },
    data_request: { include_assets: true },
  };
  try {
    const res = await fetch(
      `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const body = await res.json() as {
      response?: { store_items?: { assets?: { asset_url_format?: string; library_hero?: string } }[] };
    };
    const assets = body.response?.store_items?.[0]?.assets;
    if (!assets?.asset_url_format || !assets.library_hero) return null;
    return `https://shared.akamai.steamstatic.com/store_item_assets/${assets.asset_url_format.replace('${FILENAME}', assets.library_hero)}`;
  } catch {
    return null;
  }
}

/** A download candidate: a URL, or a lookup resolved only if earlier ones fail. */
type MediaSource = string | null | undefined | (() => Promise<string | null>);

function steamHeroSources(appid: string, coverUrl: string | null | undefined): MediaSource[] {
  return [steamHeroUrl(appid), () => steamStoreHeroUrl(appid), coverUrl];
}

/*
  Local media cache (file side)
  ─────────────────────────────
  Every cover, game icon and achievement badge is mirrored to disk under
  `data/media/` so the UI never depends on a remote CDN and the library keeps
  working offline. See `mediaPaths.ts` for the on-disk layout.

  When a source has no art (some Steam titles ship without a header image, etc.)
  we drop a branded SVG *placeholder* at the exact path the real art would take.
  The user can download any image, give it the same base name (any image
  extension) and it is picked up on the next render — no resync required, because
  a file counts as a placeholder only while it still carries our marker comment.
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

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'bmp', 'ico']);

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

/** All files in `dir` whose name is `base.<ext>` (the slot for one asset). */
function slotFiles(dir: string, base: string): string[] {
  if (!existsSync(dir)) return [];
  const prefix = `${base}.`;
  return readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && IMAGE_EXTS.has(name.slice(prefix.length).toLowerCase()))
    .map((name) => join(dir, name));
}

function isPlaceholderFile(filePath: string): boolean {
  if (!filePath.toLowerCase().endsWith('.svg')) return false;
  try {
    return readFileSync(filePath, 'utf8').includes(PLACEHOLDER_MARKER);
  } catch {
    return false;
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string
  ));
}

const PLACEHOLDER_TINT: Record<MediaCategory, { from: string; to: string; accent: string }> = {
  covers: { from: '#1a1530', to: '#0d0a1a', accent: '#a78bfa' },
  portraits: { from: '#1a1530', to: '#0d0a1a', accent: '#a78bfa' },
  heroes: { from: '#1a1530', to: '#0d0a1a', accent: '#a78bfa' },
  icons: { from: '#1a1530', to: '#0d0a1a', accent: '#a78bfa' },
  achievements: { from: '#241a12', to: '#13100a', accent: '#fbbf24' },
};

function placeholderSvg(category: MediaCategory, label: string): string {
  const tint = PLACEHOLDER_TINT[category];
  const portrait = category === 'portraits';
  const square = category === 'icons' || category === 'achievements';
  const hero = category === 'heroes';
  const w = portrait ? 300 : hero ? 960 : square ? 240 : 460;
  const h = portrait ? 450 : hero ? 420 : 240;
  const safe = escapeXml(label.length > 36 ? `${label.slice(0, 35)}…` : label);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  <!-- ${PLACEHOLDER_MARKER}: replace this file with real art (keep the base name, any image extension) -->
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${tint.from}"/>
      <stop offset="1" stop-color="${tint.to}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="50%" y="${square ? '44%' : '46%'}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="${square ? 64 : 76}" font-weight="800" fill="${tint.accent}" opacity="0.85">Z</text>
  <text x="50%" y="${square ? '70%' : '66%'}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="16" font-weight="600" fill="#cbd0e0" opacity="0.65">${safe}</text>
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

async function download(url: string): Promise<{ buffer: Buffer; ext: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ext = extFromResponse(url, res.headers.get('content-type'));
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0) return null;
    return { buffer, ext };
  } catch {
    return null;
  }
}

function removeSlot(files: string[]) {
  for (const file of files) {
    try { rmSync(file); } catch { /* ignore */ }
  }
}

/**
 * Resolve a slot to a readable file path, caching on demand.
 * - real art already on disk (downloaded or user-supplied) → returned untouched
 * - otherwise try to download from `sourceUrl`
 * - if that fails or there is no source, leave/refresh a branded placeholder
 */
async function ensureSlot(
  dir: string,
  base: string,
  category: MediaCategory,
  label: string,
  sources: MediaSource[],
): Promise<string> {
  ensureDir(dir);
  const files = slotFiles(dir, base);
  const real = files.find((file) => !isPlaceholderFile(file));
  if (real) {
    // A real image (downloaded or manually dropped in) wins — clear any stale
    // placeholder left next to it so the folder stays tidy.
    removeSlot(files.filter(isPlaceholderFile));
    return real;
  }

  // Try each candidate source in order (e.g. portrait → landscape fallback).
  for (const source of sources) {
    const sourceUrl = typeof source === 'function' ? await source() : source;
    if (!sourceUrl) continue;
    const downloaded = await download(sourceUrl);
    if (downloaded) {
      removeSlot(files); // drop the placeholder, if any
      const target = join(dir, `${base}.${downloaded.ext}`);
      writeFileSync(target, downloaded.buffer);
      return target;
    }
  }

  const placeholder = files.find(isPlaceholderFile);
  if (placeholder) return placeholder;
  const target = join(dir, `${base}.svg`);
  writeFileSync(target, placeholderSvg(category, label));
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

interface GameMediaRow {
  platform: Platform;
  external_id: string;
  title: string;
  cover_url: string | null;
  icon_url: string | null;
}

/** Mirror covers + game icons for a platform. Best effort; never throws. */
export async function warmGameMedia(platform: Platform): Promise<number> {
  const rows = db
    .prepare('select platform, external_id, title, cover_url, icon_url from games where platform = ?')
    .all(platform) as GameMediaRow[];
  let cached = 0;
  await pool(rows, 8, async (row) => {
    const cover = coverSlot(row.platform, row.external_id, row.title);
    await ensureSlot(cover.dir, cover.base, 'covers', row.title, [row.cover_url]);

    const portrait = portraitSlot(row.platform, row.external_id, row.title);
    const portraitSources = row.platform === 'steam'
      ? [steamPortraitUrl(row.external_id), row.cover_url]
      : [row.cover_url];
    await ensureSlot(portrait.dir, portrait.base, 'portraits', row.title, portraitSources);

    const hero = heroSlot(row.platform, row.external_id, row.title);
    // PSN has no wide banner art, so we leave a replaceable placeholder instead
    // of stretching the square trophy-title icon across the hero.
    const heroSources = row.platform === 'steam'
      ? steamHeroSources(row.external_id, row.cover_url)
      : row.platform === 'psn'
        ? []
        : [row.cover_url];
    await ensureSlot(hero.dir, hero.base, 'heroes', row.title, heroSources);

    if (row.icon_url) {
      const icon = iconSlot(row.platform, row.external_id, row.title);
      await ensureSlot(icon.dir, icon.base, 'icons', row.title, [row.icon_url]);
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
      await ensureSlot(slot.dir, slot.base, 'achievements', row.title, [row.icon_url]);
    }
    if (row.locked_icon_url && row.locked_icon_url !== row.icon_url) {
      const slot = achievementSlot(game.platform, game.external_id, game.title, row.external_id, row.title, true);
      await ensureSlot(slot.dir, slot.base, 'achievements', row.title, [row.locked_icon_url]);
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
export async function serveMedia(parts: string[]): Promise<ResolvedMedia | null> {
  const [category, platform, ...rest] = parts;
  if (!platform || rest.length === 0) return null;

  let dir: string;
  let base: string;
  let label: string;
  let resolvedCategory: MediaCategory;
  let sources: MediaSource[];

  if (category === 'covers' || category === 'icons' || category === 'portraits' || category === 'heroes') {
    resolvedCategory = category;
    base = decodeURIComponent(rest[0]);
    const externalId = lastSegment(base);
    dir = join(MEDIA_ROOT, category, platform);
    const row = db
      .prepare('select title, cover_url, icon_url from games where platform = ? and external_id = ?')
      .get(platform, externalId) as { title: string; cover_url: string | null; icon_url: string | null } | undefined;
    label = row?.title ?? externalId;
    if (category === 'covers') sources = [row?.cover_url];
    else if (category === 'icons') sources = [row?.icon_url];
    else if (category === 'portraits') sources = platform === 'steam' ? [steamPortraitUrl(externalId), row?.cover_url] : [row?.cover_url];
    // PSN: replaceable placeholder banner (no stretched square icon).
    else sources = platform === 'steam' ? steamHeroSources(externalId, row?.cover_url) : platform === 'psn' ? [] : [row?.cover_url];
  } else if (category === 'achievements') {
    resolvedCategory = 'achievements';
    if (rest.length < 2) return null;
    const gameDir = decodeURIComponent(rest[0]);
    base = decodeURIComponent(rest[1]);
    dir = join(MEDIA_ROOT, 'achievements', platform, gameDir);
    const gameExternalId = lastSegment(gameDir);
    const locked = base.endsWith('.locked');
    const achId = lastSegment(locked ? base.slice(0, -'.locked'.length) : base);
    const row = db
      .prepare(`
        select a.title as title, a.icon_url as icon_url, a.locked_icon_url as locked_icon_url
        from achievements a
        join games g on g.id = a.game_id
        where g.platform = ? and g.external_id = ? and a.external_id = ?
      `)
      .get(platform, gameExternalId, achId) as
      { title: string; icon_url: string | null; locked_icon_url: string | null } | undefined;
    label = row?.title ?? achId;
    sources = [locked ? (row?.locked_icon_url ?? row?.icon_url) : row?.icon_url];
  } else {
    return null;
  }

  const filePath = await ensureSlot(dir, base, resolvedCategory, label, sources);
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase();
  return { filePath, contentType: MIME[ext] ?? 'application/octet-stream', body: readFileSync(filePath) };
}
