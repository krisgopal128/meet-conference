import { useState, useEffect } from 'react';
import { AdminUser } from '../../services/prashasakahApi';

/**
 * UserEditModal - Modal for editing user details
 */

interface UserEditModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, data: { name?: string; role?: 'admin' | 'moderator' | 'participant' }) => Promise<void>;
  currentUserId?: string;
  currentUserRole?: string;
}

const roleOptions = [
  { value: 'participant', label: 'Participant', description: 'Standard user with basic access' },
  { value: 'moderator', label: 'Moderator', description: 'Can manage users and view reports' },
  { value: 'admin', label: 'Administrator', description: 'Full access to all admin features' },
];

export default function UserEditModal({
  user,
  isOpen,
  onClose,
  onSave,
  currentUserId,
  currentUserRole,
}: UserEditModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'moderator' | 'participant'>('participant');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setRole(user.role);
      setError(null);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Check if trying to modify own role
    if (user.id === currentUserId && role !== user.role) {
      setError('You cannot change your own role');
      return;
    }

    // Check if non-admin trying to change role
    if (currentUserRole !== 'admin' && role !== user.role) {
      setError('Only administrators can change user roles');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave(user.id, {
        name: name.trim(),
        role,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const isEditingSelf = user.id === currentUserId;
  const canChangeRole = currentUserRole === 'admin' && !isEditingSelf;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-surface-800">Edit User</h3>
            <button
              onClick={onClose}
              className="text-surface-400 hover:text-surface-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User Info Banner */}
          <div className="flex items-center gap-3 mb-6 p-3 bg-surface-50 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-medium text-lg">
              {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-surface-800">{user.name || 'No name'}</p>
              <p className="text-sm text-surface-500">{user.email}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
                <p className="text-sm text-danger-600">{error}</p>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-surface-600 mb-1">
                Display Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none transition-colors"
                placeholder="Enter display name"
              />
            </div>

            {/* Role Field */}
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-2">
                Role
              </label>
              <div className="space-y-2">
                {roleOptions.map((option) => {
                  const isDisabled = !canChangeRole && option.value !== user.role;
                  
                  return (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        role === option.value
                          ? 'border-brand-500 bg-brand-50'
                          : isDisabled
                          ? 'border-surface-200 bg-surface-50 cursor-not-allowed opacity-60'
                          : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={role === option.value}
                        onChange={() => !isDisabled && setRole(option.value as typeof role)}
                        disabled={isDisabled}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="font-medium text-surface-800">{option.label}</p>
                        <p className="text-sm text-surface-500">{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {!canChangeRole && (
                <p className="text-xs text-surface-500 mt-2">
                  {isEditingSelf 
                    ? 'You cannot change your own role.'
                    : 'Only administrators can change user roles.'}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-surface-600 bg-surface-100 rounded-lg hover:bg-surface-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
