import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA_ROOT } from '../mediaPaths';
import { readCatalogFile, slotKey, type Catalog } from '../mediaCatalog';
import { IMAGE_EXTS, isPlaceholderFile } from '../mediaFiles';

/*
  Media backfill
  ──────────────
  Walks data/media for placeholder files and PSN slots that can be upgraded, and
  asks the running server for each one (GET /media/...) so the server's own
  source logic resolves it. Usage: npm run media:backfill [-- --dry-run]
*/

const CATEGORIES = ['portraits', 'covers', 'heroes', 'icons'] as const;
type Category = (typeof CATEGORIES)[number];
const CONCURRENCY = 4;
const CATALOG_FLUSH_WAIT_MS = 1500;

type Reason = 'placeholder' | 'upgrade';

interface Candidate {
  category: Category;
  platform: string;
  base: string;
  reason: Reason;
}

const dryRun = process.argv.includes('--dry-run');
const apiBase = `http://localhost:${process.env.ZENKURI_API_PORT ?? 4343}`;

function readCatalog(): Catalog | null {
  try {
    return readCatalogFile();
  } catch {
    return null;
  }
}

function lastSegment(base: string): string {
  const idx = base.lastIndexOf('-');
  return idx >= 0 ? base.slice(idx + 1) : base;
}

function scan(catalog: Catalog | null): Candidate[] {
  const found: Candidate[] = [];
  for (const category of CATEGORIES) {
    const categoryDir = join(MEDIA_ROOT, category);
    if (!existsSync(categoryDir)) continue;
    for (const platform of readdirSync(categoryDir)) {
      const dir = join(categoryDir, platform);
      let names: string[];
      try { names = readdirSync(dir); } catch { continue; }
      const bases = new Map<string, string[]>();
      for (const name of names) {
        const dot = name.lastIndexOf('.');
        if (dot < 0 || !IMAGE_EXTS.has(name.slice(dot + 1).toLowerCase())) continue;
        const base = name.slice(0, dot);
        bases.set(base, [...(bases.get(base) ?? []), join(dir, name)]);
      }
      for (const [base, files] of bases) {
        const real = files.find((file) => !isPlaceholderFile(file));
        if (!real) {
          found.push({ category, platform, base, reason: 'placeholder' });
          continue;
        }
        if (platform === 'psn' && (category === 'portraits' || category === 'covers') && catalog) {
          const asset = catalog.games[`psn:${lastSegment(base)}`]?.assets.portrait;
          const origin = catalog.slots[slotKey(category, platform, base)]?.origin;
          if (asset?.origin === 'psn-concept' && origin !== 'psn-concept' && origin !== 'manual') {
            found.push({ category, platform, base, reason: 'upgrade' });
          }
        }
      }
    }
  }
  return found;
}

/** 'stale' = the server answered 404: the file name is not the game's canonical slug (e.g. renamed title). */
type Outcome = 'ok' | 'stale' | 'error';

async function request(candidate: Candidate): Promise<Outcome> {
  const url = `${apiBase}/media/${candidate.category}/${candidate.platform}/${encodeURIComponent(candidate.base)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: { 'x-zenkuri-backfill': '1' } });
  await res.arrayBuffer();
  if (res.status === 404) return 'stale';
  return res.ok ? 'ok' : 'error';
}

async function runPool(items: Candidate[], failures: string[], stale: string[]): Promise<void> {
  const queue = [...items];
  let done = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const outcome = await request(item);
        const name = `${item.category}/${item.platform}/${item.base}`;
        if (outcome === 'stale') stale.push(name);
        else if (outcome === 'error') failures.push(`${name}: HTTP error`);
      } catch (error) {
        failures.push(`${item.category}/${item.platform}/${item.base}: ${(error as Error).message}`);
      }
      done += 1;
      if (done % 25 === 0) console.log(`  ... ${done}/${items.length}`);
    }
  });
  await Promise.all(workers);
}

function groupKey(c: Candidate): string {
  return `${c.category}/${c.platform}`;
}

async function main() {
  const before = scan(readCatalog());
  console.log(`${before.length} candidate(s) under ${MEDIA_ROOT}${dryRun ? ' (dry run)' : ''}`);

  if (dryRun) {
    for (const c of before) console.log(`  [${c.reason}] ${c.category}/${c.platform}/${c.base}`);
    return;
  }
  if (before.length === 0) return;

  const failures: string[] = [];
  const stale: string[] = [];
  await runPool(before, failures, stale);
  await new Promise((resolve) => setTimeout(resolve, CATALOG_FLUSH_WAIT_MS));

  const after = scan(readCatalog());
  const stillKey = (c: Candidate) => `${groupKey(c)}/${c.base}/${c.reason}`;
  const stillOpen = new Set(after.map(stillKey));

  const groups = new Map<string, { attempted: number; resolved: number; missing: string[] }>();
  for (const c of before) {
    const group = groups.get(groupKey(c)) ?? { attempted: 0, resolved: 0, missing: [] };
    group.attempted += 1;
    if (stillOpen.has(stillKey(c))) group.missing.push(`${c.base} [${c.reason}]`);
    else group.resolved += 1;
    groups.set(groupKey(c), group);
  }

  console.log('\ncategory/platform'.padEnd(22), 'before'.padStart(7), 'resolved'.padStart(9), 'missing'.padStart(8));
  for (const [key, g] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(key.padEnd(21), String(g.attempted).padStart(7), String(g.resolved).padStart(9), String(g.missing.length).padStart(8));
  }
  for (const [key, g] of groups) {
    if (g.missing.length === 0) continue;
    console.log(`\nStill missing in ${key}:`);
    for (const name of g.missing) console.log(`  - ${name}`);
  }
  if (stale.length > 0) {
    console.log(`\n${stale.length} stale/non-canonical file(s) (not served; safe to delete):`);
    for (const name of stale.slice(0, 50)) console.log(`  - ${name}`);
  }
  if (failures.length > 0) {
    console.log(`\n${failures.length} request failure(s):`);
    for (const failure of failures.slice(0, 20)) console.log(`  - ${failure}`);
  }
}

main().catch((error: unknown) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
