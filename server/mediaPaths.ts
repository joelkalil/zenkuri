import { join, resolve, sep } from 'node:path';
import { envString } from './env';
import type { Platform } from './types';

/*
  Pure path / URL helpers for the local media cache. Kept dependency-free (no DB,
  no fs) so both `db.ts` (which builds the URLs it hands to the client) and
  `media.ts` (which reads/writes the files) can import it without a cycle.
*/

export const MEDIA_ROOT = envString('ZENKURI_MEDIA_PATH', join(process.cwd(), 'data', 'media'));

export const PLACEHOLDER_MARKER = 'zenkuri:placeholder';

export type MediaCategory = 'covers' | 'portraits' | 'heroes' | 'icons' | 'achievements';

export const MEDIA_CATEGORIES = ['covers', 'portraits', 'heroes', 'icons', 'achievements'] as const;

export const MEDIA_PLATFORMS = ['steam', 'psn', 'retroachievements'] as const satisfies readonly Platform[];

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

const EXTERNAL_ID_PATTERN: Record<Platform, RegExp> = {
  steam: /^\d+$/,
  psn: /^NPWR\d{5}_\d{2}$/,
  retroachievements: /^\d+$/,
};

export function isMediaCategory(value: string | undefined): value is MediaCategory {
  return (MEDIA_CATEGORIES as readonly string[]).includes(value ?? '');
}

export function isMediaPlatform(value: string | undefined): value is Platform {
  return (MEDIA_PLATFORMS as readonly string[]).includes(value ?? '');
}

/** A single URL path segment that is safe to use as a file/dir name. */
export function isSafeSegment(value: string): boolean {
  return SAFE_SEGMENT.test(value) && value !== '.' && value !== '..' && !value.includes('..');
}

export function isValidExternalId(platform: Platform, externalId: string): boolean {
  return EXTERNAL_ID_PATTERN[platform].test(externalId);
}

export function isInsideMediaRoot(target: string): boolean {
  return resolve(target).startsWith(resolve(MEDIA_ROOT) + sep);
}

/** Throws unless `target` resolves strictly inside MEDIA_ROOT. Call before any read/write. */
export function assertInsideMediaRoot(target: string): void {
  if (!isInsideMediaRoot(target)) throw new Error('Path escapes media root');
}

export function slugify(value: string): string {
  return (value || 'untitled')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'untitled';
}

export function coverSlot(platform: Platform, externalId: string, title: string) {
  return { dir: join(MEDIA_ROOT, 'covers', platform), base: `${slugify(title)}-${externalId}` };
}

export function portraitSlot(platform: Platform, externalId: string, title: string) {
  return { dir: join(MEDIA_ROOT, 'portraits', platform), base: `${slugify(title)}-${externalId}` };
}

export function heroSlot(platform: Platform, externalId: string, title: string) {
  return { dir: join(MEDIA_ROOT, 'heroes', platform), base: `${slugify(title)}-${externalId}` };
}

export function iconSlot(platform: Platform, externalId: string, title: string) {
  return { dir: join(MEDIA_ROOT, 'icons', platform), base: `${slugify(title)}-${externalId}` };
}

export function achievementGameDir(gameTitle: string, gameExternalId: string) {
  return `${slugify(gameTitle)}-${gameExternalId}`;
}

export function achievementBase(achTitle: string, achId: string, locked: boolean) {
  return `${slugify(achTitle)}-${achId}${locked ? '.locked' : ''}`;
}

export function achievementSlot(
  platform: Platform,
  gameExternalId: string,
  gameTitle: string,
  achId: string,
  achTitle: string,
  locked: boolean,
) {
  return {
    dir: join(MEDIA_ROOT, 'achievements', platform, achievementGameDir(gameTitle, gameExternalId)),
    base: achievementBase(achTitle, achId, locked),
  };
}

export function coverMediaUrl(platform: Platform, externalId: string, title: string): string {
  return `/media/covers/${platform}/${encodeURIComponent(coverSlot(platform, externalId, title).base)}`;
}

export function portraitMediaUrl(platform: Platform, externalId: string, title: string): string {
  return `/media/portraits/${platform}/${encodeURIComponent(portraitSlot(platform, externalId, title).base)}`;
}

export function heroMediaUrl(platform: Platform, externalId: string, title: string): string {
  return `/media/heroes/${platform}/${encodeURIComponent(heroSlot(platform, externalId, title).base)}`;
}

export function iconMediaUrl(platform: Platform, externalId: string, title: string): string {
  return `/media/icons/${platform}/${encodeURIComponent(iconSlot(platform, externalId, title).base)}`;
}

export function achievementMediaUrl(
  platform: Platform,
  gameExternalId: string,
  gameTitle: string,
  achId: string,
  achTitle: string,
  locked: boolean,
): string {
  const game = encodeURIComponent(achievementGameDir(gameTitle, gameExternalId));
  const base = encodeURIComponent(achievementBase(achTitle, achId, locked));
  return `/media/achievements/${platform}/${game}/${base}`;
}
