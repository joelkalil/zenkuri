import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Library, ListOrdered, Settings, Trophy } from 'lucide-react';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/backlog', icon: ListOrdered, label: 'Backlog' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-gray-950 border-r border-gray-800 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shrink-0">
          <Trophy className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-100 leading-tight">Platina</p>
          <p className="text-xs text-gray-600 leading-tight">Achievement Tracker</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600/15 text-violet-300 border border-violet-600/20'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-700 leading-relaxed">
          Data cached for 1h.
          <br />
          Powered by Steam Web API.
        </p>
      </div>
    </aside>
  );
}
