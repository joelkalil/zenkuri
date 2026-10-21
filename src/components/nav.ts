/*
 * Mapa de navegação: 3 grupos de topo (Hoje, Biblioteca, Conquistas) e o
 * subnav de cada um. O grupo ativo é derivado do pathname; /game/* pertence à
 * Biblioteca e /settings não pertence a nenhum grupo (perfil).
 */
export const GROUP_ID = {
  TODAY: 'hoje',
  LIBRARY: 'biblioteca',
  ACHIEVEMENTS: 'conquistas',
} as const;

export type GroupId = (typeof GROUP_ID)[keyof typeof GROUP_ID];

export interface NavItem {
  to: string;
  label: string;
  isActive: (pathname: string, search: string) => boolean;
}

export interface NavGroup {
  id: GroupId;
  label: string;
  to: string;
  items: NavItem[];
}

function isCollectionsView(search: string): boolean {
  return new URLSearchParams(search).get('view') === 'collections';
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: GROUP_ID.TODAY,
    label: 'Hoje',
    to: '/',
    items: [
      { to: '/', label: 'Hoje', isActive: (pathname) => pathname === '/' },
      { to: '/plano', label: 'Plano', isActive: (pathname) => pathname === '/plano' || pathname === '/backlog' },
    ],
  },
  {
    id: GROUP_ID.LIBRARY,
    label: 'Biblioteca',
    to: '/library',
    items: [
      { to: '/library', label: 'Jogos', isActive: (pathname, search) => pathname === '/library' && !isCollectionsView(search) },
      { to: '/library?view=collections', label: 'Coleções', isActive: (pathname, search) => pathname === '/library' && isCollectionsView(search) },
      { to: '/sagas', label: 'Sagas', isActive: (pathname) => pathname.startsWith('/sagas') },
    ],
  },
  {
    id: GROUP_ID.ACHIEVEMENTS,
    label: 'Conquistas',
    to: '/hall',
    items: [
      { to: '/hall', label: 'Hall', isActive: (pathname) => pathname === '/hall' },
      { to: '/rankings', label: 'Rankings', isActive: (pathname) => pathname === '/rankings' },
      { to: '/almanaque', label: 'Almanaque', isActive: (pathname) => pathname === '/almanaque' },
    ],
  },
];

export function groupOf(pathname: string): GroupId | null {
  if (pathname === '/' || pathname === '/plano' || pathname === '/backlog') return GROUP_ID.TODAY;
  if (pathname === '/library' || pathname.startsWith('/game/') || pathname.startsWith('/sagas')) return GROUP_ID.LIBRARY;
  if (pathname === '/hall' || pathname === '/rankings' || pathname === '/almanaque') return GROUP_ID.ACHIEVEMENTS;
  return null;
}
