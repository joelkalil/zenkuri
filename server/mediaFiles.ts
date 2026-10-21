import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLACEHOLDER_MARKER } from './mediaPaths';

/** Dependency-free file helpers shared by the media cache and the backfill CLI. */

export const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'bmp', 'ico']);

/** All files in `dir` whose name is `base.<ext>` (the slot for one asset). */
export function slotFiles(dir: string, base: string): string[] {
  if (!existsSync(dir)) return [];
  const prefix = `${base}.`;
  return readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && IMAGE_EXTS.has(name.slice(prefix.length).toLowerCase()))
    .map((name) => join(dir, name));
}

export function isPlaceholderFile(filePath: string): boolean {
  if (!filePath.toLowerCase().endsWith('.svg')) return false;
  try {
    return readFileSync(filePath, 'utf8').includes(PLACEHOLDER_MARKER);
  } catch {
    return false;
  }
}
