import { useState, useEffect } from 'react';
import { AdminUser } from '../../services/prashasakahApi';
import type { FeatureFlagKey } from '../../types';
import { MODERATOR_FEATURES, allFeaturesAllowed } from '../../utils/features';

/**
 * UserEditModal - Modal for editing user details
 */

interface UserEditModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, data: { name?: string; role?: 'admin' | 'moderator' | 'participant'; featureFlags?: Record<string, boolean> }) => Promise<void>;
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
  // featureFlags local state — only used when role === 'moderator'.
  // null = no change requested (won't be sent); an object = send these flags.
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setRole(user.role);
      // Seed from existing flags, or default to all-allowed for a moderator
      // that has no lock yet. null means "don't send featureFlags on save".
      setFeatureFlags(
        user.role === 'moderator'
          ? { ...(user.featureFlags ?? allFeaturesAllowed()) }
          : null
      );
      setError(null);
    }
  }, [user]);

  const toggleFeature = (key: FeatureFlagKey) => {
    setFeatureFlags((prev) => {
      const base = prev ?? allFeaturesAllowed();
      return { ...base, [key]: !base[key] };
    });
  };

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
      // Only send featureFlags when the target is (or is being set to) moderator.
      const sendFlags = role === 'moderator' ? featureFlags : undefined;
      await onSave(user.id, {
        name: name.trim(),
        role,
        featureFlags: sendFlags ?? undefined,
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
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 id="modal-title" className="text-lg font-semibold text-surface-800">Edit User</h3>
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

            {/* Feature Flags — only for moderators */}
            {role === 'moderator' && (
              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">
                  Moderator Permissions
                </label>
                <p className="text-xs text-surface-500 mb-3">
                  Select which powers this moderator can use. Unchecked features are locked.
                  Room hosts always bypass these locks.
                </p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {MODERATOR_FEATURES.map(({ key, label, description }) => {
                    const checked = featureFlags?.[key] === true;
                    return (
                      <label
                        key={key}
                        className={`flex items-start gap-3 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                          checked
                            ? 'border-brand-400 bg-brand-50/50'
                            : 'border-surface-200 hover:bg-surface-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFeature(key)}
                          className="mt-0.5 rounded border-surface-300 text-brand-500 focus:ring-brand-400"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-800">{label}</p>
                          <p className="text-xs text-surface-500">{description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

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
