import { useState } from 'react';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminUser } from '../../services/prashasakahApi';
import logger from '../../utils/logger';

interface ChangePasswordModalProps {
  user: AdminUser;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ user, isOpen, onClose }: ChangePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await prashasakahApi.changePassword(user.id, password);
      toast.success(`Password changed for ${user.name || user.email}`);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      onClose();
    } catch (error: unknown) {
      logger.error('Failed to change password:', error);
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to change password';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-warning-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h3 id="modal-title" className="text-lg font-semibold text-surface-800">Change Password</h3>
              <p className="text-sm text-surface-500">
                Set a new password for {user.name || user.email}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2 pr-10 border border-surface-300 rounded-lg text-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-600 transition"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          level <= passwordStrength.level
                            ? passwordStrength.color
                            : 'bg-surface-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 ${passwordStrength.textColor}`}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter the password"
                className={`w-full px-3 py-2 border rounded-lg text-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition ${
                  confirmPassword && confirmPassword !== password
                    ? 'border-danger-300 focus:ring-danger-400 focus:border-danger-400'
                    : 'border-surface-300 focus:ring-brand-400 focus:border-brand-400'
                }`}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-danger-500 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium text-surface-600 bg-surface-100 rounded-lg hover:bg-surface-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !password || !confirmPassword || password !== confirmPassword || password.length < 8}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-danger-500', textColor: 'text-danger-500' };
  if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-warning-500', textColor: 'text-warning-500' };
  if (score <= 3) return { level: 3, label: 'Good', color: 'bg-brand-500', textColor: 'text-brand-500' };
  return { level: 4, label: 'Strong', color: 'bg-success-500', textColor: 'text-success-500' };
}
