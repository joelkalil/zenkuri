import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUserLevel } from '../hooks/useUserLevel';
import { Logo } from './Logo';
import { LevelChip } from './LevelBadge';
import { SyncButton } from './SyncButton';
import { ProfileMenu } from './ProfileMenu';
import { TabBar } from './TabBar';
import { NAV_GROUPS, groupOf } from './nav';

/*
 * Cabeçalho do shell: topbar de 56 px (marca, 3 grupos, sincronização, nível,
 * perfil) e subnav de 40 px com os itens do grupo ativo. No mobile a topbar
 * encolhe e a navegação vai para a TabBar inferior.
 */
export function TopNav() {
  const { user } = useAuth();
  const { level } = useUserLevel();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeGroup = groupOf(location.pathname);
  const group = NAV_GROUPS.find((item) => item.id === activeGroup);

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!profileOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setProfileOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  return (
    <>
      <header className="shell-head no-print">
        <div className="topbar">
          <div className="topbar-start">
            <Link to="/" aria-label="Zenkuri — Hoje" className="brand-link">
              <span className="hidden md:block"><Logo size={32} withWordmark /></span>
              <span className="md:hidden"><Logo size={28} withWordmark={false} /></span>
            </Link>
          </div>
          <nav className="topbar-nav" aria-label="Navegação principal">
            {NAV_GROUPS.map((item) => (
              <NavLink key={item.id} to={item.to} className="nav-group" aria-current={item.id === activeGroup ? 'page' : undefined}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <SyncButton />
            {level && <LevelChip level={level} />}
            <div
              ref={profileRef}
              className="profile-control"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false);
              }}
            >
              <button
                ref={triggerRef}
                type="button"
                className="profile-trigger"
                aria-label="Abrir menu do perfil"
                aria-haspopup="true"
                aria-expanded={profileOpen}
                aria-controls="profile-panel"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <span className="profile-avatar">{(user?.displayName ?? 'Z').charAt(0).toUpperCase()}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {profileOpen && (
                <div id="profile-panel" className="popover profile-panel">
                  <ProfileMenu onNavigate={() => setProfileOpen(false)} />
                </div>
              )}
            </div>
          </div>
        </div>
        {group && (
          <nav className="subnav" aria-label="Seção">
            {group.items.map((item) => {
              const active = item.isActive(location.pathname, location.search);
              return (
                <Link key={item.to} to={item.to} className="subnav-link" aria-current={active ? 'page' : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <TabBar activeGroup={activeGroup} />
    </>
  );
}
