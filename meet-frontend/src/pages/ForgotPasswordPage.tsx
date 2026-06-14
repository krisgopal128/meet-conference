import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { cn } from '../utils/cn';
import { useAuthFormValidation } from '../hooks/useFormValidation';
import { Video, Mail, ArrowRight, AlertCircle, Check } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Form validation state
  const [emailTouched, setEmailTouched] = useState(false);

  // Use shared validation hook
  const { emailError } = useAuthFormValidation(
    { email, password: '' },
    { email: emailTouched, password: false }
  );

  const isFormValid = email && !emailError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Touch field to show validation
    setEmailTouched(true);
    
    if (!isFormValid) return;

    setLoading(true);
    setError('');

    try {
      await authApi.forgotPassword(email);
      if (!mountedRef.current) return;
      setSuccess(true);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to send reset link. Please try again.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // Success state - show confirmation message
  if (success) {
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

          {/* Success Card */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-lg border border-surface-200 dark:border-surface-700 p-8 text-center">
            <div className="w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-success-600 dark:text-success-400" />
            </div>
            <h1 className="font-display text-xl font-bold text-surface-800 dark:text-white mb-2">
              Check your email
            </h1>
            <p className="text-surface-500 dark:text-surface-400 mb-6">
              We've sent a password reset link to <span className="font-medium text-surface-700 dark:text-surface-300">{email}</span>
            </p>
            <p className="text-sm text-surface-400 dark:text-surface-500 mb-6">
              Didn't receive the email? Check your spam folder or try again with a different email address.
            </p>
            <Link
              to="/login"
              className="btn-primary w-full inline-flex items-center justify-center"
            >
              <span>Back to Sign In</span>
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
            Forgot password?
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mt-2">
            Enter your email and we'll send you a reset link
          </p>
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
                autoFocus
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

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="btn-primary w-full"
            aria-describedby={!isFormValid && !loading ? 'form-disabled-reason' : undefined}
          >
            {loading ? (
              <span>Sending reset link...</span>
            ) : (
              <>
                <span>Send Reset Link</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
          {!isFormValid && !loading && (
            <p id="form-disabled-reason" className="sr-only">Please fill in all required fields correctly</p>
          )}
          {!isFormValid && !loading && (
            <p id="form-disabled-reason-visible" className="text-xs text-surface-400 text-center">
              Please enter a valid email address
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
