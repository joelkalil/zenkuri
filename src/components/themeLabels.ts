import type { ThemeMode } from '../context/ThemeContext';
import type { StringKey } from '../i18n/types';

/** Message keys for the user-facing name and description of each theme. */
export const THEME_KEYS = {
  zenkuri: { label: 'common.themes.zenkuri.label', description: 'common.themes.zenkuri.description' },
  'zenkuri-claro': { label: 'common.themes.paper.label', description: 'common.themes.paper.description' },
} as const satisfies Record<ThemeMode, { label: StringKey; description: StringKey }>;
