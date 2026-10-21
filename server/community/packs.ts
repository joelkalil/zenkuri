/*
  Discovery and reading of the community packs (never touches the database).

  Layout: <root>/<space>/space.json
          <root>/<space>/sagas/<slug>.json
          <root>/<space>/rankings/<slug>.json

  Path safety: only reads .json files inside the root; symlinks (of files or
  directories) are ignored, and every file goes through realpath to make sure
  it does not escape the root.
*/

import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { PublicationKind } from '../../src/types/community';
import { envString } from '../env';
import { SLUG } from '../validation';
import { validatePublication, validateSpace, type PublicationPack, type SpacePack } from './schema';

const MAX_PACK_BYTES = 2 * 1024 * 1024;

const KIND_DIRECTORIES: ReadonlyArray<{ directory: string; kind: PublicationKind }> = [
  { directory: 'sagas', kind: 'saga' },
  { directory: 'rankings', kind: 'ranking' },
];

export function resolveCommunityRoot(): string {
  return resolve(envString('ZENKURI_COMMUNITY_DIR', join(process.cwd(), 'community')));
}

export type LoadedSpace = SpacePack & { origin: string };
export type LoadedPublication = PublicationPack & {
  space: string;
  /** pack path relative to the repository (or, in the future, a URL) */
  origin: string;
  contentHash: string;
};

export interface PackLoad {
  root: string;
  rootExists: boolean;
  spaces: LoadedSpace[];
  publications: LoadedPublication[];
  /** packs that exist but are invalid (file + field) */
  errors: string[];
  /** ignored files (symlinks, unexpected extensions…) */
  warnings: string[];
  /** spaces whose space.json exists on disk, valid or not */
  seenSpaces: Set<string>;
  /** `<space>/<kind>/<slug>` of every publication file on disk, valid or not */
  seenPublications: Set<string>;
}

export function publicationKey(space: string, kind: PublicationKind, slug: string) {
  return `${space}/${kind}/${slug}`;
}

function isInside(root: string, candidate: string) {
  const rel = relative(root, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * Reads a pack file with all the path checks. Throws with a clear message
 * when the path is unsafe; returns the file text.
 */
export function readPackFile(root: string, relativePath: string): string {
  const realRoot = realpathSync(root);
  if (extname(relativePath).toLowerCase() !== '.json') throw new Error(`${relativePath}: only .json files are read`);
  const absolute = resolve(realRoot, relativePath);
  if (!isInside(realRoot, absolute)) throw new Error(`${relativePath}: path is outside the packs root`);
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) throw new Error(`${relativePath}: symlinks are not allowed`);
  if (!stat.isFile()) throw new Error(`${relativePath}: not a regular file`);
  if (stat.size > MAX_PACK_BYTES) throw new Error(`${relativePath}: larger than ${MAX_PACK_BYTES} bytes`);
  // An intermediate directory may be a symlink: check the real target.
  if (!isInside(realRoot, realpathSync(absolute))) throw new Error(`${relativePath}: resolves outside the packs root`);
  return readFileSync(absolute, 'utf8');
}

function toPosix(path: string) {
  return path.split(sep).join('/');
}

function listEntries(dir: string) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
}

function parseJson(rel: string, text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: `${rel}: invalid JSON (${error instanceof Error ? error.message : String(error)})` };
  }
}

function emptyLoad(root: string, rootExists: boolean): PackLoad {
  return {
    root,
    rootExists,
    spaces: [],
    publications: [],
    errors: [],
    warnings: [],
    seenSpaces: new Set(),
    seenPublications: new Set(),
  };
}

