import { API_ERROR_CODES, VALIDATION_ISSUE_CODES } from '../../server/errorCodes';
import { ApiError, CLIENT_ERROR_CODES } from '../lib/apiError';
import { createI18n, lookup } from './core';
import { setActiveLocale } from './format';
import { LOCALES } from './locales';
import { MESSAGES } from './messages';
import { describeFieldIssues, messageForCode } from './useErrorMessage';
import type { MessageTree } from './types';

let failures = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

function text(locale: (typeof LOCALES)[number], key: string): string | undefined {
  const found = lookup(MESSAGES[locale] as unknown as MessageTree, key);
  return typeof found === 'string' ? found : undefined;
}

console.log('\n— Every server error code has a message in both locales —');
for (const locale of LOCALES) {
  const missing = [...API_ERROR_CODES, ...CLIENT_ERROR_CODES].filter((code) => !text(locale, `errors.api.${code}`)?.trim());
  check(`${locale}: ${API_ERROR_CODES.length} API + ${CLIENT_ERROR_CODES.length} client codes translated`, missing.length === 0, `missing: [${missing}]`);
  const missingIssues = VALIDATION_ISSUE_CODES.filter((code) => !text(locale, `errors.issue.${code}`)?.trim());
  check(`${locale}: every validation issue code translated`, missingIssues.length === 0, `missing: [${missingIssues}]`);
}

console.log('\n— Server-text parity —');
check('the PSN credential message keeps the env var and the tutorial pointer', (text('pt-BR', 'errors.api.sync.psn_credential_expired') ?? '').includes('ZENKURI_PSN_NPSSO')
  && (text('en', 'errors.api.sync.psn_credential_expired') ?? '').includes('ZENKURI_PSN_NPSSO')
  && (text('pt-BR', 'errors.api.sync.psn_credential_expired') ?? '').includes('Tutoriais')
  && (text('en', 'errors.api.sync.psn_credential_expired') ?? '').includes('Tutorials'));

console.log('\n— Mapping —');
const ptT = createI18n('pt-BR').t;
const enT = createI18n('en').t;
check('known code maps per locale', messageForCode(ptT, 'auth.invalid_credentials') === 'Usuário ou senha incorretos.'
  && messageForCode(enT, 'auth.invalid_credentials') === 'Wrong username or password.');
check('unknown code gives undefined', messageForCode(enT, 'made.up') === undefined && messageForCode(enT, undefined) === undefined);

console.log('\n— describeFieldIssues —');
const validation = new ApiError('Validation failed', 400, 'validation.invalid', [
  { field: 'name', code: 'required' },
  { field: 'email', code: 'invalid_format' },
  { field: 'name', code: 'too_long' },
]);
setActiveLocale('en');
const enIssues = describeFieldIssues(validation);
check('en: one message per field, first issue wins', enIssues.name === 'Required field' && enIssues.email === 'Invalid format' && Object.keys(enIssues).length === 2);
setActiveLocale('pt-BR');
check('pt-BR: field issues are localized', describeFieldIssues(validation).name === 'Campo obrigatório');
check('non-API errors give no field issues', Object.keys(describeFieldIssues(new Error('x'))).length === 0);

console.log(failures === 0 ? '\nOK' : `\n${failures} failure(s)`);
if (failures > 0) throw new Error(`${failures} error i18n check(s) failed`);
