import assert from 'node:assert/strict';
import type { Response } from 'express';
import { API_ERROR_CODES } from './errorCodes';
import { ApiError, defaultErrorMessage, sendApiError, sendError, toErrorResponse } from './errors';
import { Issues } from './validation';

let passed = 0;

function check(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

interface FakeResponse {
  statusCode?: number;
  body?: unknown;
  res: Response;
}

function fakeResponse(): FakeResponse {
  const fake: FakeResponse = { res: undefined as unknown as Response };
  const partial = {
    status(code: number) {
      fake.statusCode = code;
      return partial;
    },
    json(body: unknown) {
      fake.body = body;
      return partial;
    },
  };
  fake.res = partial as unknown as Response;
  return fake;
}

console.log('api errors');

check('every error code has a non-empty English default message', () => {
  for (const code of API_ERROR_CODES) {
    assert.ok(defaultErrorMessage(code).length > 0, code);
  }
});

check('error codes are unique', () => {
  assert.equal(new Set(API_ERROR_CODES).size, API_ERROR_CODES.length);
});

check('sendError responds { error, code } without details by default', () => {
  const fake = fakeResponse();
  sendError(fake.res, 404, 'game.not_found');
  assert.equal(fake.statusCode, 404);
  assert.deepEqual(fake.body, { error: 'Game not found.', code: 'game.not_found' });
});

check('sendError includes details and accepts a message override', () => {
  const fake = fakeResponse();
  sendError(fake.res, 400, 'validation.invalid', [{ field: 'kind', code: 'invalid_value' }], 'Custom message.');
  assert.equal(fake.statusCode, 400);
  assert.deepEqual(fake.body, {
    error: 'Custom message.',
    code: 'validation.invalid',
    details: [{ field: 'kind', code: 'invalid_value' }],
  });
});

check('ApiError uses the default message and carries code and status', () => {
  const error = new ApiError('auth.username_taken', 409);
  assert.equal(error.message, 'This username is already taken.');
  assert.equal(error.code, 'auth.username_taken');
  assert.equal(error.status, 409);
  assert.equal(error.details, undefined);
  assert.ok(error instanceof Error);
});

check('ApiError accepts a message override and details', () => {
  const details = [{ field: 'name', code: 'required' as const }];
  const error = new ApiError('validation.invalid', 400, { message: 'Bad body.', details });
  assert.equal(error.message, 'Bad body.');
  assert.deepEqual(error.details, details);
});

check('sendApiError serializes an ApiError', () => {
  const fake = fakeResponse();
  sendApiError(fake.res, new ApiError('sync.steam_key_rejected', 502));
  assert.equal(fake.statusCode, 502);
  assert.equal((fake.body as { code: string }).code, 'sync.steam_key_rejected');
});

check('toErrorResponse passes ApiError through', () => {
  const response = toErrorResponse(new ApiError('game.not_found', 404));
  assert.equal(response.status, 404);
  assert.equal(response.code, 'game.not_found');
});

check('toErrorResponse maps malformed JSON to a safe 400', () => {
  const error = Object.assign(new SyntaxError('Unexpected token } in JSON at position 5'), {
    status: 400,
    type: 'entity.parse.failed',
  });
  const response = toErrorResponse(error);
  assert.deepEqual(response, { status: 400, code: 'request.invalid_body' });
});

check('toErrorResponse maps oversized bodies to 413', () => {
  const response = toErrorResponse(Object.assign(new Error('request entity too large'), { statusCode: 413 }));
  assert.deepEqual(response, { status: 413, code: 'request.too_large' });
});

check('toErrorResponse hides the message of unknown errors behind a 500', () => {
  const response = toErrorResponse(new Error('SQLITE_ERROR: secret detail'));
  assert.deepEqual(response, { status: 500, code: 'server.internal' });
  assert.equal(toErrorResponse('boom').status, 500);
  assert.equal(toErrorResponse(Object.assign(new Error('x'), { status: 503 })).status, 500);
});

check('Issues records a machine-readable detail for each error', () => {
  const issues = new Issues('body');
  issues.add('title', 'required', 'missing');
  issues.add('items[0].hours', 'invalid_range', 'out of range');
  const result = issues.result({});
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.errors, ['body: title: missing', 'body: items[0].hours: out of range']);
    assert.deepEqual(result.details, [
      { field: 'title', code: 'required' },
      { field: 'items[0].hours', code: 'invalid_range' },
    ]);
  }
});

console.log(`\nAll ${passed} error checks passed.`);
