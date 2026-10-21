import type { Messages } from './messages';

/** Plural forms keyed by `Intl.PluralRules` category. `one` and `other` are required. */
export interface PluralForms {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface MessageTree {
  [key: string]: string | PluralForms | MessageTree;
}

/**
 * Same keys as `T`, with every leaf widened (string, plural or subtree). Used so
 * the `en` modules fail to compile when a key is missing or unknown.
 */
export type Shape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends PluralForms ? PluralForms : Shape<T[K]>;
};

type LeafKeys<T, Kind> = {
  [K in keyof T & string]: T[K] extends Kind
    ? K
    : T[K] extends string | PluralForms
      ? never
      : `${K}.${LeafKeys<T[K], Kind>}`;
}[keyof T & string];

export type AreaName = keyof Messages & string;

/** Dotted keys of plain strings, e.g. `'nav.groups.today'`. */
export type StringKey = LeafKeys<Messages, string>;
/** Dotted keys of plural messages. */
export type PluralKey = LeafKeys<Messages, PluralForms>;

/** Keys relative to one area, e.g. `'groups.today'` for area `'nav'`. */
export type ScopedStringKey<A extends AreaName> = LeafKeys<Messages[A], string>;
export type ScopedPluralKey<A extends AreaName> = LeafKeys<Messages[A], PluralForms>;

export type Params = Readonly<Record<string, string | number>>;
