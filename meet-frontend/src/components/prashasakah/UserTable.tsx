import { useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MoreVertical, Eye, Pencil, Ban, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { AdminUser } from '../../services/prashasakahApi';

/**
 * UserTable - Displays users in a table format with actions
 */

interface UserTableProps {
  users: AdminUser[];
  loading?: boolean;
  onEdit: (user: AdminUser) => void;
  onBan: (user: AdminUser) => void;
  onUnban: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onView: (user: AdminUser) => void;
  currentUserId?: string;
  isAdmin?: boolean;
}

type SortField = 'name' | 'email' | 'role' | 'createdAt' | 'lastLoginAt';
type SortOrder = 'asc' | 'desc';

const roleColors: Record<string, string> = {
  admin: 'bg-brand-100 text-purple-800',
  moderator: 'bg-brand-100 text-brand-800',
  participant: 'bg-surface-100 text-surface-700',
};

const roleIcons: Record<string, React.ReactNode> = {
  admin: (
    <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  moderator: (
    <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  ),
  participant: (
    <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  ),
};

// Memoized date formatter with cache
const dateCache = new Map<string, string>();
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const cached = dateCache.get(dateStr);
  if (cached) return cached;
  const date = new Date(dateStr);
  const result = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  dateCache.set(dateStr, result);
  return result;
}

function RowActionsMenu({
  user,
  isCurrentUser,
  isAdmin,
  isLoading,
  onView,
  onEdit,
  onBan,
  onUnban,
  onDelete,
}: {
  user: AdminUser;
  isCurrentUser: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  onView: (user: AdminUser) => void;
  onEdit: (user: AdminUser) => void;
  onBan: (user: AdminUser) => void;
  onUnban: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const select = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isLoading}
        className="p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded transition-colors disabled:opacity-50"
        aria-label="User actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MoreVertical className="w-4 h-4" />
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-44 origin-top-right bg-white rounded-lg shadow-lg border border-surface-200 py-1 z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => select(() => onView(user))}
            className="flex items-center w-full px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 text-left"
          >
            <Eye className="w-4 h-4 mr-2 text-surface-400" />
            View details
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => select(() => onEdit(user))}
            disabled={isLoading}
            className="flex items-center w-full px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 text-left disabled:opacity-50"
          >
            <Pencil className="w-4 h-4 mr-2 text-surface-400" />
            Edit user
          </button>
          {!isCurrentUser &&
            (user.isBanned ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => select(() => onUnban(user))}
                disabled={isLoading}
                className="flex items-center w-full px-3 py-2 text-sm text-green-700 hover:bg-green-50 text-left disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                Unban user
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => select(() => onBan(user))}
                disabled={isLoading}
                className="flex items-center w-full px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 text-left disabled:opacity-50"
              >
                <Ban className="w-4 h-4 mr-2 text-orange-500" />
                Ban user
              </button>
            ))}
          {isAdmin && !isCurrentUser && (
            <button
              type="button"
              role="menuitem"
              onClick={() => select(() => onDelete(user))}
              disabled={isLoading}
              className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 mr-2 text-red-500" />
              Delete user
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function UserTable({
  users,
  loading = false,
  onEdit,
  onBan,
  onUnban,
  onDelete,
  onView,
  currentUserId,
  isAdmin = false,
}: UserTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = (a.name || '').localeCompare(b.name || '');
        break;
      case 'email':
        comparison = a.email.localeCompare(b.email);
        break;
      case 'role':
        comparison = a.role.localeCompare(b.role);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'lastLoginAt': {
        const aTime = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const bTime = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        comparison = aTime - bTime;
        break;
      }
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const rowVirtualizer = useVirtualizer({
    count: sortedUsers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65,
    overscan: 5,
  });

  const handleAction = async (action: () => void, userId: string) => {
    setActionLoading(userId);
    try {
      await action();
    } finally {
      setActionLoading(null);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-surface-100 border-b border-surface-200" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-surface-100 flex items-center px-6">
              <div className="w-10 h-10 bg-surface-200 rounded-full mr-4" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-200 rounded w-1/4" />
                <div className="h-3 bg-surface-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
        <svg className="w-12 h-12 text-surface-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="text-lg font-medium text-surface-800 mb-1">No users found</h3>
        <p className="text-surface-500">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
      <div ref={parentRef} className="overflow-auto max-h-[600px]">
        <table className="min-w-full divide-y divide-surface-200">
          <thead className="bg-surface-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-surface-600"
                >
                  User
                  <SortIcon field="name" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('email')}
                  className="flex items-center gap-1 hover:text-surface-600"
                >
                  Email
                  <SortIcon field="email" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('role')}
                  className="flex items-center gap-1 hover:text-surface-600"
                >
                  Role
                  <SortIcon field="role" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('lastLoginAt')}
                  className="flex items-center gap-1 hover:text-surface-600"
                >
                  Last Login
                  <SortIcon field="lastLoginAt" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-surface-200">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const user = sortedUsers[virtualRow.index];
              const isCurrentUser = user.id === currentUserId;
              const isLoading = actionLoading === user.id;

              return (
                <tr
                  key={user.id}
                  className={`hover:bg-surface-50 transition-colors ${user.isBanned ? 'bg-danger-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                        {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => onView(user)}
                          className="text-sm font-medium text-surface-800 hover:text-brand-600"
                        >
                          {user.name || 'No name'}
                        </button>
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-brand-600 font-medium">(You)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-surface-500">{user.email}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                      {roleIcons[user.role]}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                    {formatDate(user.lastLoginAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isBanned ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-800">
                        <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                        </svg>
                        Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-green-800">
                        <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <RowActionsMenu
                      user={user}
                      isCurrentUser={isCurrentUser}
                      isAdmin={isAdmin}
                      isLoading={isLoading}
                      onView={onView}
                      onEdit={onEdit}
                      onBan={(u) => handleAction(() => onBan(u), u.id)}
                      onUnban={(u) => handleAction(() => onUnban(u), u.id)}
                      onDelete={(u) => handleAction(() => onDelete(u), u.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
