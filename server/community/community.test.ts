/*
  Tests for community, plan and personal import (npm run test:community).
  Uses a throwaway database: ZENKURI_TEST_DB_DIR (or a temporary directory) —
  never the real database.
*/

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { loadPacks, publicationKey, readPackFile, resolveCommunityRoot } from './packs';
import { validatePublication, validateSagaPayload, validateSpace } from './schema';
import { validatePersonalFile, type PersonalFile } from '../personal/file';
import { parseEntryInput, parseEntryPatch, parsePhaseInput, parseReorder } from '../plan/validate';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.log(`  ✗ ${name} ${detail}`); } else console.log(`  ✓ ${name}`);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const realCommunity = join(repoRoot, 'community');
const testDir = process.env.ZENKURI_TEST_DB_DIR ?? mkdtempSync(join(tmpdir(), 'zenkuri-community-test-'));
mkdirSync(testDir, { recursive: true });
const dbFile = join(testDir, `community-${process.pid}.sqlite`);
for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbFile}${suffix}`, { force: true });
process.env.ZENKURI_DB_PATH = dbFile;
const work = mkdtempSync(join(testDir, 'work-'));

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

// The database may only be opened after ZENKURI_DB_PATH points at the throwaway one.
const { db, createUser } = await import('../db');
const { syncPacksToDb } = await import('./store');
const { importCommunityPacks } = await import('./importPacks');
const { planRouter, gameNotesRouter } = await import('../routes/plan');
const { communityRouter } = await import('../routes/community');
const { importPersonal, PersonalImportError } = await import('../personal/import');

const count = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { n: number }).n;

// ─── Validators ────────────────────────────────────────────────────────────

console.log('\n— Validators: real packs —');
{
  const load = loadPacks(realCommunity);
  check('the repository packs load without errors', load.errors.length === 0, load.errors.join('; '));
  check('1 space, 2 sagas and 1 ranking', load.spaces.length === 1 && load.publications.filter((p) => p.kind === 'saga').length === 2 && load.publications.filter((p) => p.kind === 'ranking').length === 1);
  const ranking = load.publications.find((p) => p.kind === 'ranking');
  check('essenciais ranking: 20 entries, all with a title', ranking?.kind === 'ranking' && ranking.payload.entries.length === 20 && ranking.payload.entries.every((e) => e.title !== ''));
  const saga = load.publications.find((p) => p.slug === 'final-fantasy');
  check('saga keeps priceCheckedAt in the payload', saga?.kind === 'saga' && saga.payload.priceCheckedAt === '2026-10-01');
}

console.log('\n— Validators: invalid packs —');
{
  const base = readJson(join(realCommunity, 'zenkuri', 'sagas', 'resident-evil.json'));
  const expected = { kind: 'saga' as const, slug: 'resident-evil' };
  const mutate = (change: (copy: Record<string, unknown>) => void) => {
    const copy = structuredClone(base);
    change(copy);
    return validatePublication('community/zenkuri/sagas/resident-evil.json', copy, expected);
  };
  const errorsOf = (result: ReturnType<typeof validatePublication>) => (result.ok ? [] : result.errors);

  check('a valid pack passes', validatePublication('x.json', base, expected).ok);

  const noTitle = errorsOf(mutate((c) => { delete c.title; }));
  check('a missing field names the file and the field', noTitle.some((e) => e.includes('resident-evil.json') && e.includes('title') && e.includes('missing')), noTitle.join('|'));

  const badDate = errorsOf(mutate((c) => { c.publishedAt = '2026-13-45'; }));
  check('invalid date', badDate.some((e) => e.includes('publishedAt') && e.includes('YYYY-MM-DD')), badDate.join('|'));

  const badKind = errorsOf(mutate((c) => { c.kind = 'poem'; }));
  check('an unknown kind lists the valid ones', badKind.some((e) => e.includes('kind') && e.includes('saga, ranking')), badKind.join('|'));

  const wrongFolder = errorsOf(mutate((c) => { c.kind = 'ranking'; c.payload = { entries: [] }; }));
  check('kind differs from the folder', wrongFolder.some((e) => e.includes('kind') && e.includes('folder')), wrongFolder.join('|'));

  const wrongSlug = errorsOf(mutate((c) => { c.slug = 'something-else'; }));
  check('slug differs from the file', wrongSlug.some((e) => e.includes('slug') && e.includes('file name')), wrongSlug.join('|'));

  const badSchema = errorsOf(mutate((c) => { c.schema = 'zenkuri.publication/v9'; }));
  check('unknown schema', badSchema.some((e) => e.includes('schema')), badSchema.join('|'));

  const unknownKey = errorsOf(mutate((c) => { c.extra = 1; }));
  check('unknown field', unknownKey.some((e) => e.includes('extra') && e.includes('unknown')), unknownKey.join('|'));

  const deep = errorsOf(mutate((c) => {
    const payload = c.payload as { phases: Array<{ entries: Array<Record<string, unknown>> }> };
    payload.phases[1].entries[0].difficulty = 9;
    payload.phases[1].entries[0].hours = [10, 5];
    payload.phases[0].entries[0].appid = 'abc';
  }));
  check('payload errors name the exact path', deep.some((e) => e.includes('payload.phases[1].entries[0].difficulty'))
    && deep.some((e) => e.includes('payload.phases[1].entries[0].hours') && e.includes('less than'))
    && deep.some((e) => e.includes('payload.phases[0].entries[0].appid')), deep.join('|'));

  const dup = errorsOf(mutate((c) => {
    const payload = c.payload as { phases: Array<{ entries: Array<Record<string, unknown>> }> };
    payload.phases[1].entries[0].appid = payload.phases[0].entries[0].appid;
  }));
  check('repeated appid in the saga', dup.some((e) => e.includes('repeated')), dup.join('|'));

  const flags = errorsOf(mutate((c) => {
    const payload = c.payload as { phases: Array<{ entries: Array<Record<string, unknown>> }> };
    payload.phases[0].entries[0].flags = ['loud'];
  }));
  check('invalid saga flag', flags.some((e) => e.includes('flags[0]') && e.includes('loud')), flags.join('|'));

  const noLanguage = errorsOf(mutate((c) => { delete c.language; }));
  check('a missing language names the file and the field', noLanguage.some((e) => e.includes('resident-evil.json') && e.includes('language') && e.includes('missing')), noLanguage.join('|'));

  const badLanguage = errorsOf(mutate((c) => { c.language = 'fr'; }));
  check('an unsupported language lists the valid ones', badLanguage.some((e) => e.includes('language') && e.includes('pt-BR, en')), badLanguage.join('|'));

  const englishPack = validatePublication('x.json', { ...base, language: 'en' }, expected);
  check('language "en" is accepted', englishPack.ok && englishPack.value.language === 'en');

  const spaceNoLanguage = validateSpace('community/x/space.json', { schema: 'zenkuri.space/v1', slug: 'x', name: 'X', description: 'd' });
  check('space: a missing language is an error', !spaceNoLanguage.ok && spaceNoLanguage.errors.some((e) => e.includes('language') && e.includes('missing')), spaceNoLanguage.ok ? '' : spaceNoLanguage.errors.join('|'));

  const spaceBadLanguage = validateSpace('community/x/space.json', { schema: 'zenkuri.space/v1', language: 'es', slug: 'x', name: 'X', description: 'd' });
  check('space: an unsupported language is an error', !spaceBadLanguage.ok && spaceBadLanguage.errors.some((e) => e.includes('language') && e.includes('pt-BR, en')), spaceBadLanguage.ok ? '' : spaceBadLanguage.errors.join('|'));

  const notObject = validatePublication('list.json', [], expected);
  check('a root that is not an object', !notObject.ok && notObject.errors[0].includes('list.json') && notObject.errors[0].includes('expected object'));

  const space = validateSpace('community/x/space.json', { schema: 'zenkuri.space/v1', language: 'pt-BR', slug: 'Not A Slug', name: '', description: 1 });
  check('space: invalid slug, name and description', !space.ok && space.errors.length === 3, space.ok ? '' : space.errors.join('|'));

  const ranking = validatePublication('r.json', {
    schema: 'zenkuri.publication/v1', language: 'pt-BR', kind: 'ranking', slug: 'r', title: 'R', summary: '', author: { handle: 'joel', name: 'Joel' },
    version: 1, publishedAt: '2026-10-01',
    payload: { entries: [{ platform: 'xbox', externalId: '1', title: '', note: '' }, { platform: 'steam', externalId: '2', title: 'A', note: '' }, { platform: 'steam', externalId: '2', title: 'B', note: '' }] },
  });
  const rankingErrors = ranking.ok ? [] : ranking.errors;
  check('ranking: platform, empty title and repeated game', rankingErrors.some((e) => e.includes('entries[0].platform'))
    && rankingErrors.some((e) => e.includes('entries[0].title'))
    && rankingErrors.some((e) => e.includes('repeated')), rankingErrors.join('|'));

  check('validateSagaPayload rejects garbage', !validateSagaPayload('db', { name: 1 }).ok);
}

// ─── Idempotent import ─────────────────────────────────────────────────

console.log('\n— Pack import: idempotency and removal —');
const importRoot = join(work, 'community');
cpSync(realCommunity, importRoot, { recursive: true });
{
  const first = importCommunityPacks(importRoot);
  check('the first import adds 3 publications', first.summary.added === 3 && first.summary.unchanged === 0 && first.load.errors.length === 0, JSON.stringify(first.summary));
  check('database has 1 space and 3 publications', count('select count(*) n from spaces') === 1 && count('select count(*) n from publications') === 3);

  const stamp = (db.prepare("select imported_at from publications where slug = 'essenciais'").get() as { imported_at: string }).imported_at;
  const second = importCommunityPacks(importRoot);
  const stampAfter = (db.prepare("select imported_at from publications where slug = 'essenciais'").get() as { imported_at: string }).imported_at;
  check('the second import changes nothing', second.summary.added === 0 && second.summary.updated === 0 && second.summary.unchanged === 3 && second.summary.removed === 0, JSON.stringify(second.summary));
  check('imported_at preserved when the hash did not change', stamp === stampAfter);
  check('origin is the pack path in the repository', (db.prepare("select origin from publications where slug = 'essenciais'").get() as { origin: string }).origin === 'community/zenkuri/rankings/essenciais.json');

  const rankingPath = join(importRoot, 'zenkuri', 'rankings', 'essenciais.json');
  const edited = readJson(rankingPath);
  edited.version = 3;
  writeJson(rankingPath, edited);
  const third = importCommunityPacks(importRoot);
  check('changing the file updates only that publication', third.summary.updated === 1 && third.summary.unchanged === 2, JSON.stringify(third.summary));
  check('new version in the database', count("select count(*) n from publications where slug = 'essenciais' and version = 3") === 1);

  const brokenPath = join(importRoot, 'zenkuri', 'sagas', 'resident-evil.json');
  const goodText = readFileSync(brokenPath, 'utf8');
  const broken = readJson(brokenPath);
  delete broken.title;
  writeJson(brokenPath, broken);
  const fourth = importCommunityPacks(importRoot);
  check('a pack that became invalid is reported and the database keeps the previous version', fourth.load.errors.length === 1 && fourth.summary.removed === 0
    && count("select count(*) n from publications where slug = 'resident-evil'") === 1, fourth.load.errors.join('|'));
  writeFileSync(brokenPath, goodText);

  unlinkSync(join(importRoot, 'zenkuri', 'sagas', 'final-fantasy.json'));
  const fifth = importCommunityPacks(importRoot);
  check('a removed file disappears from the database', fifth.summary.removed === 1 && count("select count(*) n from publications where slug = 'final-fantasy'") === 0, JSON.stringify(fifth.summary));
  check('the others remain', count('select count(*) n from publications') === 2);

  const missing = importCommunityPacks(join(work, 'does-not-exist'));
  check('a missing root deletes nothing', !missing.load.rootExists && missing.summary.removed === 0 && count('select count(*) n from publications') === 2);

  // Restores the full content for the route tests.
  cpSync(realCommunity, importRoot, { recursive: true });
  importCommunityPacks(importRoot);
  check('restored: 3 publications', count('select count(*) n from publications') === 3);

  // A deleted space.json must not cascade the publications away while their files remain.
  const spaceJson = join(importRoot, 'zenkuri', 'space.json');
  const spaceText = readFileSync(spaceJson, 'utf8');
  unlinkSync(spaceJson);
  const noSpaceFile = importCommunityPacks(importRoot);
  check('a missing space.json keeps the space and its publications', noSpaceFile.load.errors.length > 0 && noSpaceFile.summary.removed === 0
    && count("select count(*) n from spaces where slug = 'zenkuri'") === 1 && count('select count(*) n from publications') === 3, JSON.stringify(noSpaceFile.summary));
  writeFileSync(spaceJson, '{ nope');
  importCommunityPacks(importRoot);
  check('an invalid space.json keeps the space and its publications too', count("select count(*) n from spaces where slug = 'zenkuri'") === 1 && count('select count(*) n from publications') === 3);
  writeFileSync(spaceJson, spaceText);
  importCommunityPacks(importRoot);

  const noRemoval = syncPacksToDb({ spaces: [], publications: [], seenSpaces: new Set(), seenPublications: new Set(), allowRemoval: false });
  check('allowRemoval=false preserves everything', noRemoval.removed === 0 && count('select count(*) n from publications') === 3);
  check('publication key', publicationKey('zenkuri', 'saga', 'x') === 'zenkuri/saga/x');
}

// ─── Path safety ───────────────────────────────────────────────────

console.log('\n— Path safety —');
{
  const root = join(work, 'safe-root');
  const outside = join(work, 'outside');
  cpSync(realCommunity, root, { recursive: true });
  mkdirSync(join(outside, 'sagas'), { recursive: true });
  const outsidePack = join(outside, 'secret.json');
  cpSync(join(realCommunity, 'zenkuri', 'sagas', 'resident-evil.json'), outsidePack);
  writeJson(join(outside, 'rankings-evil.json'), readJson(join(realCommunity, 'zenkuri', 'rankings', 'essenciais.json')));

  symlinkSync(outsidePack, join(root, 'zenkuri', 'sagas', 'evil.json'));
  symlinkSync(outside, join(root, 'zenkuri', 'linkdir'));
  symlinkSync(outside, join(root, 'ghost-space'));
  writeFileSync(join(root, 'zenkuri', 'sagas', 'notes.txt'), 'not a pack');

  const load = loadPacks(root);
  check('a file symlink outside the root is not imported', !load.publications.some((p) => p.slug === 'evil') && load.warnings.some((w) => w.includes('evil.json') && w.includes('symlink')), load.warnings.join('|'));
  check('a space directory symlink is ignored', load.warnings.some((w) => w.includes('ghost-space') && w.includes('symlink')) && !load.spaces.some((s) => s.slug === 'ghost-space'));
  check('a folder symlink inside the space is ignored', load.warnings.some((w) => w.includes('linkdir')));
  check('a non-.json file is ignored with a warning', load.warnings.some((w) => w.includes('notes.txt')));
  check('the legitimate content keeps loading', load.publications.length === 3 && load.errors.length === 0, load.errors.join('|'));

  const rejects = (rel: string) => { try { readPackFile(root, rel); return null; } catch (error) { return error instanceof Error ? error.message : String(error); } };
  check('readPackFile reads a legitimate pack', rejects('zenkuri/space.json') === null);
  check('../ outside the root is refused', rejects('../outside/secret.json')?.includes('outside the packs root') === true);
  check('an absolute path is refused', rejects(outsidePack)?.includes('outside the packs root') === true);
  check('a non-.json extension is refused', rejects('zenkuri/sagas/notes.txt')?.includes('.json') === true);
  check('a file symlink is refused', rejects('zenkuri/sagas/evil.json')?.includes('symlink') === true);
  check('an intermediate directory symlink is refused', rejects('zenkuri/linkdir/secret.json')?.includes('outside the packs root') === true, rejects('zenkuri/linkdir/secret.json') ?? 'accepted');

  const previous = process.env.ZENKURI_COMMUNITY_DIR;
  process.env.ZENKURI_COMMUNITY_DIR = root;
  check('ZENKURI_COMMUNITY_DIR sets the root', resolveCommunityRoot() === resolve(root));
  if (previous === undefined) delete process.env.ZENKURI_COMMUNITY_DIR;
  else process.env.ZENKURI_COMMUNITY_DIR = previous;
  check('default is <cwd>/community', resolveCommunityRoot() === resolve(process.cwd(), 'community'));

  const orphanRoot = join(work, 'orphan');
  writeJson(join(orphanRoot, 'zenkuri', 'sagas', 'x.json'), {});
  const orphan = loadPacks(orphanRoot);
  check('a publication without space.json becomes an error, not a crash', orphan.errors.some((e) => e.includes('space.json')) && orphan.publications.length === 0, orphan.errors.join('|'));
  const garbage = join(work, 'garbage');
  mkdirSync(join(garbage, 'zenkuri', 'sagas'), { recursive: true });
  writeFileSync(join(garbage, 'zenkuri', 'space.json'), '{ nope');
  const bad = loadPacks(garbage);
  check('malformed JSON becomes an error naming the file', bad.errors.some((e) => e.includes('zenkuri/space.json') && e.includes('invalid JSON')), bad.errors.join('|'));
}

// ─── Plan validators ───────────────────────────────────────────────────

console.log('\n— Plan validators —');
{
  const ok = parseEntryInput({ section: 'phase', phaseId: 1, title: 'X', hours: 5, kind: 'foco', flags: ['coop', 'coop', 'risco'] });
  check('valid phase entry (deduplicated flags)', ok.ok && ok.value.flags?.length === 2);
  const bad = parseEntryInput({ section: 'phase', title: 'X', kind: 'epic', flags: ['x'] });
  check('phase without phaseId/hours and invalid kind/flag', !bad.ok && bad.errors.some((e) => e.includes('phaseId')) && bad.errors.some((e) => e.includes('hours')) && bad.errors.some((e) => e.includes('kind')) && bad.errors.some((e) => e.includes('flags[0]')), bad.ok ? '' : bad.errors.join('|'));
  check('a loose section does not need kind/hours', parseEntryInput({ section: 'after', title: 'X', ref: { platform: 'steam', id: '1' }, note: 'reason' }).ok);
  check('ref and external together are refused', !parseEntryInput({ section: 'after', title: 'X', ref: { platform: 'steam', id: '1' }, external: { label: 'PS5' } }).ok);
  check('an empty patch is refused', !parseEntryPatch({}).ok);
  check('phase with end before start', !parsePhaseInput({ slug: 'F1', title: 'T', start: '2026-02-01', end: '2026-01-01', capacity: 1 }).ok);
  check('reorder rejects repeated ids', !parseReorder({ ids: [1, 1] }, { scoped: false }).ok);
}

// ─── Plan: routes and ownership ───────────────────────────────────────────────────

console.log('\n— Plan: CRUD and ownership (local HTTP) —');
const alice = createUser('alice', 'Alice', 'x');
const bob = createUser('bob', 'Bob', 'x');

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.userId = Number(req.get('x-test-user'));
  next();
});
app.use('/api/plan', planRouter);
app.use('/api/game-notes', gameNotesRouter);
app.use('/api/community', communityRouter);
const server: Server = await new Promise((done) => { const s = app.listen(0, '127.0.0.1', () => done(s)); });
const address = server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

async function call(user: number, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-test-user': String(user) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as Record<string, any> | null;
  return { status: res.status, json };
}

try {
  check('GET /plan without a plan returns null', (await call(alice.id, 'GET', '/api/plan')).json === null);
  check('PATCH /plan without a plan is 404', (await call(alice.id, 'PATCH', '/api/plan', { title: 'X' })).status === 404);

  const created = await call(alice.id, 'POST', '/api/plan', { title: "Alice's plan", weeklyHours: 20 });
  check('POST /plan creates (201)', created.status === 201 && created.json?.title === "Alice's plan" && created.json?.phases.length === 0);
  check('POST /plan again is 409', (await call(alice.id, 'POST', '/api/plan', {})).status === 409);
  check('an invalid POST /plan is 400 with the field', await (async () => { const r = await call(bob.id, 'POST', '/api/plan', { weeklyHours: 'lots' }); return r.status === 400 && String(r.json?.error).includes('weeklyHours'); })());
  check('PATCH /plan updates', (await call(alice.id, 'PATCH', '/api/plan', { principle: 'Continuous blocks', baselineAvg: 50 })).json?.principle === 'Continuous blocks');

  const phase = (await call(alice.id, 'POST', '/api/plan/phases', { slug: 'F1', title: 'Phase 1', start: '2026-10-13', end: '2026-11-18', capacity: 100 })).json!;
  const phase2 = (await call(alice.id, 'POST', '/api/plan/phases', { slug: 'F2', title: 'Phase 2', start: '2026-11-19', end: '2026-12-31', capacity: 50, floating: true })).json!;
  check('phases created with ascending position', phase.position === 0 && phase2.position === 1 && phase2.floating === true);
  const dupPhase = await call(alice.id, 'POST', '/api/plan/phases', { slug: 'F1', title: 'Dup', start: '2026-10-13', end: '2026-10-14', capacity: 1 });
  check('a duplicate phase slug is 409 with a code and details', dupPhase.status === 409 && dupPhase.json?.code === 'plan.slug_taken' && dupPhase.json?.details?.[0]?.field === 'slug', JSON.stringify(dupPhase.json));

  const entry = (await call(alice.id, 'POST', '/api/plan/entries', { section: 'phase', phaseId: phase.id, title: 'Game A', ref: { platform: 'steam', id: '10' }, hours: 8, kind: 'platina', flags: ['online'] })).json!;
  const entry2 = (await call(alice.id, 'POST', '/api/plan/entries', { section: 'phase', phaseId: phase.id, title: 'Game B', hours: 4, kind: 'limpeza', target: 60 })).json!;
  const ps5 = (await call(alice.id, 'POST', '/api/plan/entries', { section: 'phase', phaseId: phase2.id, title: 'GTA VI', external: { label: 'PS5', releaseDate: '2026-11-19' }, hours: 120, kind: 'foco' })).json!;
  const loose = (await call(alice.id, 'POST', '/api/plan/entries', { section: 'accept', title: 'Lost Ark', ref: { platform: 'steam', id: '1599340' }, note: 'MMO' })).json!;
  check('entries: ref, external, flags and loose section preserved', entry.ref?.id === '10' && entry.flags[0] === 'online' && ps5.external?.releaseDate === '2026-11-19' && loose.hours === null && loose.kind === null && loose.note === 'MMO');
  const milestone = (await call(alice.id, 'POST', '/api/plan/milestones', { title: 'GTA VI', date: '2026-11-19', label: '19/11/2026', note: 'PS5' })).json!;
  const vacation = (await call(alice.id, 'POST', '/api/plan/vacations', { slug: 'A', start: '2027-02-01', end: '2027-02-07', days: 7, purpose: 'Sprint' })).json!;
  const risk = (await call(alice.id, 'POST', '/api/plan/risks', { risk: 'Postpone', action: 'Plan B' })).json!;
  check('milestone, vacation and risk created', milestone.id > 0 && vacation.slug === 'A' && risk.risk === 'Postpone');

  const full = (await call(alice.id, 'GET', '/api/plan')).json!;
  check('GET /plan returns the full tree', full.phases.length === 2 && full.phases[0].entries.length === 2 && full.phases[1].entries[0].title === 'GTA VI'
    && full.acceptAsIs.length === 1 && full.milestones.length === 1 && full.vacations.length === 1 && full.risks.length === 1);

  // Bob: no plan → nothing visible and everything is 404.
  check('Bob does not see Alice\'s plan', (await call(bob.id, 'GET', '/api/plan')).json === null);
  const bobNoPlan = await call(bob.id, 'PATCH', `/api/plan/phases/${phase.id}`, { title: 'X' });
  check('Bob without a plan: PATCH on Alice\'s phase is 404', bobNoPlan.status === 404);

  await call(bob.id, 'POST', '/api/plan', { title: "Bob's plan" });
  const bobPhase = (await call(bob.id, 'POST', '/api/plan/phases', { slug: 'B1', title: 'B1', start: '2026-01-01', end: '2026-01-31', capacity: 10 })).json!;
  const targets: Array<[string, number, Record<string, unknown>]> = [
    ['phases', phase.id, { title: 'Hack' }],
    ['entries', entry.id, { title: 'Hack' }],
    ['milestones', milestone.id, { title: 'Hack' }],
    ['vacations', vacation.id, { purpose: 'Hack' }],
    ['risks', risk.id, { risk: 'Hack' }],
  ];
  for (const [resource, id, patch] of targets) {
    const patched = await call(bob.id, 'PATCH', `/api/plan/${resource}/${id}`, patch);
    const deleted = await call(bob.id, 'DELETE', `/api/plan/${resource}/${id}`);
    check(`Bob cannot change or delete Alice's ${resource} (404/404)`, patched.status === 404 && deleted.status === 404, `${patched.status}/${deleted.status}`);
  }
  check('Bob cannot create an entry in Alice\'s phase', (await call(bob.id, 'POST', '/api/plan/entries', { section: 'phase', phaseId: phase.id, title: 'Intruder', hours: 1, kind: 'foco' })).status === 404);
  check('Bob cannot move his entry into Alice\'s phase', await (async () => {
    const mine = (await call(bob.id, 'POST', '/api/plan/entries', { section: 'phase', phaseId: bobPhase.id, title: 'Mine', hours: 1, kind: 'foco' })).json!;
    return (await call(bob.id, 'PATCH', `/api/plan/entries/${mine.id}`, { phaseId: phase.id })).status === 404;
  })());
  check('Bob cannot reorder Alice\'s phases', (await call(bob.id, 'POST', '/api/plan/phases/reorder', { ids: [phase2.id, phase.id] })).status === 404);
  check('Bob cannot reorder Alice\'s entries', (await call(bob.id, 'POST', '/api/plan/entries/reorder', { section: 'phase', phaseId: phase.id, ids: [entry2.id, entry.id] })).status === 404);

  const after = (await call(alice.id, 'GET', '/api/plan')).json!;
  check('Alice\'s plan is still intact', after.phases[0].title === 'Phase 1' && after.phases[0].entries.length === 2 && after.milestones[0].title === 'GTA VI' && after.risks[0].risk === 'Postpone');
  check('Bob\'s plan only has his own', (await call(bob.id, 'GET', '/api/plan')).json?.phases.length === 1);

  // Alice: editing, validation and reordering.
  check('PATCH on an entry changes fields and swaps ref for external', await (async () => {
    const r = await call(alice.id, 'PATCH', `/api/plan/entries/${entry.id}`, { hours: 9, external: { label: 'Launch' }, flags: [] });
    return r.status === 200 && r.json?.hours === 9 && r.json?.ref === null && r.json?.external?.label === 'Launch';
  })());
  check('a phase entry does not accept a null kind', (await call(alice.id, 'PATCH', `/api/plan/entries/${entry.id}`, { kind: null })).status === 400);
  check('an invalid kind is 400', (await call(alice.id, 'POST', '/api/plan/entries', { section: 'recurring', title: 'FC', hours: 3, kind: 'zzz' })).status === 400);
  check('a non-numeric id is 404', (await call(alice.id, 'PATCH', '/api/plan/entries/abc', { title: 'x' })).status === 404);
  check('moving an entry to another phase of Alice\'s own', (await call(alice.id, 'PATCH', `/api/plan/entries/${entry2.id}`, { phaseId: phase2.id })).json?.phaseId === phase2.id);
  await call(alice.id, 'PATCH', `/api/plan/entries/${entry2.id}`, { phaseId: phase.id });

  const reordered = (await call(alice.id, 'POST', '/api/plan/entries/reorder', { section: 'phase', phaseId: phase.id, ids: [entry2.id, entry.id] })).json!;
  check('reordering the phase entries', reordered.phases[0].entries.map((e: { id: number }) => e.id).join() === [entry2.id, entry.id].join());
  const reorderedPhases = (await call(alice.id, 'POST', '/api/plan/phases/reorder', { ids: [phase2.id] })).json!;
  check('reordering phases: listed first, the rest after', reorderedPhases.phases.map((p: { slug: string }) => p.slug).join() === 'F2,F1');

  check('deleting a phase takes its entries along (cascade)', await (async () => {
    await call(alice.id, 'DELETE', `/api/plan/phases/${phase2.id}`);
    return count('select count(*) n from plan_entries where id = ?', ps5.id) === 0 && count('select count(*) n from plan_phases where plan_id = ?', after.id) === 1;
  })());

  // Per-game notes.
  const insertGame = db.prepare("insert into games (platform, external_id, title, last_synced_at) values (?, ?, ?, '2026-10-01')");
  const ownedId = Number(insertGame.run('steam', '777', 'My Game').lastInsertRowid);
  const foreignId = Number(insertGame.run('steam', '888', 'Someone Else\'s Game').lastInsertRowid);
  db.prepare("insert into user_games (user_id, game_id, last_synced_at) values (?, ?, '2026-10-01')").run(alice.id, ownedId);
  db.prepare("insert into user_games (user_id, game_id, last_synced_at) values (?, ?, '2026-10-01')").run(bob.id, foreignId);
  const put = await call(alice.id, 'PUT', `/api/game-notes/${ownedId}`, { estimate: '2–4h', note: 'almost there' });
  check('PUT game-notes creates the note', put.status === 200 && put.json?.estimate === '2–4h' && put.json?.title === 'My Game');
  check('a partial PUT preserves the other field', (await call(alice.id, 'PUT', `/api/game-notes/${ownedId}`, { note: 'reviewed' })).json?.estimate === '2–4h');
  check('PUT on a game the user does not own is 404', (await call(alice.id, 'PUT', `/api/game-notes/${foreignId}`, { note: 'x' })).status === 404);
  check('PUT without fields is 400', (await call(alice.id, 'PUT', `/api/game-notes/${ownedId}`, {})).status === 400);
  check('GET game-notes is per user', (await call(alice.id, 'GET', '/api/game-notes')).json?.notes.length === 1 && (await call(bob.id, 'GET', '/api/game-notes')).json?.notes.length === 0);
  check('Bob cannot delete Alice\'s note', (await call(bob.id, 'DELETE', `/api/game-notes/${ownedId}`)).status === 404 && count('select count(*) n from game_notes where user_id = ?', alice.id) === 1);
  check('DELETE game-notes removes', (await call(alice.id, 'DELETE', `/api/game-notes/${ownedId}`)).status === 200 && count('select count(*) n from game_notes where user_id = ?', alice.id) === 0);

  // Community (read-only).
  const spaces = (await call(alice.id, 'GET', '/api/community/spaces')).json!;
  check('GET spaces lists the space with its count', spaces.spaces.length === 1 && spaces.spaces[0].slug === 'zenkuri' && spaces.spaces[0].publicationCount === 3);
  check('GET publications filters by kind', (await call(alice.id, 'GET', '/api/community/publications?kind=saga')).json?.publications.length === 2
    && (await call(alice.id, 'GET', '/api/community/publications?kind=ranking')).json?.publications.length === 1
    && (await call(alice.id, 'GET', '/api/community/publications')).json?.publications.length === 3);
  const invalidKind = await call(alice.id, 'GET', '/api/community/publications?kind=poem');
  check('an invalid kind is 400 with a code and details', invalidKind.status === 400 && invalidKind.json?.code === 'validation.invalid' && invalidKind.json?.details?.[0]?.field === 'kind', JSON.stringify(invalidKind.json));
  check('spaces and publications expose the language', spaces.spaces[0].language === 'pt-BR'
    && (await call(alice.id, 'GET', '/api/community/publications')).json?.publications.every((p: { language?: string }) => p.language === 'pt-BR'));
  const one = await call(bob.id, 'GET', '/api/community/publications/zenkuri/saga/final-fantasy');
  check('GET of one publication brings payload and author (any user)', one.status === 200 && one.json?.payload.phases.length === 8 && one.json?.author.handle === 'joel' && one.json?.origin === 'community/zenkuri/sagas/final-fantasy.json');
  const missing = await call(bob.id, 'GET', '/api/community/publications/zenkuri/saga/nope');
  check('a nonexistent publication is 404 with a code', missing.status === 404 && missing.json?.code === 'community.publication_not_found', JSON.stringify(missing.json));
  check('one publication exposes the language', one.json?.language === 'pt-BR');
  check('there is no write on publications', (await call(bob.id, 'POST', '/api/community/publications', {})).status === 404 && (await call(bob.id, 'DELETE', '/api/community/publications/zenkuri/saga/final-fantasy')).status === 404);
} finally {
  server.close();
}

