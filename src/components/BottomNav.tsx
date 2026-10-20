import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Library, ListOrdered, Medal, Settings, Trophy } from 'lucide-react';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Painel' },
  { to: '/library', icon: Library, label: 'Biblioteca' },
  { to: '/rankings', icon: Medal, label: 'Rankings' },
  { to: '/plano', icon: ListOrdered, label: 'Plano' },
  { to: '/hall', icon: Trophy, label: 'Hall' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
];

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-gray-950 border-t border-gray-800 flex z-50">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs transition-colors ${
              isActive ? 'text-violet-400' : 'text-gray-600 hover:text-gray-300'
            }`
          }
        >
          <Icon className="w-5 h-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
