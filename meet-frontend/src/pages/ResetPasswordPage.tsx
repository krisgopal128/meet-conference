import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { cn } from '../utils/cn';
import { Video, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Check } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenError, setTokenError] = useState('');

  // Form validation state
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenError('Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  // Password validation (matching RegisterPage patterns)
  const passwordError = passwordTouched ? (
    !password ? 'Password is required' :
    password.length < 8 ? 'Password must be at least 8 characters' :
    !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password) ? 'Include uppercase, lowercase, and a number' : ''
  ) : '';

  const confirmError = confirmTouched ? (
    !confirmPassword ? 'Please confirm your password' :
    confirmPassword !== password ? 'Passwords do not match' : ''
  ) : '';

  const isFormValid = password && confirmPassword && !passwordError && !confirmError && !!token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Touch all fields
    setPasswordTouched(true);
    setConfirmTouched(true);
    
    if (!isFormValid || !token) return;

    setLoading(true);
    setError('');

    try {
      await authApi.resetPassword(token, password);
      // Redirect to login with success message
      navigate('/login?reset=success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: '', color: '' };
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    
    if (strength <= 2) return { strength, label: 'Weak', color: 'bg-danger-500' };
    if (strength <= 3) return { strength, label: 'Fair', color: 'bg-warning-500' };
    if (strength <= 4) return { strength, label: 'Good', color: 'bg-brand-500' };
    return { strength, label: 'Strong', color: 'bg-success-500' };
  };

  const passwordStrength = getPasswordStrength();

  // Token error state - show error message
  if (tokenError) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-display font-bold text-surface-800 dark:text-white">Meet</span>
            </Link>
          </div>

          {/* Error Card */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-lg border border-surface-200 dark:border-surface-700 p-8 text-center">
            <div className="w-16 h-16 bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-danger-600 dark:text-danger-400" />
            </div>
            <h1 className="font-display text-xl font-bold text-surface-800 dark:text-white mb-2">
              Invalid Link
            </h1>
            <p className="text-surface-500 dark:text-surface-400 mb-6">
              {tokenError}
            </p>
            <Link
              to="/forgot-password"
              className="btn-primary w-full inline-flex items-center justify-center"
            >
              <span>Request New Reset Link</span>
            </Link>
          </div>

          <p className="text-center text-surface-500 dark:text-surface-400 text-sm mt-6">
            Remember your password?{' '}
            <Link to="/login" className="text-brand-500 hover:text-brand-600 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-surface-800 dark:text-white">Meet</span>
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-surface-800 dark:text-white">
            Reset your password
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mt-2">
            Enter a new password for your account
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
            <p className="text-sm text-danger-600 dark:text-danger-400 flex items-center gap-2">
              <AlertCircle size={18} aria-hidden="true" />
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <div className="relative">
              <Lock 
                size={18} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" 
                aria-hidden="true"
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                placeholder="Enter new password"
                className={cn(
                  'pl-10 pr-10',
                  passwordError ? 'input-error' : passwordTouched && !passwordError && 'input-success'
                )}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : 'password-hint'}
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {passwordError ? (
              <p id="password-error" className="form-error">
                <AlertCircle size={14} aria-hidden="true" />
                {passwordError}
              </p>
            ) : (
              <>
                <p id="password-hint" className="form-hint">
                  Use 8+ characters with uppercase, lowercase, and numbers
                </p>
                {password && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-surface-500">{passwordStrength.label}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <div className="relative">
              <Lock 
                size={18} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" 
                aria-hidden="true"
              />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmTouched(true)}
                placeholder="Confirm new password"
                className={cn(
                  'pl-10 pr-10',
                  confirmError ? 'input-error' : confirmTouched && !confirmError && 'input-success'
                )}
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? 'confirm-error' : undefined}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 p-1"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {confirmError ? (
              <p id="confirm-error" className="form-error">
                <AlertCircle size={14} aria-hidden="true" />
                {confirmError}
              </p>
            ) : confirmTouched && !confirmError ? (
              <p className="form-success">
                <Check size={14} aria-hidden="true" />
                Passwords match
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="btn-primary w-full mt-6"
            aria-describedby={!isFormValid && !loading ? 'form-disabled-reason' : undefined}
          >
            {loading ? (
              <span>Resetting password...</span>
            ) : (
              <>
                <span>Reset Password</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
          {!isFormValid && !loading && (
            <p id="form-disabled-reason" className="text-xs text-surface-400 text-center">
              Please fill in all required fields correctly
            </p>
          )}
        </form>

        <p className="text-center text-surface-500 dark:text-surface-400 text-sm mt-6">
          Remember your password?{' '}
          <Link to="/login" className="text-brand-500 hover:text-brand-600 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
