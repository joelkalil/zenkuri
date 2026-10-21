import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { GroupId } from './nav';
import { NAV_GROUPS } from './nav';
import { ProfileMenu } from './ProfileMenu';

interface TabBarProps {
  activeGroup: GroupId | null;
}

/**
 * Barra de abas inferior (≤768 px): Hoje, Biblioteca, Conquistas e Perfil. O
 * Perfil abre uma folha com o mesmo conteúdo do menu de perfil do desktop.
 */
export function TabBar({ activeGroup }: TabBarProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    sheetRef.current?.querySelector<HTMLElement>('a, button, input')?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>('a[href], button, input');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <nav className="tabbar no-print" aria-label="Navegação principal">
        {NAV_GROUPS.map((group) => (
          <Link key={group.id} to={group.to} className="tabbar-item" aria-current={group.id === activeGroup ? 'page' : undefined}>
            {group.label}
          </Link>
        ))}
        <button
          ref={triggerRef}
          type="button"
          className="tabbar-item"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="profile-sheet"
          onClick={() => setOpen(!open)}
        >
          Perfil
        </button>
      </nav>
      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={sheetRef} id="profile-sheet" role="dialog" aria-modal="true" aria-label="Perfil" className="popover profile-panel is-sheet">
            <ProfileMenu onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
