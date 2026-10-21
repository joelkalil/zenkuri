/*
  Test of the automatic rankings read path (npm run test:rankings).
  Uses a throwaway database: ZENKURI_TEST_DB_DIR (or a temporary directory),
  never the real database.
*/
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.log(`  ✗ ${name} ${detail}`); } else console.log(`  ✓ ${name}`);
}

const testDir = process.env.ZENKURI_TEST_DB_DIR ?? mkdtempSync(join(tmpdir(), 'zenkuri-rankings-test-'));
mkdirSync(testDir, { recursive: true });
const dbFile = join(testDir, `rankings-${process.pid}.sqlite`);
for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbFile}${suffix}`, { force: true });
process.env.ZENKURI_DB_PATH = dbFile;

// The database may only be opened after ZENKURI_DB_PATH points at the throwaway one.
const { db, createUser } = await import('../db');
const { getAutoRankings, listRankingInputs, listRemainingRarities } = await import('./auto');

const ts = '2026-10-01';
const alice = createUser('alice', 'Alice', 'x');
const bob = createUser('bob', 'Bob', 'x');

function insertGame(platform: string, externalId: string, title: string): number {
  return Number(db.prepare('insert into games (platform, external_id, title, last_synced_at) values (?, ?, ?, ?)')
    .run(platform, externalId, title, ts).lastInsertRowid);
}
function own(userId: number, gameId: number, playtime: number) {
  db.prepare('insert into user_games (user_id, game_id, playtime_minutes, last_synced_at) values (?, ?, ?, ?)')
    .run(userId, gameId, playtime, ts);
}
function addAchievements(gameId: number, count: number, globalPercents: number[]): number[] {
  const insert = db.prepare('insert into achievements (game_id, external_id, title, display_order, metadata_json) values (?, ?, ?, ?, ?)');
  return Array.from({ length: count }, (_, index) => Number(insert.run(
    gameId, `a${index}`, `Achievement ${index}`, index, JSON.stringify({ globalPercent: globalPercents[index] ?? 50 }),
  ).lastInsertRowid));
}
function unlock(userId: number, achievementIds: number[]) {
  const insert = db.prepare('insert into user_achievements (user_id, achievement_id, achieved, unlock_time) values (?, ?, 1, 1)');
  for (const id of achievementIds) insert.run(userId, id);
}

const near = insertGame('steam', '100', 'Almost There');
const nearAchievements = addAchievements(near, 12, [...Array.from({ length: 10 }, () => 50), 30, 18]);
const bare = insertGame('steam', '200', 'No Achievements');
const alone = insertGame('steam', '300', 'Bob Only');
const aloneAchievements = addAchievements(alone, 12, []);

own(alice.id, near, 600);
own(alice.id, bare, 30);
own(bob.id, near, 60);
own(bob.id, alone, 120);
unlock(alice.id, nearAchievements.slice(0, 10));
unlock(bob.id, nearAchievements.slice(0, 2));
unlock(bob.id, aloneAchievements.slice(0, 11));

console.log('\n— Remaining rarities (single query) —');
{
  const rarities = listRemainingRarities(alice.id);
  check('only the locked achievements, in database order', JSON.stringify(rarities.get(near)) === JSON.stringify([30, 18]));
  check('a game with no achievement rows stays out of the map', !rarities.has(bare));
  check('a game the user does not own stays out of the map', !rarities.has(alone));
  check('another user sees their own progress', listRemainingRarities(bob.id).get(near)?.length === 10);
}

console.log('\n— Engine inputs —');
{
  const inputs = listRankingInputs(alice.id);
  const nearInput = inputs.find((input) => input.gameId === near);
  check('one input per library game', inputs.length === 2);
  check('mapped fields', nearInput?.externalId === '100' && nearInput.platform === 'steam' && nearInput.title === 'Almost There'
    && nearInput.playtimeMinutes === 600 && nearInput.unlocked === 10 && nearInput.total === 12 && nearInput.percent === 83);
  const rawGroup = (id: number) => (db.prepare('select group_id as groupId from games where id = ?').get(id) as { groupId: number | null }).groupId;
  check('groupId is the raw group_id of the games table', inputs.every((input) => input.groupId === rawGroup(input.gameId)));
  check('no achievements: empty remainingRarities', inputs.find((input) => input.gameId === bare)?.remainingRarities.length === 0);
}

console.log('\n— getAutoRankings —');
{
  const { lists } = getAutoRankings(alice.id);
  check('four lists in order', lists.map((list) => list.id).join() === 'finish,quick,grind,demanding');
  const finish = lists[0].entries;
  check('Finish now brings the almost-completed game', finish.length === 1 && finish[0].gameId === near);
  check('the game with no achievements is in no list', lists.every((list) => list.entries.every((entry) => entry.gameId !== bare)));
  check('does not leak another user\'s games', lists.every((list) => list.entries.every((entry) => entry.gameId !== alone)));
  const bobLists = getAutoRankings(bob.id).lists;
  check('the other user gets their own derivation', bobLists[0].entries.some((entry) => entry.gameId === alone));
}

db.close();
for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbFile}${suffix}`, { force: true });

console.log(failures === 0 ? '\nOK' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
