import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthActions } from '../store/authStore';
import { cn } from '../utils/cn';
import { useAuthFormValidation } from '../hooks/useFormValidation';
import { Video, Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, Check } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuthActions();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form validation state
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Use shared validation hook for name and email
  const { nameError, emailError } = useAuthFormValidation(
    { name, email, password: '', confirmPassword: '' },
    { name: nameTouched, email: emailTouched, password: false, confirmPassword: false }
  );

  // RegisterPage has stricter password validation
  const passwordError = passwordTouched ? (
    !password ? 'Password is required' :
    password.length < 8 ? 'Password must be at least 8 characters' :
    !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password) ? 'Include uppercase, lowercase, and a number' : ''
  ) : '';

  const confirmError = confirmTouched ? (
    !confirmPassword ? 'Please confirm your password' :
    confirmPassword !== password ? 'Passwords do not match' : ''
  ) : '';

  const isFormValid = name && email && password && confirmPassword && 
    !nameError && !emailError && !passwordError && !confirmError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Touch all fields
    setNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmTouched(true);
    
    if (!isFormValid) return;

    setLoading(true);
    setError('');

    try {
      const res = await authApi.register(email, password, name, rememberMe);
      login(res.data.user, res.data.token);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Registration failed. Please try again.');
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

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-600 p-12 flex-col justify-between">
        <div>
          <Link to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Video className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-display font-bold text-white">Meet</span>
          </Link>
        </div>
        
        <div className="space-y-6">
          <h1 className="font-display text-4xl font-bold text-white leading-tight">
            Start your journey<br />with Meet
          </h1>
          <p className="text-brand-100 text-lg max-w-md">
            Create your account and get instant access to high-quality video meetings 
            with your team.
          </p>

          <ul className="space-y-3 text-brand-100">
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-500/30 flex items-center justify-center">
                <Check size={14} className="text-white" />
              </div>
              Free unlimited meetings
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-500/30 flex items-center justify-center">
                <Check size={14} className="text-white" />
              </div>
              HD video and audio
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-500/30 flex items-center justify-center">
                <Check size={14} className="text-white" />
              </div>
              Screen sharing & recording
            </li>
          </ul>
        </div>

        <div className="text-brand-200 text-sm">
          © 2024 Meet. All rights reserved.
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-display font-bold text-surface-800 dark:text-white">Meet</span>
            </Link>
          </div>

          <div className="text-center mb-8">
            <h2 className="font-display text-2xl font-bold text-surface-800 dark:text-white">
              Create your account
            </h2>
            <p className="text-surface-500 dark:text-surface-400 mt-1">
              Get started with your free account
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
              <label htmlFor="name">Full Name</label>
              <div className="relative">
                <User 
                  size={18} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" 
                  aria-hidden="true"
                />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setNameTouched(true)}
                  placeholder="John Doe"
                  className={cn(
                  'pl-10',
                  nameError ? 'input-error' : nameTouched && !nameError && 'input-success'
                )}
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'name-error' : undefined}
                  autoComplete="name"
                />
                {nameTouched && !nameError && (
                  <Check 
                    size={18} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-success-500" 
                    aria-hidden="true"
                  />
                )}
              </div>
              {nameError && (
                <p id="name-error" className="form-error">
                  <AlertCircle size={14} aria-hidden="true" />
                  {nameError}
                </p>
              )}
            </div>

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
              <label htmlFor="password">Password</label>
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
                  placeholder="Create a password"
                  className={cn(
                  'pl-10 pr-10',
                  passwordError ? 'input-error' : passwordTouched && !passwordError && 'input-success'
                )}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'password-error' : 'password-hint'}
                  autoComplete="new-password"
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
              <label htmlFor="confirmPassword">Confirm Password</label>
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
                  placeholder="Confirm your password"
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
              className="btn-primary w-full mt-6"
              aria-describedby={!isFormValid && !loading ? 'form-disabled-reason' : undefined}
            >
              {loading ? (
                <span>Creating account...</span>
              ) : (
                <>
                  <span>Create Account</span>
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
            Already have an account?{' '}
            <Link to="/login" className="text-brand-500 hover:text-brand-600 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
