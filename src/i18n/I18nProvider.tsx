import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createI18n, type I18n } from './core';
import { setActiveLocale } from './format';
import { detectBrowserLocale, LOCALE_STORAGE_KEY, type Locale } from './locales';
import type { AreaName, Params, PluralKey, ScopedPluralKey, ScopedStringKey, StringKey } from './types';

export interface I18nContextValue extends I18n {
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
}

/** Owns the active locale, persists it and keeps `<html lang>` in sync. */
export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = detectBrowserLocale();
    setActiveLocale(initial);
    return initial;
  });

  const setLocale = useCallback((next: Locale) => {
    setActiveLocale(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode): the choice still applies for this session.
    }
    setLocaleState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({ ...createI18n(locale), setLocale }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `{ locale, setLocale, t, plural, formatNumber, formatDate, formatRelative }` */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}

export interface ScopedT<A extends AreaName> {
  (key: ScopedStringKey<A>, params?: Params): string;
  plural: (key: ScopedPluralKey<A>, count: number, params?: Params) => string;
}

/**
 * `t` scoped to one area: `const t = useT('nav'); t('groups.today')`.
 * Keys autocomplete and unknown keys fail to compile.
 */
export function useT<A extends AreaName>(area: A): ScopedT<A> {
  const { t, plural } = useI18n();
  return useMemo(() => {
    // The scoped key types guarantee `${area}.${key}` is a valid global key.
    const scoped = (key: ScopedStringKey<A>, params?: Params) => t(`${area}.${key}` as StringKey, params);
    const scopedPlural = (key: ScopedPluralKey<A>, count: number, params?: Params) =>
      plural(`${area}.${key}` as PluralKey, count, params);
    return Object.assign(scoped, { plural: scopedPlural });
  }, [area, t, plural]);
}
