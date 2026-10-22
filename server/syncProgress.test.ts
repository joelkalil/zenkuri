/*
  Tests of the in-memory update progress registry (npm run test:server).
  Pure logic, no Express and no database; the clock is injected.
*/
import assert from 'node:assert/strict';
import { FINISHED_TTL_MS, STALE_RUN_MS, createSyncProgressRegistry, percentFor } from './syncProgress';

let passed = 0;

function check(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function setup() {
  const clock = { value: 1_000 };
  const registry = createSyncProgressRegistry({ now: () => clock.value });
  return { clock, registry };
}

console.log('sync progress');

check('weights library 0, media 10, achievements 15 to 100, done 100', () => {
  assert.equal(percentFor('queued', 0, 0), 0);
  assert.equal(percentFor('library', 0, 0), 0);
  assert.equal(percentFor('media', 0, 0), 10);
  assert.equal(percentFor('achievements', 0, 80), 15);
  assert.equal(percentFor('achievements', 40, 80), 58);
  assert.equal(percentFor('achievements', 80, 80), 100);
  assert.equal(percentFor('done', 0, 0), 100);
});

check('achievements with total 0 jump straight to 100', () => {
  assert.equal(percentFor('achievements', 0, 0), 100);
});

check('achievements ratio is clamped to 0-100', () => {
  assert.equal(percentFor('achievements', 200, 80), 100);
  assert.equal(percentFor('achievements', -5, 80), 15);
});

check('queued, then running, then done', () => {
  const { registry } = setup();
  const runId = registry.start(1, ['steam', 'psn']);
  assert.ok(runId);
  assert.deepEqual(registry.get(1)?.platforms.map((item) => [item.platform, item.status, item.percent]), [
    ['steam', 'queued', 0],
    ['psn', 'queued', 0],
  ]);

  registry.update(1, runId, 'steam', { status: 'library' });
  registry.update(1, runId, 'steam', { status: 'media' });
  assert.equal(registry.get(1)?.platforms[0]?.percent, 10);
  registry.update(1, runId, 'steam', { status: 'achievements', done: 0, total: 4 });
  registry.update(1, runId, 'steam', { status: 'achievements', done: 2, total: 4 });
  const steam = registry.get(1)?.platforms[0];
  assert.equal(steam?.status, 'achievements');
  assert.equal(steam?.percent, 58);
  assert.equal(registry.get(1)?.platforms[1]?.status, 'queued');

  registry.complete(1, runId, 'steam');
  registry.complete(1, runId, 'psn');
  assert.equal(registry.isRunning(1), true);
  registry.finish(1, runId);
  const state = registry.get(1);
  assert.equal(registry.isRunning(1), false);
  assert.ok(state?.finishedAt !== undefined);
  assert.deepEqual(state?.platforms.map((item) => [item.status, item.percent]), [['done', 100], ['done', 100]]);
});

check('start returns the runId of the current state', () => {
  const { registry } = setup();
  const runId = registry.start(1, ['steam']);
  assert.equal(typeof runId, 'string');
  assert.equal(registry.get(1)?.runId, runId);
});

check('error keeps the last percent and records the code', () => {
  const { registry } = setup();
  const runId = registry.start(1, ['steam']) as string;
  registry.update(1, runId, 'steam', { status: 'achievements', done: 1, total: 2 });
  registry.fail(1, runId, 'steam', 'sync.steam_key_rejected');
  registry.update(1, runId, 'steam', { status: 'media' });
  registry.complete(1, runId, 'steam');
  const item = registry.get(1)?.platforms[0];
  assert.equal(item?.status, 'error');
  assert.equal(item?.percent, 58);
  assert.equal(item?.errorCode, 'sync.steam_key_rejected');
});

check('error without a code leaves errorCode undefined', () => {
  const { registry } = setup();
  const runId = registry.start(1, ['psn']) as string;
  registry.fail(1, runId, 'psn');
  assert.equal(registry.get(1)?.platforms[0]?.errorCode, undefined);
});

check('finish marks platforms that never completed as errors', () => {
  const { registry } = setup();
  const runId = registry.start(1, ['steam', 'psn']) as string;
  registry.complete(1, runId, 'steam');
  registry.finish(1, runId);
  assert.deepEqual(registry.get(1)?.platforms.map((item) => item.status), ['done', 'error']);
});

check('a second start while running is refused and keeps the state intact', () => {
  const { registry } = setup();
  const first = registry.start(1, ['steam']) as string;
  registry.update(1, first, 'steam', { status: 'media' });
  assert.equal(registry.start(1, ['steam', 'psn']), null);
  assert.equal(registry.get(1)?.runId, first);
  assert.equal(registry.get(1)?.platforms.length, 1);
  assert.equal(registry.get(1)?.platforms[0]?.percent, 10);
});

check('a new run can start once the previous one finished', () => {
  const { registry } = setup();
  const first = registry.start(1, ['steam']) as string;
  registry.finish(1, first);
  const second = registry.start(1, ['psn']);
  assert.ok(second);
  assert.notEqual(second, first);
});

check('finished state expires after the TTL', () => {
  const { clock, registry } = setup();
  const runId = registry.start(1, ['steam']) as string;
  registry.complete(1, runId, 'steam');
  registry.finish(1, runId);
  clock.value += FINISHED_TTL_MS - 1;
  assert.ok(registry.get(1));
  clock.value += 1;
  assert.equal(registry.get(1), null);
});

check('after the TTL drop a new run is not affected by the old activity timestamp', () => {
  // updatedAt is private; observe it through staleness. The new run must be judged only by its own activity.
  const clock = { value: 0 };
  const registry = createSyncProgressRegistry({ now: () => clock.value, ttlMs: 10, staleMs: 100 });
  const first = registry.start(1, ['steam']) as string;
  registry.finish(1, first);
  clock.value = 10;
  assert.equal(registry.get(1), null);
  const second = registry.start(1, ['steam']) as string;
  clock.value = 109;
  assert.equal(registry.isRunning(1), true);
  registry.update(1, second, 'steam', { status: 'media' });
  assert.equal(registry.get(1)?.platforms[0]?.status, 'media');
});

check('a running state never expires', () => {
  const { clock, registry } = setup();
  registry.start(1, ['steam']);
  clock.value += FINISHED_TTL_MS * 10;
  assert.ok(registry.get(1));
  assert.equal(registry.isRunning(1), true);
});

check('users are isolated from each other', () => {
  const { registry } = setup();
  const run1 = registry.start(1, ['steam']) as string;
  const run2 = registry.start(2, ['psn']) as string;
  registry.update(1, run1, 'steam', { status: 'media' });
  registry.fail(2, run2, 'psn', 'sync.psn_credential_expired');
  assert.equal(registry.get(1)?.platforms[0]?.platform, 'steam');
  assert.equal(registry.get(1)?.platforms[0]?.status, 'media');
  assert.equal(registry.get(2)?.platforms[0]?.status, 'error');
  assert.equal(registry.get(3), null);
  registry.finish(2, run2);
  assert.equal(registry.isRunning(1), true);
  assert.equal(registry.isRunning(2), false);
});

check('updating a platform that is not part of the run is ignored', () => {
  const { registry } = setup();
  const runId = registry.start(1, ['steam']) as string;
  registry.update(1, runId, 'psn', { status: 'media' });
  registry.update(9, runId, 'steam', { status: 'media' });
  assert.equal(registry.get(1)?.platforms.length, 1);
  assert.equal(registry.get(1)?.platforms[0]?.status, 'queued');
});

check('start succeeds after a stale unfinished run', () => {
  const { clock, registry } = setup();
  const first = registry.start(1, ['steam']);
  clock.value += STALE_RUN_MS;
  const second = registry.start(1, ['steam']);
  assert.notEqual(second, null);
  assert.notEqual(second, first);
  assert.equal(registry.isRunning(1), true);
});

check('a replaced stale run cannot touch the new run', () => {
  const { clock, registry } = setup();
  const stale = registry.start(1, ['steam', 'psn']) as string;
  clock.value += STALE_RUN_MS;
  const fresh = registry.start(1, ['steam', 'psn']) as string;
  registry.update(1, fresh, 'steam', { status: 'media' });

  registry.update(1, stale, 'steam', { status: 'achievements', done: 1, total: 2 });
  registry.complete(1, stale, 'steam');
  registry.fail(1, stale, 'steam', 'sync.stale');
  registry.complete(1, stale, 'psn');
  registry.fail(1, stale, 'psn', 'sync.stale');
  registry.finish(1, stale);

  const state = registry.get(1);
  assert.equal(state?.runId, fresh);
  assert.equal(state?.finishedAt, undefined);
  assert.equal(registry.isRunning(1), true);
  assert.deepEqual(state?.platforms.map((item) => [item.status, item.percent, item.errorCode]), [
    ['media', 10, undefined],
    ['queued', 0, undefined],
  ]);
});

check('the current run still works after a stale one was replaced', () => {
  const { clock, registry } = setup();
  registry.start(1, ['steam']);
  clock.value += STALE_RUN_MS;
  const fresh = registry.start(1, ['steam', 'psn']) as string;
  registry.update(1, fresh, 'steam', { status: 'media' });
  registry.complete(1, fresh, 'steam');
  registry.fail(1, fresh, 'psn', 'sync.psn_credential_expired');
  registry.finish(1, fresh);
  const state = registry.get(1);
  assert.ok(state?.finishedAt !== undefined);
  assert.deepEqual(state?.platforms.map((item) => [item.status, item.errorCode]), [
    ['done', undefined],
    ['error', 'sync.psn_credential_expired'],
  ]);
});

check('a finished run id cannot finish or modify a later run', () => {
  const { registry } = setup();
  const first = registry.start(1, ['steam']) as string;
  registry.finish(1, first);
  const second = registry.start(1, ['steam']) as string;
  registry.finish(1, first);
  registry.update(1, first, 'steam', { status: 'media' });
  assert.equal(registry.isRunning(1), true);
  assert.equal(registry.get(1)?.runId, second);
  assert.equal(registry.get(1)?.platforms[0]?.status, 'queued');
});

check('a non-stale run still blocks start', () => {
  const { clock, registry } = setup();
  registry.start(1, ['steam']);
  clock.value += STALE_RUN_MS - 1;
  assert.equal(registry.start(1, ['steam']), null);
});

check('progress updates keep a run from going stale', () => {
  const { clock, registry } = setup();
  const runId = registry.start(1, ['steam']) as string;
  clock.value += STALE_RUN_MS - 1;
  registry.update(1, runId, 'steam', { status: 'media' });
  clock.value += STALE_RUN_MS - 1;
  assert.equal(registry.isRunning(1), true);
  assert.equal(registry.start(1, ['steam']), null);
});

check('reading a stale run finalizes it with errors', () => {
  const { clock, registry } = setup();
  const runId = registry.start(1, ['steam', 'psn']) as string;
  registry.complete(1, runId, 'steam');
  clock.value += STALE_RUN_MS;
  const state = registry.get(1);
  assert.equal(state?.finishedAt, clock.value);
  assert.equal(state?.platforms[0]?.status, 'done');
  assert.equal(state?.platforms[1]?.status, 'error');
  assert.equal(registry.isRunning(1), false);
});

check('staleMs is configurable', () => {
  const clock = { value: 0 };
  const registry = createSyncProgressRegistry({ now: () => clock.value, staleMs: 100 });
  registry.start(1, ['steam']);
  clock.value = 100;
  assert.equal(registry.isRunning(1), false);
});

console.log(`\n${passed} checks passed`);
