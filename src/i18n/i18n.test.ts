import { createI18n, flattenKeys, interpolate, selectPlural } from './core';
import { detectLocale, LOCALE_STORAGE_KEY } from './locales';
import { MESSAGES } from './messages';
import { formatReason } from './messages/rankings/formatReason';
import type { MessageTree } from './types';

let failures = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

function storage(value: string | null) {
  return { getItem: (key: string) => (key === LOCALE_STORAGE_KEY ? value : null) };
}

console.log('\n— Key parity (pt-BR vs en) —');
const areas = Object.keys(MESSAGES['pt-BR']);
check('both locales register the same areas', areas.join() === Object.keys(MESSAGES.en).join());
for (const area of areas) {
  const pt = flattenKeys((MESSAGES['pt-BR'] as unknown as Record<string, MessageTree>)[area]);
  const en = flattenKeys((MESSAGES.en as unknown as Record<string, MessageTree>)[area]);
  const missingInEn = pt.filter((key) => !en.includes(key));
  const extraInEn = en.filter((key) => !pt.includes(key));
  check(`area "${area}" has identical keys (${pt.length})`, missingInEn.length === 0 && extraInEn.length === 0,
    `missing in en: [${missingInEn}] extra in en: [${extraInEn}]`);
}

console.log('\n— Interpolation —');
check('replaces a placeholder', interpolate('Hello {name}', { name: 'Joel' }) === 'Hello Joel');
check('replaces repeated and numeric placeholders', interpolate('{n} of {n} ({total})', { n: 1, total: 3 }) === '1 of 1 (3)');
check('leaves unknown placeholders untouched', interpolate('Hi {who}', {}) === 'Hi {who}');
check('returns the template without params', interpolate('Hi {who}') === 'Hi {who}');
check('t() interpolates', createI18n('en').t('setup.dialog.title', { platform: 'Steam' }) === 'Connect Steam');

console.log('\n— Plurals —');
const forms = { one: '{count} item', other: '{count} items' };
check('en one', selectPlural('en', forms, 1) === '{count} item');
check('en other', selectPlural('en', forms, 2) === '{count} items');
check('en zero falls to other', selectPlural('en', forms, 0) === '{count} items');
check('pt-BR one', selectPlural('pt-BR', forms, 1) === '{count} item');
check('pt-BR zero is "one" (CLDR)', selectPlural('pt-BR', forms, 0) === '{count} item');
check('pt-BR other', selectPlural('pt-BR', forms, 5) === '{count} items');
check('explicit zero wins', selectPlural('en', { ...forms, zero: 'none' }, 0) === 'none');
check('missing category falls back to other', selectPlural('en', { one: 'a', other: 'b' }, 3) === 'b');
check('plural() formats count per locale', createI18n('pt-BR').plural('rankings.reasons.remaining', 1200) === '1.200 conquistas restantes');
check('plural() singular', createI18n('en').plural('rankings.reasons.remaining', 1) === '1 achievement left');

console.log('\n— Detection —');
check('saved choice wins over the browser', detectLocale(storage('en'), ['pt-BR']) === 'en');
check('saved pt-BR wins', detectLocale(storage('pt-BR'), ['en-US']) === 'pt-BR');
check('invalid saved value is ignored', detectLocale(storage('fr'), ['pt-PT']) === 'pt-BR');
check('pt-PT maps to pt-BR', detectLocale(storage(null), ['pt-PT']) === 'pt-BR');
check('pt maps to pt-BR', detectLocale(storage(null), ['pt']) === 'pt-BR');
check('en-US maps to en', detectLocale(storage(null), ['en-US']) === 'en');
check('other languages map to en', detectLocale(storage(null), ['ja-JP']) === 'en');
check('uses the first browser language', detectLocale(storage(null), ['de', 'pt-BR']) === 'en');
check('no storage and no languages falls back to en', detectLocale(undefined, []) === 'en');
check('throwing storage falls back to the browser', detectLocale({ getItem: () => { throw new Error('denied'); } }, ['pt-BR']) === 'pt-BR');

console.log('\n— Formatting —');
const pt = createI18n('pt-BR');
const en = createI18n('en');
check('pt-BR decimal comma', pt.formatNumber(1.2, { maximumFractionDigits: 1 }) === '1,2');
check('en decimal point', en.formatNumber(1.2, { maximumFractionDigits: 1 }) === '1.2');
const day = new Date(2026, 9, 20);
check('pt-BR date', /^20 de out\.? de 2026$/.test(pt.formatDate(day)), pt.formatDate(day));
check('en date', en.formatDate(day).startsWith('20 Oct'), en.formatDate(day));
const NOW = Date.UTC(2026, 9, 20, 12);
check('relative: now', en.formatRelative(NOW - 10_000, NOW) === 'now' && pt.formatRelative(NOW - 10_000, NOW) === 'agora');
check('relative: minutes pt-BR', pt.formatRelative(NOW - 5 * 60_000, NOW).includes('5 min'), pt.formatRelative(NOW - 5 * 60_000, NOW));
check('relative: yesterday', en.formatRelative(NOW - 86_400_000, NOW) === 'yesterday' && pt.formatRelative(NOW - 86_400_000, NOW) === 'ontem');

console.log('\n— formatReason —');
check('remaining plural pt-BR', formatReason({ code: 'remaining', count: 3 }, pt) === '3 conquistas restantes');
check('remaining singular pt-BR', formatReason({ code: 'remaining', count: 1 }, pt) === '1 conquista restante');
check('rarest uses the locale decimal', formatReason({ code: 'rarest', percent: 1.2 }, pt) === 'A mais rara: 1,2% dos jogadores'
  && formatReason({ code: 'rarest', percent: 1.2 }, en) === 'Rarest: 1.2% of players');
check('near integer', formatReason({ code: 'near', percent: 94 }, pt) === '94% concluído' && formatReason({ code: 'near', percent: 94 }, en) === '94% complete');
check('long', formatReason({ code: 'long', hours: 40 }, pt) === '~40h de projeto');
check('short with half an hour', formatReason({ code: 'short', hours: 2.5 }, pt) === '~2,5h para fechar'
  && formatReason({ code: 'short', hours: 2.5 }, en) === '~2.5h to finish');
check('ultraRare singular/plural', formatReason({ code: 'ultraRare', count: 1 }, pt) === '1 conquista abaixo de 1%'
  && formatReason({ code: 'ultraRare', count: 4 }, en) === '4 achievements under 1%');
check('notStarted', formatReason({ code: 'notStarted' }, pt) === 'Ainda não iniciado' && formatReason({ code: 'notStarted' }, en) === 'Not started yet');

console.log(failures === 0 ? '\nOK' : `\n${failures} failure(s)`);
if (failures > 0) throw new Error(`${failures} i18n check(s) failed`);
