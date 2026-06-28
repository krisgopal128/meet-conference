import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useUser } from '../../store/authStore';
import { prashasakahApi, AdminUser } from '../../services/prashasakahApi';
import UserActivityLog, { ActivityItem } from '../../components/prashasakah/UserActivityLog';
import UserEditModal from '../../components/prashasakah/UserEditModal';
import ChangePasswordModal from '../../components/prashasakah/ChangePasswordModal';
import logger from '../../utils/logger';

/**
 * UserDetail - Individual User Detail Page
 * 
 * Shows user information, activity log, and management actions.
 */

interface UserDetailData extends AdminUser {
  meetingsAttended?: number;
  meetingsHosted?: number;
  totalDurationMinutes?: number;
  banned_at?: string | null;
}

const roleColors: Record<string, string> = {
  admin: 'bg-brand-100 text-purple-800 border-purple-200',
  moderator: 'bg-brand-100 text-brand-800 border-brand-200',
  participant: 'bg-surface-100 text-surface-700 border-surface-200',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateStr);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useUser();
  
  const [user, setUser] = useState<UserDetailData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await prashasakahApi.getUser(id);
      setUser(response?.data?.user as UserDetailData || null);
    } catch (error) {
      logger.error('Failed to fetch user:', error);
      toast.error('Failed to load user details');
      navigate('/prashasakah/users');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchUserActivity = useCallback(async () => {
    if (!id) return;

    setActivityLoading(true);
    try {
      const response = await prashasakahApi.getUserActivity(id, { limit: 50, offset: 0 });
      const mapped: ActivityItem[] = (response.data.activities || []).map((activity) => ({
        id: activity.id,
        activity_type: activity.type,
        metadata: {
          ...(activity.metadata || {}),
          ip_address: activity.ipAddress,
        },
        created_at: activity.createdAt,
      }));
      setActivities(mapped);
    } catch (error) {
      logger.error('Failed to fetch user activity:', error);
      toast.error('Failed to load user activity');
    } finally {
      setActivityLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
    fetchUserActivity();
  }, [fetchUser, fetchUserActivity]);

  const handleSaveUser = async (userId: string, data: { name?: string; role?: 'admin' | 'moderator' | 'participant'; featureFlags?: Record<string, boolean> }) => {
    try {
      await prashasakahApi.updateUser(userId, data);
      toast.success('User updated successfully');
      fetchUser();
    } catch (error) {
      toast.error('Failed to update user');
      throw error;
    }
  };

  const handleBan = async () => {
    if (!user) return;
    setActionLoading('ban');
    try {
      await prashasakahApi.banUser(user.id);
      toast.success('User has been banned');
      fetchUser();
    } catch (error) {
      logger.error('Failed to ban user:', error);
      toast.error('Failed to ban user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async () => {
    if (!user) return;
    setActionLoading('unban');
    try {
      await prashasakahApi.unbanUser(user.id);
      toast.success('User has been unbanned');
      fetchUser();
    } catch (error) {
      logger.error('Failed to unban user:', error);
      toast.error('Failed to unban user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setActionLoading('delete');
    try {
      await prashasakahApi.deleteUser(user.id);
      toast.success('User has been deleted');
      navigate('/prashasakah/users');
    } catch (error) {
      logger.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    } finally {
      setActionLoading(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;
    setActionLoading('reset');
    try {
      const response = await prashasakahApi.resetPassword(user.id);
      const tempPwd = (response?.data as Record<string, unknown>)?.temporaryPassword as string | undefined;

      if (tempPwd) {
        const copied = await copyToClipboard(tempPwd);
        if (copied) {
          toast.success(`Temporary password copied to clipboard`, { duration: 6000 });
        } else {
          toast.error(`Temporary password: ${tempPwd}`, { duration: 10000 });
        }
      } else {
        toast.success('Password has been reset');
      }
    } catch (error) {
      logger.error('Failed to reset password:', error);
      toast.error('Failed to reset password');
    } finally {
      setActionLoading(null);
      setShowResetConfirm(false);
    }
  };

  const isCurrentUser = user?.id === currentUser?.id;
  const isAdmin = currentUser?.role === 'admin';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-surface-200 rounded w-1/4 mb-2" />
          <div className="h-4 bg-surface-100 rounded w-1/3" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
            <div className="w-24 h-24 bg-surface-200 rounded-full mx-auto mb-4" />
            <div className="h-6 bg-surface-200 rounded w-3/4 mx-auto mb-2" />
            <div className="h-4 bg-surface-100 rounded w-1/2 mx-auto" />
          </div>
          <div className="lg:col-span-2 bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
            <div className="h-6 bg-surface-200 rounded w-1/4 mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-surface-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-surface-800 mb-2">User not found</h2>
        <Link to="/prashasakah/users" className="text-brand-600 hover:underline">
          Return to users list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-surface-500">
        <Link to="/prashasakah" className="hover:text-surface-600">Dashboard</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link to="/prashasakah/users" className="hover:text-surface-600">Users</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-surface-800 font-medium">{user.name || user.email}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800">
            {user.name || 'No name'}
            {isCurrentUser && (
              <span className="ml-2 text-sm font-normal text-brand-600">(You)</span>
            )}
          </h1>
          <p className="text-surface-500 mt-1">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-brand-700 bg-brand-100 rounded-lg hover:bg-brand-200 transition-colors"
          >
            Edit User
          </button>
          {isAdmin && !isCurrentUser && (
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="px-4 py-2 text-sm font-medium text-warning-700 bg-warning-100 rounded-lg hover:bg-warning-200 transition-colors"
            >
              Change Password
            </button>
          )}
          {isAdmin && !isCurrentUser && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-danger-100 rounded-lg hover:bg-red-200 transition-colors"
            >
              Delete User
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - User Card */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Card */}
          <div className={`bg-white rounded-xl border border-surface-200 p-5 ${user.isBanned ? 'border-2 border-danger-200' : ''}`}>
            <div className="text-center">
              <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold ${
                user.isBanned 
                  ? 'bg-gradient-to-br from-red-400 to-red-600'
                  : 'bg-gradient-to-br from-brand-500 to-purple-600'
              }`}>
                {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
              </div>
              
              <h2 className="text-xl font-semibold text-surface-800">{user.name || 'No name'}</h2>
              <p className="text-surface-500">{user.email}</p>
              
              {/* Role Badge */}
              <div className="mt-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${roleColors[user.role]}`}>
                  {user.role}
                </span>
              </div>

              {/* Status Badge */}
              {user.isBanned ? (
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-danger-100 text-danger-800 border border-danger-200">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                    </svg>
                    Banned
                  </span>
                  {user.banned_at && (
                    <p className="text-xs text-surface-500 mt-1">Since {formatDate(user.banned_at)}</p>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-success-100 text-green-800 border border-green-200">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Active
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-2">
              {!isCurrentUser && (
                user.isBanned ? (
                  <button
                    onClick={() => { void handleUnban(); }}
                    disabled={actionLoading !== null}
                    className="w-full px-4 py-2 text-sm font-medium text-green-700 bg-success-100 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === 'unban' ? 'Unbanning...' : 'Unban User'}
                  </button>
                ) : (
                  <button
                    onClick={() => { void handleBan(); }}
                    disabled={actionLoading !== null}
                    className="w-full px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === 'ban' ? 'Banning...' : 'Ban User'}
                  </button>
                )
              )}
              
              {isAdmin && (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  disabled={actionLoading !== null}
                  className="w-full px-4 py-2 text-sm font-medium text-brand-700 bg-brand-50 rounded-lg hover:bg-brand-100 disabled:opacity-50 transition-colors border border-brand-200"
                >
                  {actionLoading === 'reset' ? 'Resetting...' : 'Reset Password'}
                </button>
              )}
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4">
              Statistics
            </h3>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-surface-500">Meetings Joined</dt>
                <dd className="font-semibold text-surface-800">{user.meetingsAttended || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Account Age</dt>
                <dd className="font-semibold text-surface-800">
                  {Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Last Login</dt>
                <dd className="font-semibold text-surface-800 text-right">
                  {formatRelativeTime(user.lastLoginAt)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right Column - Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <h3 className="text-lg font-semibold text-surface-800 mb-4">Recent Activity</h3>
            <UserActivityLog 
              activities={activities} 
              loading={loading || activityLoading}
            />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <UserEditModal
        user={user}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveUser}
        currentUserId={currentUser?.id}
        currentUserRole={currentUser?.role}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        user={user}
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title-delete">
          <div 
            className="fixed inset-0 bg-black/50"
            onClick={() => !actionLoading && setShowDeleteConfirm(false)}
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
                  <h3 id="modal-title-delete" className="text-lg font-semibold text-surface-800">Delete User</h3>
                  <p className="text-sm text-surface-500">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-surface-600 mb-6">
                Are you sure you want to delete <span className="font-medium">{user.name || user.email}</span>? 
                All their data will be permanently removed.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={actionLoading !== null}
                  className="flex-1 px-4 py-2 text-sm font-medium text-surface-600 bg-surface-100 rounded-lg hover:bg-surface-200 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { void handleDelete(); }}
                  disabled={actionLoading !== null}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'delete' ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title-reset">
          <div 
            className="fixed inset-0 bg-black/50"
            onClick={() => !actionLoading && setShowResetConfirm(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h3 id="modal-title-reset" className="text-lg font-semibold text-surface-800">Reset Password</h3>
                  <p className="text-sm text-surface-500">Generate a password reset link</p>
                </div>
              </div>

              <p className="text-surface-600 mb-6">
                This will generate a password reset link for <span className="font-medium">{user.name || user.email}</span>. 
                The link will be copied to your clipboard and can be shared with the user.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={actionLoading !== null}
                  className="flex-1 px-4 py-2 text-sm font-medium text-surface-600 bg-surface-100 rounded-lg hover:bg-surface-200 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { void handleResetPassword(); }}
                  disabled={actionLoading !== null}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'reset' ? 'Generating...' : 'Generate Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
