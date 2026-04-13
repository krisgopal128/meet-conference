import { useRef, useEffect, useCallback, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { 
  Video, 
  Calendar, 
  Clock, 
  LogOut, 
  User,
  Menu,
  X,
  Key,
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const prevLocationRef = useRef(location.pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-refresh token before expiry
  useTokenRefresh();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Dismiss all toasts on route change
  useEffect(() => {
    if (location.pathname !== prevLocationRef.current) {
      toast.dismiss();
      prevLocationRef.current = location.pathname;
    }
  }, [location.pathname]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch {
      toast.error('Failed to logout');
    }
  }, [logout, navigate]);

  const navItems = [
    { path: '/', icon: Video, label: 'Meet Now' },
    { path: '/schedule', icon: Calendar, label: 'Schedule' },
    { path: '/history', icon: Clock, label: 'History' },
    // API Keys for moderators/admins only
    ...(user?.role === 'moderator' || user?.role === 'admin' 
      ? [{ path: '/api-keys', icon: Key, label: 'API Keys' }] 
      : []),
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-surface-50 dark:bg-surface-900">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between px-4 z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-display font-bold text-surface-800 dark:text-white">Meet</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <aside className={`
        md:hidden fixed top-14 right-0 bottom-0 w-64 bg-white dark:bg-surface-800 
        border-l border-surface-200 dark:border-surface-700 flex flex-col z-50
        transform transition-transform duration-200
        ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 min-h-[48px]
                ${isActive(path)
                  ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-800 dark:hover:text-white'
                }
              `}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="font-medium whitespace-nowrap">{label}</span>
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-surface-100 dark:bg-surface-700/50">
            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-800 dark:text-white truncate">
                {user?.name?.split(' ')[0] || 'User'}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-surface-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 bg-white dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 flex-col fixed left-0 top-0 bottom-0 z-40">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-surface-200 dark:border-surface-700">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center transition-colors group-hover:bg-brand-600">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-surface-800 dark:text-white">Meet</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 min-h-[48px]
                ${isActive(path)
                  ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-surface-800 dark:hover:text-white'
                }
              `}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="font-medium whitespace-nowrap">{label}</span>
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-surface-100 dark:bg-surface-700/50">
            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-800 dark:text-white truncate">
                {user?.name?.split(' ')[0] || 'User'}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-surface-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-60 overflow-auto pt-14 md:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 flex items-center justify-around z-50 pb-safe">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`
              flex flex-col items-center justify-center gap-1 px-4 py-2 min-w-[64px] min-h-[48px]
              ${isActive(path)
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-surface-500 dark:text-surface-400'
              }
            `}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
