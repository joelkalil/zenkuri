import type { StringKey } from '../i18n/types';

/*
 * Navigation map: 4 top-level groups (Today, Library, Achievements, Community)
 * and the subnav of each one. The active group is derived from the pathname:
 * /game/* belongs to Library, /sagas/* and /comunidade to Community, and
 * /settings and /tutoriais belong to no group (profile menu).
 * Route paths stay in Portuguese; only the labels are translated.
 */
export const GROUP_ID = {
  TODAY: 'hoje',
  LIBRARY: 'biblioteca',
  ACHIEVEMENTS: 'conquistas',
  COMMUNITY: 'comunidade',
} as const;

export type GroupId = (typeof GROUP_ID)[keyof typeof GROUP_ID];

export interface NavItem {
  to: string;
  /** message key of the visible label */
  labelKey: StringKey;
  isActive: (pathname: string, search: string) => boolean;
}

export interface NavGroup {
  id: GroupId;
  /** message key of the full label (desktop) */
  labelKey: StringKey;
  /** message key of the short label (mobile tab bar, five tabs in 390px) */
  shortKey: StringKey;
  to: string;
  items: NavItem[];
}

function isSagasPath(pathname: string): boolean {
  return pathname === '/sagas' || pathname.startsWith('/sagas/');
}

function isCollectionsView(search: string): boolean {
  return new URLSearchParams(search).get('view') === 'collections';
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: GROUP_ID.TODAY,
    labelKey: 'nav.groups.today',
    shortKey: 'nav.short.today',
    to: '/',
    items: [
      { to: '/', labelKey: 'nav.items.today', isActive: (pathname) => pathname === '/' },
      { to: '/plano', labelKey: 'nav.items.plan', isActive: (pathname) => pathname === '/plano' || pathname === '/backlog' },
    ],
  },
  {
    id: GROUP_ID.LIBRARY,
    labelKey: 'nav.groups.library',
    shortKey: 'nav.short.library',
    to: '/library',
    items: [
      { to: '/library', labelKey: 'nav.items.games', isActive: (pathname, search) => pathname === '/library' && !isCollectionsView(search) },
      { to: '/library?view=collections', labelKey: 'nav.items.collections', isActive: (pathname, search) => pathname === '/library' && isCollectionsView(search) },
    ],
  },
  {
    id: GROUP_ID.ACHIEVEMENTS,
    labelKey: 'nav.groups.achievements',
    shortKey: 'nav.short.achievements',
    to: '/hall',
    items: [
      { to: '/hall', labelKey: 'nav.items.hall', isActive: (pathname) => pathname === '/hall' },
      { to: '/rankings', labelKey: 'nav.items.rankings', isActive: (pathname) => pathname === '/rankings' },
      { to: '/almanaque', labelKey: 'nav.items.almanac', isActive: (pathname) => pathname === '/almanaque' },
    ],
  },
  {
    id: GROUP_ID.COMMUNITY,
    labelKey: 'nav.groups.community',
    shortKey: 'nav.short.community',
    to: '/comunidade',
    items: [
      { to: '/comunidade', labelKey: 'nav.items.community', isActive: (pathname) => pathname === '/comunidade' },
      { to: '/sagas', labelKey: 'nav.items.sagas', isActive: (pathname) => isSagasPath(pathname) },
    ],
  },
];

export function groupOf(pathname: string): GroupId | null {
  if (pathname === '/' || pathname === '/plano' || pathname === '/backlog') return GROUP_ID.TODAY;
  if (pathname === '/library' || pathname.startsWith('/game/')) return GROUP_ID.LIBRARY;
  if (pathname === '/hall' || pathname === '/rankings' || pathname === '/almanaque') return GROUP_ID.ACHIEVEMENTS;
  if (pathname === '/comunidade' || isSagasPath(pathname)) return GROUP_ID.COMMUNITY;
  return null;
}