// ─── personal:import ────────────────────────────────────────────────────────

console.log('\n— personal:import on a throwaway database —');
{
  const carol = createUser('carol', 'Carol', 'x');
  const synthetic: unknown = {
    schema: 'zenkuri.personal/v1',
    plan: {
      title: 'Synthetic plan', principle: 'p', weeklyHours: 10, baselineAvg: 50, targetAvg: null, createdAt: '2026-10-13',
      phases: [{
        slug: 'F1', title: 'F1', start: '2026-10-13', end: '2026-11-01', capacity: 40, summary: '', floating: false,
        entries: [
          { title: 'A', ref: { platform: 'steam', id: '10' }, hours: 5, kind: 'platina', note: '', flags: ['online'] },
          { title: 'Outside', external: { label: 'PS5', releaseDate: '2026-11-19' }, hours: 20, kind: 'foco', note: 'x', flags: [] },
        ],
      }],
      recurring: [{ title: 'FC', ref: { platform: 'steam', id: '4080220' }, hours: 3, kind: 'platina', target: 70, note: '', flags: [] }],
      afterPlan: [{ title: 'After', ref: { platform: 'steam', id: '377840' }, hours: 70, kind: null, note: 'first', flags: [] }],
      acceptAsIs: [{ title: 'Accept', ref: { platform: 'steam', id: '1599340' }, hours: null, kind: null, note: 'MMO', flags: [] }],
      ifTime: [{ title: 'If time', ref: { platform: 'psn', id: 'NPWR51746_00' }, hours: 60, kind: null, note: 'PS5', flags: [] }],
      milestones: [{ title: 'M', date: null, label: 'no date', note: '' }],
      vacations: [{ slug: 'A', start: '2027-02-01', end: '2027-02-07', days: 7, purpose: 'Sprint', note: '' }],
      risks: [{ risk: 'R', action: 'A' }],
    },
    gameNotes: [
      { platform: 'steam', externalId: '777', estimate: '1h', note: 'ok', category: ['finish'] },
      { platform: 'steam', externalId: '404404', estimate: null, note: 'gone', category: ['grind', 'quick'] },
    ],
  };
  const checked = validatePersonalFile('synthetic.json', synthetic);
  check('the synthetic personal file is valid', checked.ok, checked.ok ? '' : checked.errors.join('|'));
  const invalid = validatePersonalFile('broken.json', { schema: 'zenkuri.personal/v1', plan: { title: '' }, gameNotes: [{ platform: 'xbox' }] });
  check('an invalid personal file names the file and the field', !invalid.ok && invalid.errors.every((e) => e.startsWith('broken.json: ')) && invalid.errors.some((e) => e.includes('plan.phases')) && invalid.errors.some((e) => e.includes('gameNotes[0].platform')), invalid.ok ? '' : invalid.errors.slice(0, 4).join('|'));

  if (checked.ok) {
    const result = importPersonal(carol.id, checked.value, { replace: false });
    check('imports the full plan (all sections)', result.planImported && result.phases === 1 && result.entries === 6 && result.milestones === 1 && result.vacations === 1 && result.risks === 1, JSON.stringify(result));
    check('known-game note imported, unknown one skipped with a warning', result.notesImported === 1 && result.warnings.length === 1 && result.warnings[0].includes('404404') && result.warnings[0].includes('--notes-only'));
    const sections = db.prepare('select section, count(*) n from plan_entries where plan_id = (select id from plans where user_id = ?) group by section').all(carol.id) as Array<{ section: string; n: number }>;
    check('sections stored', sections.map((s) => `${s.section}:${s.n}`).sort().join() === 'accept:1,after:1,if_time:1,phase:2,recurring:1', JSON.stringify(sections));
    check('an entry outside the library keeps platform/external_id even without a synced game', count("select count(*) n from plan_entries where platform = 'steam' and external_id = '1599340' and plan_id = (select id from plans where user_id = ?)", carol.id) === 1);
    check('external_json preserved', count("select count(*) n from plan_entries where external_json like '%2026-11-19%'") >= 1);

    let refused = '';
    try { importPersonal(carol.id, checked.value, { replace: false }); } catch (error) { refused = error instanceof PersonalImportError ? error.message : String(error); }
    check('refuses when a plan already exists', refused.includes('--replace'), refused);
    check('the refusal changed nothing (transaction)', count('select count(*) n from plan_entries where plan_id = (select id from plans where user_id = ?)', carol.id) === 6);
    importPersonal(carol.id, checked.value, { replace: true });
    check('--replace replaces without duplicating', count('select count(*) n from plans where user_id = ?', carol.id) === 1 && count('select count(*) n from plan_entries where plan_id = (select id from plans where user_id = ?)', carol.id) === 6);

    // notesOnly: a note skipped because the game was missing is imported after the game appears.
    const erin = createUser('erin', 'Erin', 'x');
    const first = importPersonal(erin.id, checked.value, { replace: false });
    check('notesOnly setup: the note for the missing game was skipped', first.warnings.some((w) => w.includes('404404')) && count("select count(*) n from game_notes where user_id = ? and game_id in (select id from games where external_id = '404404')", erin.id) === 0);
    db.prepare("insert or ignore into games (platform, external_id, title, last_synced_at) values ('steam', '404404', 'Late game', '2026-10-01')").run();
    const erinEntries = count('select count(*) n from plan_entries where plan_id = (select id from plans where user_id = ?)', erin.id);
    let notesOnlyError = '';
    let followUp: ReturnType<typeof importPersonal> | undefined;
    try { followUp = importPersonal(erin.id, checked.value, { replace: false, notesOnly: true }); } catch (error) { notesOnlyError = String(error); }
    check('notesOnly imports the late note without a plan error', notesOnlyError === '' && followUp?.notesImported === 2 && followUp.warnings.length === 0 && !followUp.planImported, notesOnlyError || JSON.stringify(followUp));
    check('notesOnly stored the note and left the plan untouched', count("select count(*) n from game_notes where user_id = ? and game_id in (select id from games where external_id = '404404')", erin.id) === 1
      && count('select count(*) n from plans where user_id = ?', erin.id) === 1
      && count('select count(*) n from plan_entries where plan_id = (select id from plans where user_id = ?)', erin.id) === erinEntries);

    const partial: PersonalFile = { ...checked.value, plan: checked.value.plan && { ...checked.value.plan, phases: [{ ...checked.value.plan.phases[0], slug: 'dup' }, { ...checked.value.plan.phases[0], slug: 'dup' }] } };
    let rolledBack = false;
    try { importPersonal(carol.id, partial, { replace: true }); } catch { rolledBack = true; }
    check('an error midway rolls everything back (the old plan returns)', rolledBack && count('select count(*) n from plan_entries where plan_id = (select id from plans where user_id = ?)', carol.id) === 6 && count("select count(*) n from plan_phases where slug = 'F1' and plan_id = (select id from plans where user_id = ?)", carol.id) === 1);
  }
}