export function loadPacks(root: string = resolveCommunityRoot()): PackLoad {
  let rootStat;
  try {
    rootStat = lstatSync(root);
  } catch {
    return emptyLoad(root, false);
  }
  if (!rootStat.isDirectory()) return emptyLoad(root, false);

  const load = emptyLoad(root, true);
  const read = (rel: string): { text: string } | null => {
    try {
      return { text: readPackFile(root, rel) };
    } catch (error) {
      load.errors.push(error instanceof Error ? error.message : String(error));
      return null;
    }
  };

  for (const spaceDir of listEntries(root)) {
    if (spaceDir.isSymbolicLink()) {
      load.warnings.push(`${spaceDir.name}: symlink ignored`);
      continue;
    }
    if (!spaceDir.isDirectory()) continue; // README and the like at the root
    if (!SLUG.test(spaceDir.name)) {
      load.warnings.push(`${spaceDir.name}/: invalid space name (use a lowercase slug), folder ignored`);
      continue;
    }
    const space = spaceDir.name;
    const spaceFile = `${space}/space.json`;
    const spaceDirPath = join(root, space);

    let spaceOk = false;
    const spaceEntries = listEntries(spaceDirPath);
    const spaceFileEntry = spaceEntries.find((entry) => entry.name === 'space.json');
    if (!spaceFileEntry) {
      load.errors.push(`${spaceFile}: missing file (every space needs a space.json)`);
    } else if (spaceFileEntry.isSymbolicLink()) {
      load.warnings.push(`${spaceFile}: symlink ignored`);
    } else {
      load.seenSpaces.add(space);
      const file = read(spaceFile);
      const parsed = file ? parseJson(spaceFile, file.text) : null;
      if (parsed && !parsed.ok) load.errors.push(parsed.error);
      if (parsed?.ok) {
        const checked = validateSpace(spaceFile, parsed.value);
        if (!checked.ok) {
          load.errors.push(...checked.errors);
        } else if (checked.value.slug !== space) {
          load.errors.push(`${spaceFile}: slug: "${checked.value.slug}" differs from the folder name (expected "${space}")`);
        } else {
          load.spaces.push({ ...checked.value, origin: `community/${spaceFile}` });
          spaceOk = true;
        }
      }
    }

    let hasPublicationFiles = false;
    for (const entry of spaceEntries) {
      if (entry.name === 'space.json') continue;
      const kindDir = KIND_DIRECTORIES.find((item) => item.directory === entry.name);
      if (!kindDir || !entry.isDirectory()) {
        load.warnings.push(`${space}/${entry.name}: ${entry.isSymbolicLink() ? 'symlink ignored' : 'unexpected item, ignored'}`);
        continue;
      }

      for (const file of listEntries(join(spaceDirPath, kindDir.directory))) {
        const rel = toPosix(join(space, kindDir.directory, file.name));
        if (file.isSymbolicLink()) {
          load.warnings.push(`${rel}: symlink ignored`);
          continue;
        }
        if (!file.isFile() || extname(file.name).toLowerCase() !== '.json') {
          load.warnings.push(`${rel}: not a .json file, ignored`);
          continue;
        }
        const slug = file.name.slice(0, -'.json'.length);
        load.seenPublications.add(publicationKey(space, kindDir.kind, slug));
        hasPublicationFiles = true;
        const content = read(rel);
        if (!content) continue;
        const parsed = parseJson(rel, content.text);
        if (!parsed.ok) {
          load.errors.push(parsed.error);
          continue;
        }
        const checked = validatePublication(rel, parsed.value, { kind: kindDir.kind, slug });
        if (!checked.ok) {
          load.errors.push(...checked.errors);
          continue;
        }
        if (!spaceOk) {
          load.errors.push(`${rel}: the space "${space}" has no valid space.json`);
          continue;
        }
        load.publications.push({
          ...checked.value,
          space,
          origin: `community/${rel}`,
          contentHash: createHash('sha256').update(content.text).digest('hex'),
        });
      }
    }

    // A missing or invalid space.json must not delete the space row (that would cascade
    // away its publications while their files still exist): keep it while files remain.
    if (hasPublicationFiles) load.seenSpaces.add(space);
  }

  return load;
}
