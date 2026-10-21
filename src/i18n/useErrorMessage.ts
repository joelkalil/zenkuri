import { useCallback } from 'react';
import { API_ERROR_CODES, VALIDATION_ISSUE_CODES, type ValidationIssueCode } from '../../server/errorCodes';
import { ApiError, CLIENT_ERROR_CODES, type AnyErrorCode } from '../lib/apiError';
import { createI18n, lookup } from './core';
import { getActiveLocale } from './format';
import { useI18n } from './I18nProvider';
import { MESSAGES } from './messages';
import type { MessageTree, Params, StringKey } from './types';

type Translate = (key: StringKey, params?: Params) => string;

const KNOWN_CODES: readonly string[] = [...API_ERROR_CODES, ...CLIENT_ERROR_CODES];
const KNOWN_ISSUES: readonly string[] = VALIDATION_ISSUE_CODES;

function isKnownCode(code: string | undefined): code is AnyErrorCode {
  return code !== undefined && KNOWN_CODES.includes(code);
}

function isKnownIssue(code: string): code is ValidationIssueCode {
  return KNOWN_ISSUES.includes(code);
}

/** True when `key` resolves to a string in the active locale's messages. */
function hasKey(key: string): boolean {
  return typeof lookup(MESSAGES[getActiveLocale()] as MessageTree, key) === 'string';
}

/** Message for an error code, or `undefined` when the code is unknown. */
export function messageForCode(t: Translate, code: string | undefined): string | undefined {
  return isKnownCode(code) ? t(`errors.api.${code}`) : undefined;
}

/** Message for any thrown value: known code, then `fallbackKey`, then the generic message. */
function describe(t: Translate, error: unknown, fallbackKey?: string): string {
  if (error instanceof ApiError) {
    const byCode = messageForCode(t, error.code);
    if (byCode !== undefined) return byCode;
  }
  if (fallbackKey !== undefined && hasKey(fallbackKey)) return t(fallbackKey as StringKey);
  return t('errors.generic');
}

/**
 * Turns any thrown value (typically an `ApiError` carrying `code`) into a localized,
 * user-facing message. Never shows the server's English text.
 */
export function useErrorMessage(): (error: unknown, fallbackKey?: string) => string {
  const { t } = useI18n();
  return useCallback((error: unknown, fallbackKey?: string) => describe(t, error, fallbackKey), [t]);
}

/**
 * Per-field messages of a `validation.invalid` error, keyed by field name, for forms.
 * Uses the active locale, so call it while rendering or handling the error.
 */
export function describeFieldIssues(error: unknown): Record<string, string> {
  const issues: Record<string, string> = {};
  if (!(error instanceof ApiError)) return issues;
  const { t } = createI18n(getActiveLocale());
  for (const detail of error.details ?? []) {
    if (detail.field in issues) continue;
    issues[detail.field] = isKnownIssue(detail.code) ? t(`errors.issue.${detail.code}`) : t('errors.api.validation.invalid');
  }
  return issues;
}
