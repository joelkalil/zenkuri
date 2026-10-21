import {
  formatDate,
  formatNumber,
  formatRelative,
  type DateInput,
} from './format';
import { INTL_TAG, type Locale } from './locales';
import { MESSAGES } from './messages';
import type { MessageTree, Params, PluralForms, PluralKey, StringKey } from './types';

/*
 * Framework-free translation engine. `I18nProvider` wraps `createI18n`, and
 * the tests exercise it directly.
 */

const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/** Replaces `{name}` placeholders. Unknown placeholders are left untouched. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** Picks the form for `count`; an explicit `zero` wins for 0, `other` is the fallback. */
export function selectPlural(locale: Locale, forms: PluralForms, count: number): string {
  if (count === 0 && forms.zero !== undefined) return forms.zero;
  const category = new Intl.PluralRules(INTL_TAG[locale]).select(count);
  return forms[category] ?? forms.other;
}

export function isPluralForms(value: unknown): value is PluralForms {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.one === 'string'
    && typeof record.other === 'string'
    && Object.keys(record).every((key) => (PLURAL_CATEGORIES as readonly string[]).includes(key) && typeof record[key] === 'string');
}

/** Walks a dotted path through a message tree. */
export function lookup(tree: MessageTree, path: string): string | PluralForms | undefined {
  let node: string | PluralForms | MessageTree | undefined = tree;
  for (const segment of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as MessageTree)[segment];
  }
  return typeof node === 'string' || isPluralForms(node) ? node : undefined;
}

/** Every leaf path (strings and plural objects) of a tree, sorted. Used by the parity test. */
export function flattenKeys(tree: MessageTree, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPluralForms(value)) keys.push(path);
    else keys.push(...flattenKeys(value, path));
  }
  return keys.sort();
}

export interface I18n {
  locale: Locale;
  t: (key: StringKey, params?: Params) => string;
  plural: (key: PluralKey, count: number, params?: Params) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatRelative: (target: DateInput, now?: number) => string;
}

export function createI18n(locale: Locale): I18n {
  const tree = MESSAGES[locale] as MessageTree;

  /** Unknown keys are a compile error; at runtime they degrade to the key itself instead of crashing. */
  function resolve(key: string): string | PluralForms {
    const found = lookup(tree, key);
    if (found === undefined) {
      console.error(`i18n: missing key "${key}" for locale "${locale}"`);
      return key;
    }
    return found;
  }

  return {
    locale,
    t(key, params) {
      const message = resolve(key);
      if (typeof message !== 'string') {
        console.error(`i18n: "${key}" is a plural message, use plural()`);
        return key;
      }
      return interpolate(message, params);
    },
    plural(key, count, params) {
      const message = resolve(key);
      if (typeof message === 'string') {
        console.error(`i18n: "${key}" is not a plural message, use t()`);
        return key;
      }
      return interpolate(selectPlural(locale, message, count), { count: formatNumber(locale, count), ...params });
    },
    formatNumber: (value, options) => formatNumber(locale, value, options),
    formatDate: (value, options) => formatDate(locale, value, options),
    formatRelative: (target, now) => formatRelative(locale, target, now),
  };
}
