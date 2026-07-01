import { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { Menu, X, PanelLeftClose, PanelLeftOpen, LogOut, ArrowLeft, Bell } from 'lucide-react';
import { useUser, useAuthActions } from '../../store/authStore';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/prashasakah',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Users',
    path: '/prashasakah/users',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: 'Meetings',
    path: '/prashasakah/meetings',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Audit Logs',
    path: '/prashasakah/audit-logs',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    label: 'Alerts',
    path: '/prashasakah/alerts',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    label: 'API Keys',
    path: '/prashasakah/api-keys',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    label: 'Settings',
    path: '/prashasakah/settings',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    adminOnly: true,
  },
];

const SIDEBAR_KEY = 'admin-sidebar-collapsed';

export default function PrashasakahLayout() {
  const user = useUser();
  const { logout } = useAuthActions();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const filteredNavItems = useMemo(
    () => navItems.filter((item) => !item.adminOnly || user?.role === 'admin'),
    [user]
  );

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-surface-900 text-white flex flex-col transform transition-all duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 ${collapsed ? 'md:w-16' : 'md:w-60'} w-60`}
      >
        {/* Logo + Collapse toggle */}
        <div className="h-14 flex items-center border-b border-surface-700/50 px-3">
          <Link to="/prashasakah" className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
            <svg className="w-7 h-7 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className={`transition-all duration-200 overflow-hidden ${collapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100'}`}>
              <h1 className="text-base font-bold whitespace-nowrap leading-tight">Prashāsakaḥ</h1>
              <p className="text-[10px] text-surface-400 whitespace-nowrap">Admin Panel</p>
            </div>
          </Link>

          <button
            onClick={toggleCollapsed}
            className={`p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700/50 transition-colors hidden md:flex items-center justify-center ${collapsed ? 'mx-auto' : 'ml-auto'}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden" aria-label="Admin navigation">
          <ul className="space-y-0.5">
            {filteredNavItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/prashasakah'}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-lg transition-colors ${
                      collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-brand-600 text-white font-medium'
                        : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                    }`
                  }
                >
                  {item.icon}
                  <span className={`transition-all duration-200 whitespace-nowrap text-sm ${collapsed ? 'md:hidden' : ''}`}>
                    {item.label}
                  </span>
                  {collapsed && (
                    <span className="hidden md:block absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-surface-900 rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom section: alerts + user + logout */}
        <div className="border-t border-surface-700/50 px-2 py-2 space-y-1">
          {/* Alert bell */}
          <Link
            to="/prashasakah/alerts"
            title={collapsed ? 'Alerts' : undefined}
            className={`flex items-center gap-3 rounded-lg text-surface-300 hover:bg-surface-800 hover:text-white transition-colors ${
              collapsed ? 'p-2.5 justify-center' : 'px-3 py-2'
            }`}
          >
            <div className="relative shrink-0">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-danger-500 rounded-full ring-1 ring-surface-900"></span>
            </div>
            <span className={`text-sm ${collapsed ? 'md:hidden' : ''}`}>Alerts</span>
          </Link>

          {/* Divider */}
          <div className="border-t border-surface-700/50 my-1"></div>

          {/* User info */}
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center py-1' : 'px-2 py-1'}`}>
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className={`flex-1 min-w-0 transition-all duration-200 ${collapsed ? 'md:hidden' : ''}`}>
              <p className="text-sm font-medium truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-surface-400 capitalize leading-tight">{user?.role}</p>
            </div>
          </div>

          {/* Actions */}
          <div className={`flex flex-col gap-1 ${collapsed ? 'items-center' : ''}`}>
            <Link
              to="/"
              title={collapsed ? 'Back to App' : undefined}
              className={`flex items-center gap-2 text-sm text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg transition-colors ${
                collapsed ? 'p-2.5 justify-center' : 'px-3 py-2 w-full'
              }`}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className={collapsed ? 'md:hidden' : ''}>Back to App</span>
            </Link>
            <button
              onClick={logout}
              title="Sign Out"
              className={`flex items-center gap-2 text-sm text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg transition-colors ${
                collapsed ? 'p-2.5 justify-center' : 'px-3 py-2 w-full'
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className={collapsed ? 'md:hidden' : ''}>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 ml-0 md:ml-60 flex flex-col min-w-0 transition-all duration-200 ${collapsed ? 'md:ml-16' : ''}`}>
        {/* Mobile top bar — only visible on mobile */}
        <div className="md:hidden sticky top-0 z-30 bg-surface-900 text-white px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-white"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="text-sm font-medium">Admin Panel</span>
          <Link to="/prashasakah/alerts" className="relative p-1.5">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full"></span>
          </Link>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
