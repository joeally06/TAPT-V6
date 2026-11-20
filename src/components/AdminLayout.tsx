import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Home, LogOut, Menu, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ADMIN_NAV, isItemActive, isPathActive, type NavItem } from '../lib/adminNav';
import { fetchAdminCounts, type AdminCounts } from '../lib/adminCounts';
import { AdminJumpMenu } from './admin/AdminJumpMenu';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const OPEN_STORAGE_KEY = 'tapt-admin-nav-open';

const readOpenMenus = (): Record<string, boolean> => {
  try {
    const stored = localStorage.getItem(OPEN_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const ROW_CLASS = 'flex w-full items-center rounded-lg px-2 py-2 text-sm font-medium';
const IDLE_CLASS = 'text-gray-300 hover:bg-tapt-blue/20 hover:text-white';
const ACTIVE_CLASS = 'bg-tapt-blue text-white';

const CountBadge: React.FC<{ count: number | undefined }> = ({ count }) =>
  count ? (
    <span className="ml-auto mr-1 min-w-[1.25rem] rounded-full bg-tapt-orange px-1.5 text-center text-xs font-bold text-gray-900">
      {count}
      <span className="sr-only"> waiting</span>
    </span>
  ) : null;

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isJumpOpen, setIsJumpOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(readOpenMenus);
  const [counts, setCounts] = useState<AdminCounts>({});
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    fetchAdminCounts().then((result) => {
      if (!cancelled) setCounts(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ctrl+K (or Cmd+K) opens the Jump to box
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsJumpOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      console.log('AdminLayout: Logging out user...');
      await supabase.auth.signOut();
      console.log('AdminLayout: Sign out successful - AuthContext will handle redirect');
      // Don't navigate here - let AuthContext handle it via the auth state change
    } catch (error) {
      console.error('AdminLayout: Error signing out:', error);
      // Force redirect even if signOut fails
      console.log('AdminLayout: Forcing redirect due to signout error');
      window.location.href = '/admin/login';
    }
  };

  // A menu is open when the person opened it, or by default when the current page is inside it.
  const isMenuOpen = (item: NavItem): boolean => openMenus[item.name] ?? isItemActive(item, pathname);

  const toggleMenu = (item: NavItem) => {
    const next = { ...openMenus, [item.name]: !isMenuOpen(item) };
    setOpenMenus(next);
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isItemActive(item, pathname);
    const count = item.count ? counts[item.count] : undefined;

    if (item.path) {
      return (
        <Link
          to={item.path}
          onClick={closeSidebar}
          aria-current={active ? 'page' : undefined}
          className={`${ROW_CLASS} ${active ? ACTIVE_CLASS : IDLE_CLASS}`}
        >
          <Icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {item.name}
          <CountBadge count={count} />
        </Link>
      );
    }

    const open = isMenuOpen(item);
    const panelId = `admin-nav-${item.name.replace(/\W+/g, '-').toLowerCase()}`;
    return (
      <div>
        <button
          type="button"
          onClick={() => toggleMenu(item)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`${ROW_CLASS} ${active && !open ? ACTIVE_CLASS : IDLE_CLASS}`}
        >
          <Icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {item.name}
          <CountBadge count={count} />
          {open ? (
            <ChevronDown className={`h-4 w-4 flex-shrink-0 ${count ? '' : 'ml-auto'}`} aria-hidden="true" />
          ) : (
            <ChevronRight className={`h-4 w-4 flex-shrink-0 ${count ? '' : 'ml-auto'}`} aria-hidden="true" />
          )}
        </button>
        <div id={panelId} hidden={!open} className="mb-1 ml-6 mt-1 space-y-1 border-l border-white/10 pl-2">
          {(item.children ?? []).map((child) => {
            const childActive = isPathActive(pathname, child.path);
            return (
              <Link
                key={child.path}
                to={child.path}
                onClick={closeSidebar}
                aria-current={childActive ? 'page' : undefined}
                className={`block rounded-lg px-3 py-1.5 text-sm font-medium ${childActive ? ACTIVE_CLASS : IDLE_CLASS}`}
              >
                {child.name}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-2">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isSidebarOpen}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
        >
          {isSidebarOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 w-64 h-screen transition-transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-full px-3 py-4 overflow-y-auto bg-tapt-navy">
          <div className="mb-4 px-2">
            <div className="flex items-center gap-3 mb-2">
              <img src="/tapt-logo.png" alt="TAPT Logo" className="h-10 w-10 object-contain" />
              <h1 className="text-2xl font-heading font-bold text-white">TAPT</h1>
            </div>
            <p className="text-sm text-gray-300">Admin Panel</p>
          </div>

          <button
            type="button"
            onClick={() => setIsJumpOpen(true)}
            className="mb-3 flex w-full items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/20 hover:text-white"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Jump to…
            <kbd className="ml-auto rounded border border-white/30 px-1.5 text-xs">Ctrl K</kbd>
          </button>

          <nav aria-label="Admin">
            {ADMIN_NAV.map((group, index) => (
              <div key={group.label ?? 'overview'} className={index === 0 ? '' : 'mt-4'}>
                {group.label && (
                  <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wider text-gray-400">{group.label}</p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div key={item.name}>{renderItem(item)}</div>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
              <Link to="/" className={`${ROW_CLASS} ${IDLE_CLASS}`}>
                <Home className="mr-3 h-5 w-5" aria-hidden="true" />
                View public site
              </Link>
              <button type="button" onClick={handleLogout} className={`${ROW_CLASS} ${IDLE_CLASS}`}>
                <LogOut className="mr-3 h-5 w-5" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        <div className="p-6 pt-16 lg:pt-6">{children}</div>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 lg:hidden" onClick={closeSidebar} />
      )}

      <AdminJumpMenu open={isJumpOpen} onClose={() => setIsJumpOpen(false)} />
    </div>
  );
};

export default AdminLayout;
