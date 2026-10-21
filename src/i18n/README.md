# i18n (pt-BR and en)

No dependency: typed message modules, a small provider and `Intl`.

**Rule: no user-visible string may be hardcoded in a component.** That includes
labels, placeholders, `aria-label`, `title`, `alt` (when meaningful), toasts and
validation errors. Code comments and identifiers are always English.

## Using it

```tsx
import { useI18n, useT } from '../i18n';

const t = useT('nav');                       // scoped: autocompletes 'groups.today'
t('groups.today');

const { t, plural, formatNumber, formatDate, formatRelative, locale, setLocale } = useI18n();
t('settings.sync.done');                      // global: 'area.path'
t('setup.dialog.title', { platform: 'Steam' });           // {platform} interpolation
plural('rankings.reasons.remaining', count);              // { one, other } by Intl.PluralRules
```

Unknown keys, and plural keys passed to `t` (or the reverse), are compile errors.
`plural` also exposes `{count}` (already formatted for the locale).

## Adding keys

1. Add the key to `messages/<area>/pt-BR.ts` (the source of truth, a plain object, no `as const`).
2. Add the same key to `messages/<area>/en.ts`. It is declared with
   `satisfies Shape<typeof <area>PtBR>`, so a missing or extra key fails `npx tsc -b`.
3. `npm run test:i18n` also checks key parity at runtime.

## Adding an area

One folder per feature area (`nav`, `settings`, `tutorials`...), so parallel work does not conflict.

1. Create `messages/<area>/pt-BR.ts` exporting `<area>PtBR` and `messages/<area>/en.ts` exporting `<area>En`.
2. Register both in `messages/index.ts` (one line in `PT_BR`, one in `EN`, plus the imports).
3. Use it as `useT('<area>')` or `t('<area>.some.key')`.

Naming: area names are lowercase; keys are camelCase, nested by screen or section
(`settings.sync.every15`). Language-neutral facts (env var names, URLs) are not messages.

## Plurals

```ts
remaining: { one: '{count} achievement left', other: '{count} achievements left' }
```

Optional categories: `zero`, `two`, `few`, `many`. `zero` also applies to an exact 0.
Rendered with `plural(key, count)`. Note that pt-BR treats 0 as `one`.

## Formatting

Never call `toLocaleString('pt-BR')` or `new Intl.*('pt-BR')` directly.

- In components: `formatNumber`, `formatDate`, `formatRelative` from `useI18n()`.
- In shared helpers: pass a `Locale`, or rely on the active locale
  (`getActiveLocale()` in `format.ts`, default parameter in `src/lib/planDates.ts`).
- English uses `en-GB` for `Intl` (day-month-year, "20 Oct 2026"), see `INTL_TAG` in `locales.ts`.

The app shell is keyed by locale, so changing language remounts the pages and
non-hook callers of the active locale refresh too.

## Locale selection

Order: `localStorage['zenkuri-locale']`, then `navigator.language` (`pt*` maps to
pt-BR, anything else to en), then en. `I18nProvider` persists changes and sets `<html lang>`.
Language switchers: `components/LanguageSwitcher.tsx`.

## Server text

The API must not send localized prose. Send codes (see `ReasonCode` in
`server/rankings/types.ts`) and render them with a client message, like
`messages/rankings/formatReason.ts`.

## Messages with React slots

`withSlots.tsx` renders a translated template whose `{name}` placeholders are React nodes
(for example a number in `<span className="num">`, a link, or content tagged with `lang`):

```tsx
import { withSlots } from '../i18n/withSlots';

withSlots(t('priceChecked'), { date: <span className="num">{date}</span> });
```

## Rich text

Tutorial copy may wrap inline code in backticks; render it with `components/RichText.tsx`.
