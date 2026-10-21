import assert from 'node:assert/strict';
import { envBool, envInt, envString } from './env';

const KEY = 'ZENKURI_ENV_TEST_VALUE';
let passed = 0;

function withEnv(value: string | undefined, run: () => void) {
  const previous = process.env[KEY];
  if (value === undefined) delete process.env[KEY];
  else process.env[KEY] = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[KEY];
    else process.env[KEY] = previous;
  }
}

function check(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('env helpers');

check('envString returns the fallback when unset', () => {
  withEnv(undefined, () => assert.equal(envString(KEY, 'fallback'), 'fallback'));
});
check('envString treats an empty value as unset', () => {
  withEnv('', () => assert.equal(envString(KEY, 'fallback'), 'fallback'));
});
check('envString treats a whitespace-only value as unset', () => {
  withEnv('   ', () => assert.equal(envString(KEY, 'fallback'), 'fallback'));
});
check('envString trims the value', () => {
  withEnv('  value  ', () => assert.equal(envString(KEY, 'fallback'), 'value'));
});
check('envString returns undefined without a fallback', () => {
  withEnv('', () => assert.equal(envString(KEY), undefined));
});
check('envInt parses integers and falls back on blank or invalid values', () => {
  withEnv('4343', () => assert.equal(envInt(KEY, 1), 4343));
  withEnv('', () => assert.equal(envInt(KEY, 1), 1));
  withEnv('abc', () => assert.equal(envInt(KEY, 1), 1));
  withEnv('1.5', () => assert.equal(envInt(KEY, 1), 1));
  withEnv('0', () => assert.equal(envInt(KEY, 1), 0));
});
check('envBool parses flags and falls back on blank or unknown values', () => {
  withEnv('true', () => assert.equal(envBool(KEY, false), true));
  withEnv('0', () => assert.equal(envBool(KEY, true), false));
  withEnv('', () => assert.equal(envBool(KEY, true), true));
  withEnv('maybe', () => assert.equal(envBool(KEY, false), false));
});

console.log(`\nAll ${passed} env checks passed.`);
