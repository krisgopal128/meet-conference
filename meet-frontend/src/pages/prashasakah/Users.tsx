import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useUser } from '../../store/authStore';
import { prashasakahApi, AdminUser } from '../../services/prashasakahApi';
import UserTable from '../../components/prashasakah/UserTable';
import UserEditModal from '../../components/prashasakah/UserEditModal';
import logger from '../../utils/logger';

/**
 * Users - User Management Page
 * 
 * Displays a list of all users with search, filtering, and actions.
 */

export default function Users() {
  const navigate = useNavigate();
  const currentUser = useUser();
  
  // State for users list
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  
  // Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Modal state
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Delete confirmation state
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit,
        offset: (page - 1) * limit,
      };
      
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (roleFilter) {
        params.role = roleFilter;
      }
      if (statusFilter) {
        params.status = statusFilter;
      }
      
      const response = await prashasakahApi.getUsers(params);
      setUsers(response?.data?.users || []);
      setTotal(response?.data?.total || 0);
    } catch (error) {
      logger.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [limit, page, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handlers
  const handleViewUser = (user: AdminUser) => {
    navigate(`/prashasakah/users/${user.id}`);
  };

  const handleEditUser = (user: AdminUser) => {
    setEditUser(user);
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async (userId: string, data: { name?: string; role?: 'admin' | 'moderator' | 'participant' }) => {
    try {
      await prashasakahApi.updateUser(userId, data);
      toast.success('User updated successfully');
      fetchUsers();
    } catch (error) {
      logger.error('Failed to update user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleBanUser = async (user: AdminUser) => {
    try {
      await prashasakahApi.banUser(user.id);
      toast.success(`User ${user.name || user.email} has been banned`);
      fetchUsers();
    } catch (error) {
      logger.error('Failed to ban user:', error);
      toast.error('Failed to ban user');
    }
  };

  const handleUnbanUser = async (user: AdminUser) => {
    try {
      await prashasakahApi.unbanUser(user.id);
      toast.success(`User ${user.name || user.email} has been unbanned`);
      fetchUsers();
    } catch (error) {
      logger.error('Failed to unban user:', error);
      toast.error('Failed to unban user');
    }
  };

  const handleDeleteClick = (user: AdminUser) => {
    setDeleteUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteUser) return;
    
    setIsDeleting(true);
    try {
      await prashasakahApi.deleteUser(deleteUser.id);
      toast.success(`User ${deleteUser.name || deleteUser.email} has been deleted`);
      setIsDeleteModalOpen(false);
      setDeleteUser(null);
      fetchUsers();
    } catch (error) {
      logger.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculate total pages
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800">Users</h1>
          <p className="text-surface-500 mt-1">
            Manage user accounts, roles, and permissions.
          </p>
        </div>
        <div className="text-sm text-surface-500">
          {total.toLocaleString()} total users
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div className="w-full md:w-40">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="participant">Participant</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-40">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        </div>
      </div>

      {/* User Table */}
      <UserTable
        users={users}
        loading={loading}
        onEdit={handleEditUser}
        onBan={handleBanUser}
        onUnban={handleUnbanUser}
        onDelete={handleDeleteClick}
        onView={handleViewUser}
        currentUserId={currentUser?.id}
        isAdmin={currentUser?.role === 'admin'}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-surface-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-surface-500">Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 border border-surface-300 rounded-lg text-sm"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span className="text-sm text-surface-500">per page</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 text-surface-500 hover:text-surface-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <span className="text-sm text-surface-600">
              Page {page} of {totalPages}
            </span>
            
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 text-surface-500 hover:text-surface-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <UserEditModal
        user={editUser}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditUser(null);
        }}
        onSave={handleSaveUser}
        currentUserId={currentUser?.id}
        currentUserRole={currentUser?.role}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deleteUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div 
            className="fixed inset-0 bg-black/50"
            onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-danger-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 id="modal-title" className="text-lg font-semibold text-surface-800">Delete User</h3>
                  <p className="text-sm text-surface-500">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-surface-600 mb-6">
                Are you sure you want to delete <span className="font-medium">{deleteUser.name || deleteUser.email}</span>? 
                All their data will be permanently removed.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-surface-600 bg-surface-100 rounded-lg hover:bg-surface-200 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