const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx');
function runImportScript(args: string[]) {
  const run = spawnSync(tsx, [join(repoRoot, 'server', 'scripts', 'personalImport.ts'), ...args], {
    cwd: repoRoot,
    env: { ...process.env, ZENKURI_DB_PATH: dbFile },
    encoding: 'utf8',
  });
  return { code: run.status, out: `${run.stdout}${run.stderr}` };
}

{
  // Always a synthetic file: the test must not depend on personal data present on the machine.
  const source = join(work, 'fallback-joel.json');
  writeJson(source, {
    schema: 'zenkuri.personal/v1',
    plan: {
      title: 'P', principle: '', weeklyHours: 1, baselineAvg: null, targetAvg: null, createdAt: '2026-10-13',
      phases: [{ slug: 'F1', title: 'F1', start: '2026-10-13', end: '2026-10-14', capacity: 1, summary: '', floating: false, entries: [{ title: 'A', ref: { platform: 'steam', id: '1001' }, hours: 1, kind: 'foco', note: '', flags: [] }] }],
      recurring: [], afterPlan: [], acceptAsIs: [], ifTime: [], milestones: [], vacations: [], risks: [],
    },
    gameNotes: [{ platform: 'steam', externalId: '1001', estimate: '1h', note: 'a', category: ['finish'] }, { platform: 'steam', externalId: '1002', estimate: '2h', note: 'b', category: ['finish'] }, { platform: 'steam', externalId: '1003', estimate: '3h', note: 'c', category: ['quick'] }],
  });

  const parsed = validatePersonalFile(source, JSON.parse(readFileSync(source, 'utf8')));
  check('the synthetic file is valid', parsed.ok, parsed.ok ? '' : parsed.errors.slice(0, 3).join('|'));
  if (parsed.ok && parsed.value.plan) {
    const plan = parsed.value.plan;
    const expectedEntries = plan.phases.reduce((sum, phase) => sum + phase.entries.length, 0)
      + plan.recurring.length + plan.afterPlan.length + plan.acceptAsIs.length + plan.ifTime.length;
    const notes = parsed.value.gameNotes;

    const joel = createUser('joel', 'Joel', 'x');
    const insertGame = db.prepare("insert or ignore into games (platform, external_id, title, last_synced_at) values (?, ?, ?, '2026-10-01')");
    // Two games stay out of the catalog to exercise the "skipped with a warning" path.
    const missing = notes.slice(0, 2);
    for (const note of notes.slice(2)) insertGame.run(note.platform, note.externalId, `Game ${note.externalId}`);

    const run = runImportScript(['--user', 'joel', '--file', source]);
    check('the script imports and exits with 0', run.code === 0, run.out);
    const plans = count('select count(*) n from plans where user_id = ?', joel.id);
    const entries = count('select count(*) n from plan_entries where plan_id = (select id from plans where user_id = ?)', joel.id);
    const savedNotes = count('select count(*) n from game_notes where user_id = ?', joel.id);
    console.log(`    plans: ${plans} · phases: ${count('select count(*) n from plan_phases where plan_id = (select id from plans where user_id = ?)', joel.id)} · entries: ${entries} (expected ${expectedEntries}) · notes: ${savedNotes} (of ${notes.length}, ${missing.length} without a game)`);
    check('plan count: 1 plan and all the entries', plans === 1 && entries === expectedEntries);
    check('note count: known games only', savedNotes === notes.length - missing.length);
    check('warnings list the unknown games', missing.every((note) => run.out.includes(`${note.platform}:${note.externalId}`)), run.out.slice(0, 300));

    const notesOnlyRun = runImportScript(['--user', 'joel', '--file', source, '--notes-only']);
    check('the script accepts --notes-only on an account that already has a plan', notesOnlyRun.code === 0 && count('select count(*) n from plans where user_id = ?', joel.id) === 1, notesOnlyRun.out);
    check('--notes-only conflicts with --replace', runImportScript(['--user', 'joel', '--file', source, '--replace', '--notes-only']).code === 1);

    const again = runImportScript(['--user', 'joel', '--file', source]);
    check('a second run without --replace is refused (code 1)', again.code === 1 && again.out.includes('--replace'), again.out);
    const replaced = runImportScript(['--user', 'joel', '--file', source, '--replace']);
    check('--replace works and keeps the same counts', replaced.code === 0
      && count('select count(*) n from plans where user_id = ?', joel.id) === 1
      && count('select count(*) n from plan_entries where plan_id = (select id from plans where user_id = ?)', joel.id) === expectedEntries
      && count('select count(*) n from game_notes where user_id = ?', joel.id) === savedNotes, replaced.out);
    check('a nonexistent user is refused', runImportScript(['--user', 'nobody', '--file', source]).code === 1);
    check('missing --user is refused', runImportScript(['--file', source]).code === 1);
    check('a missing file is refused', runImportScript(['--user', 'joel', '--file', join(work, 'nothing.json')]).code === 1);
  }
}

db.close();
for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbFile}${suffix}`, { force: true });
rmSync(work, { recursive: true, force: true });
if (!process.env.ZENKURI_TEST_DB_DIR) rmSync(testDir, { recursive: true, force: true });

console.log(`\n${failures === 0 ? '✅ all passed' : `❌ ${failures} failure(s)`}`);
process.exit(failures === 0 ? 0 : 1);
