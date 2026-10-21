export const LOCALE = {
  PT_BR: 'pt-BR',
  EN: 'en',
} as const;

export type Locale = (typeof LOCALE)[keyof typeof LOCALE];

export const LOCALES: readonly Locale[] = [LOCALE.PT_BR, LOCALE.EN];

export const DEFAULT_LOCALE: Locale = LOCALE.EN;

/** localStorage key that persists the user's explicit choice. */
export const LOCALE_STORAGE_KEY = 'zenkuri-locale';

/** Language names are endonyms: they are always shown in their own language. */
export const LOCALE_LABEL: Record<Locale, string> = {
  'pt-BR': 'Português',
  en: 'English',
};

/**
 * BCP 47 tag handed to `Intl`. English uses the day-month-year order
 * ("20 Oct 2026") that the design system specifies.
 */
export const INTL_TAG: Record<Locale, string> = {
  'pt-BR': 'pt-BR',
  en: 'en-GB',
};

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

type StorageReader = Pick<Storage, 'getItem'>;

/**
 * Detection order: saved choice, then the browser languages (pt* maps to
 * pt-BR, anything else to en), then the default (en). Both inputs are
 * optional so the function stays pure and testable outside a browser.
 */
export function detectLocale(
  storage?: StorageReader | null,
  browserLanguages: readonly string[] = [],
): Locale {
  try {
    const saved = storage?.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage can throw (privacy mode): fall through to the browser language.
  }

  const first = browserLanguages.find((language) => language.trim() !== '');
  if (first !== undefined) {
    return first.trim().toLowerCase().startsWith('pt') ? LOCALE.PT_BR : LOCALE.EN;
  }
  return DEFAULT_LOCALE;
}

/** `detectLocale` bound to the real browser environment (safe on the server). */
export function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const languages = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  return detectLocale(window.localStorage, languages);
}
