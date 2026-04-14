import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthActions } from '../store/authStore';
import { cn } from '../utils/cn';
import { useAuthFormValidation } from '../hooks/useFormValidation';
import { Video, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Check, Clock, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthActions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if redirected due to expired token
  const sessionExpired = searchParams.get('reason') === 'expired';
  
  // Check if redirected after successful password reset
  const passwordResetSuccess = searchParams.get('reset') === 'success';

  // Form validation state
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Use shared validation hook
  const { emailError, passwordError } = useAuthFormValidation(
    { email, password },
    { email: emailTouched, password: passwordTouched }
  );

  const isFormValid = email && password && !emailError && !passwordError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Touch all fields to show validation
    setEmailTouched(true);
    setPasswordTouched(true);
    
    if (!isFormValid) return;

    setLoading(true);
    setError('');

    try {
      const res = await authApi.login(email, password, rememberMe);
      login(res.data.user, res.data.token);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
            Sign In
          </h1>
        </div>

        {/* Error message */}
        {error && (
          <div role="alert" className="mb-6 p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
            <p className="text-sm text-danger-600 dark:text-danger-400 flex items-center gap-2">
              <AlertCircle size={18} aria-hidden="true" />
              {error}
            </p>
          </div>
        )}

        {/* Session expired message */}
        {sessionExpired && !error && (
          <div className="mb-6 p-4 rounded-lg bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800">
            <p className="text-sm text-warning-600 dark:text-warning-400 flex items-center gap-2">
              <Clock size={18} aria-hidden="true" />
              Your session has expired. Please sign in again.
            </p>
          </div>
        )}

        {/* Password reset success message */}
        {passwordResetSuccess && !error && (
          <div className="mb-6 p-4 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800">
            <p className="text-sm text-success-600 dark:text-success-400 flex items-center gap-2">
              <CheckCircle size={18} aria-hidden="true" />
              Your password has been reset successfully. Please sign in.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <div className="relative">
              <Mail 
                size={18} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" 
                aria-hidden="true"
              />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="you@example.com"
                className={cn(
                  'pl-10',
                  emailError ? 'input-error' : emailTouched && !emailError && 'input-success'
                )}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
                autoComplete="email"
              />
              {emailTouched && !emailError && (
                <Check 
                  size={18} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-success-500" 
                  aria-hidden="true"
                />
              )}
            </div>
            {emailError && (
              <p id="email-error" className="form-error">
                <AlertCircle size={14} aria-hidden="true" />
                {emailError}
              </p>
            )}
          </div>

          <div className="form-group">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="mb-0">Password</label>
              <Link
                to="/forgot-password"
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Forgot password?
              </Link>
            </div>
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
                placeholder="Enter your password"
                className={cn(
                  'pl-10 pr-10',
                  passwordError ? 'input-error' : passwordTouched && !passwordError && 'input-success'
                )}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
                autoComplete="current-password"
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
            {passwordError && (
              <p id="password-error" className="form-error">
                <AlertCircle size={14} aria-hidden="true" />
                {passwordError}
              </p>
            )}
          </div>

          {/* Remember Me checkbox */}
          <div className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
            />
            <label htmlFor="remember-me" className="text-sm text-surface-600 dark:text-surface-400">
              Keep me signed in for 30 days
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="btn-primary w-full"
            aria-describedby={!isFormValid && !loading ? 'form-disabled-reason' : undefined}
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
          {!isFormValid && !loading && (
            <p id="form-disabled-reason" className="sr-only">Please fill in all required fields correctly</p>
          )}

        </form>

        <p className="text-center text-surface-500 dark:text-surface-400 text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-500 hover:text-brand-600 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
