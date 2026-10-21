import { useI18n } from '../i18n';
import { LOCALES, LOCALE_LABEL } from '../i18n/locales';

/** Segmented "Português / English" control. The choice is persisted by the provider. */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="segmented" role="group" aria-label={t('common.language.label')}>
      {LOCALES.map((item) => (
        <button key={item} type="button" lang={item} aria-pressed={locale === item} onClick={() => setLocale(item)}>
          {LOCALE_LABEL[item]}
        </button>
      ))}
    </div>
  );
}
