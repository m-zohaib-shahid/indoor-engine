import React, { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Compass,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { authService, AuthServiceError, AuthUser } from '../services/authService';

interface AuthScreenProps {
  onAuthSuccess: (user: AuthUser) => void;
}

type AuthMode = 'signin' | 'signup';

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const IndoorNavLogoMark: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => {
  const dim = size === 'md' ? 'w-11 h-11' : 'w-10 h-10';
  const iconDim = size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  return (
    <div
      className={`${dim} rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-[1.5px] shadow-lg shadow-cyan-500/20 shrink-0`}
    >
      <div className="w-full h-full bg-[#0F172A] rounded-[10.5px] flex items-center justify-center">
        <Compass className={`${iconDim} text-cyan-400`} aria-hidden="true" />
      </div>
    </div>
  );
};

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.92h5.45c-.24 1.26-.96 2.33-2.04 3.04l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.47 0-.72-.06-1.41-.19-2.05H12z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 4.96-.89 6.61-2.42l-3.3-2.56c-.9.6-2.05.96-3.31.96-2.54 0-4.7-1.72-5.47-4.03H3.12v2.64A9.99 9.99 0 0 0 12 22z"
    />
    <path
      fill="#FBBC05"
      d="M6.53 13.95A5.98 5.98 0 0 1 6.2 12c0-.68.12-1.34.33-1.95V7.41H3.12A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.12 4.59l3.41-2.64z"
    />
    <path
      fill="#4285F4"
      d="M12 6.02c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.95 3.02 14.7 2 12 2 8.09 2 4.71 4.24 3.12 7.41l3.41 2.64C7.3 7.74 9.46 6.02 12 6.02z"
    />
  </svg>
);

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const prefersReducedMotion = useReducedMotion();
  const baseId = useId();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Forgot password modal state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  // Terms & Privacy info modal
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode || isSubmitting || isGoogleSubmitting) return;
    setMode(nextMode);
    setFieldErrors({});
    setFormError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (formError) setFormError(null);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (mode === 'signup' && fullName.trim().length < 2) {
      errors.fullName = 'Please enter your full name.';
    }

    if (!trimmedEmail) {
      errors.email = 'Please enter your email address.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Please enter your password.';
    } else if (password.length < 8 || !/\d/.test(password)) {
      errors.password = 'Password must be at least 8 characters and include at least 1 number.';
    }

    if (mode === 'signup') {
      if (!confirmPassword) {
        errors.confirmPassword = 'Please confirm your password.';
      } else if (confirmPassword !== password) {
        errors.confirmPassword = 'Passwords do not match.';
      }

      if (!agreedToTerms) {
        errors.terms = 'Please agree to the Terms & Privacy Policy to create an account.';
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const user =
        mode === 'signup'
          ? await authService.signUp({ fullName, email, password })
          : await authService.signIn({ email, password, rememberMe });

      onAuthSuccess(user);
    } catch (err) {
      if (err instanceof AuthServiceError) {
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleContinue = async () => {
    setFormError(null);
    setFieldErrors({});
    setIsGoogleSubmitting(true);

    try {
      const user = await authService.signInWithGoogle();
      onAuthSuccess(user);
    } catch (err) {
      if (err instanceof AuthServiceError) {
        setFormError(err.message);
      } else {
        setFormError('Unable to continue with Google right now. Please try again.');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const openForgotModal = () => {
    setResetEmail(email.trim());
    setResetError(null);
    setResetSuccess(false);
    setIsForgotOpen(true);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    const trimmed = resetEmail.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setResetError('Please enter a valid email address.');
      return;
    }

    setIsResetSubmitting(true);
    try {
      await authService.requestPasswordReset(trimmed);
      setResetSuccess(true);
    } catch (err) {
      if (err instanceof AuthServiceError) {
        setResetError(err.message);
      } else {
        setResetError('Unable to send reset link right now. Please try again.');
      }
    } finally {
      setIsResetSubmitting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isForgotOpen) setIsForgotOpen(false);
        if (isTermsOpen) setIsTermsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isForgotOpen, isTermsOpen]);

  const busy = isSubmitting || isGoogleSubmitting;

  return (
    <div className="min-h-screen w-full bg-[#070B14] text-slate-100 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10 relative overflow-x-hidden">
      {/* Ambient Brand Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-36 -left-36 w-[28rem] h-[28rem] rounded-full bg-cyan-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-36 -right-36 w-[28rem] h-[28rem] rounded-full bg-blue-600/10 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Desktop Left Brand Panel */}
        <div className="hidden lg:flex flex-col justify-between p-10 rounded-3xl bg-[#0F172A]/75 border border-slate-800/80 backdrop-blur-xl min-h-[560px] shadow-2xl">
          <div>
            <div className="flex items-center gap-3.5">
              <IndoorNavLogoMark size="md" />
              <span className="text-xl font-bold tracking-tight text-white">
                Indoor Navigation
              </span>
            </div>

            <div className="mt-12">
              <h2 className="text-3xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
                Welcome to Indoor Navigation
              </h2>
              <p className="mt-3 text-base text-slate-300 leading-relaxed max-w-md">
                Real-time indoor positioning, live peer discovery, and A* wayfinding across your floor plan.
              </p>
            </div>
          </div>

          {/* Animated Indoor Floor Plan & Wayfinding Visual */}
          <div className="my-8 p-6 rounded-2xl bg-[#090D18]/90 border border-slate-800/80">
            <svg
              viewBox="0 0 320 120"
              className="w-full h-28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Subtle Floor Grid */}
              <path
                d="M20 30 H300 M20 60 H300 M20 90 H300 M80 12 V108 M160 12 V108 M240 12 V108"
                stroke="#1E293B"
                strokeWidth="1"
              />
              {/* Room Outlines */}
              <rect x="24" y="16" width="84" height="40" rx="6" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
              <rect x="212" y="64" width="84" height="40" rx="6" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />

              {/* Glowing A* Route Path */}
              <path
                d="M66 36 L160 36 L160 84 L254 84"
                stroke="#06B6D4"
                strokeOpacity="0.22"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <motion.path
                d="M66 36 L160 36 L160 84 L254 84"
                stroke="#22D3EE"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6 6"
                animate={prefersReducedMotion ? undefined : { strokeDashoffset: [0, -24] }}
                transition={
                  prefersReducedMotion
                    ? undefined
                    : { duration: 1.4, repeat: Infinity, ease: 'linear' }
                }
              />

              {/* User Beacon (Blue) */}
              {!prefersReducedMotion && (
                <motion.circle
                  cx="66"
                  cy="36"
                  r="10"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  animate={{ scale: [0.8, 1.8], opacity: [0.8, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  style={{ transformOrigin: '66px 36px' }}
                />
              )}
              <circle cx="66" cy="36" r="6" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />

              {/* Target Peer Beacon (Amber) */}
              {!prefersReducedMotion && (
                <motion.circle
                  cx="254"
                  cy="84"
                  r="10"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  animate={{ scale: [0.8, 1.8], opacity: [0.8, 0] }}
                  transition={{ duration: 1.8, delay: 0.6, repeat: Infinity, ease: 'easeOut' }}
                  style={{ transformOrigin: '254px 84px' }}
                />
              )}
              <circle cx="254" cy="84" r="6" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
            </svg>
            <p className="mt-3 text-xs text-slate-400">
              Precision indoor positioning &amp; live wayfinding.
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Indoor Navigation · Multi-user floor tracking &amp; shortest-path routing
          </p>
        </div>

        {/* Right (or Centered Mobile) Auth Form Card */}
        <div className="w-full max-w-md mx-auto bg-[#0F172A]/85 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          {/* Header (Compact on desktop, full brand anchor on mobile) */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left mb-6">
            <div className="flex items-center gap-3 mb-3 lg:hidden">
              <IndoorNavLogoMark size="sm" />
              <span className="text-lg font-bold tracking-tight text-white">
                Indoor Navigation
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome to Indoor Navigation
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Sign in to access your live building floor plan.
            </p>
          </div>

          {/* Animated Tab Switch: Sign In / Sign Up */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 p-1 rounded-xl bg-slate-900/90 border border-slate-800 mb-6"
          >
            {(['signin', 'signup'] as const).map((tab) => {
              const active = mode === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchMode(tab)}
                  className={`relative min-h-[44px] rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    active ? 'text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="indoor-nav-auth-tab"
                      transition={
                        prefersReducedMotion
                          ? { duration: 0.1 }
                          : { type: 'spring', stiffness: 420, damping: 32 }
                      }
                      className="absolute inset-0 rounded-lg bg-cyan-500 shadow-md shadow-cyan-500/20"
                    />
                  )}
                  <span className="relative z-10">
                    {tab === 'signin' ? 'Sign In' : 'Sign Up'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Continue with Google + "or" divider */}
          <button
            type="button"
            onClick={handleGoogleContinue}
            disabled={busy}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#090D18] hover:bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-100 text-sm font-medium transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {isGoogleSubmitting ? (
              <span
                className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            ) : (
              <GoogleIcon />
            )}
            <span>Continue with Google</span>
          </button>

          <div className="flex items-center gap-3 my-5" aria-hidden="true">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs font-medium text-slate-500">or</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Form-level Error Banner */}
          <div aria-live="polite" className="min-h-0">
            <AnimatePresence>
              {formError && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
                  transition={{ duration: 0.2 }}
                  className="mb-4 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{formError}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <AnimatePresence mode="wait" initial={false}>
              {mode === 'signup' && (
                <motion.div
                  key="signup-name"
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <label
                    htmlFor={`${baseId}-fullname`}
                    className="block text-xs font-medium text-slate-200 mb-1.5"
                  >
                    Full name
                  </label>
                  <div className="relative">
                    <User
                      className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id={`${baseId}-fullname`}
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        clearFieldError('fullName');
                      }}
                      placeholder="Alex Morgan"
                      aria-invalid={Boolean(fieldErrors.fullName)}
                      aria-describedby={fieldErrors.fullName ? `${baseId}-fullname-error` : undefined}
                      className={`w-full min-h-[44px] bg-[#090D18] border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors ${
                        fieldErrors.fullName ? 'border-rose-500/70' : 'border-slate-800 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p
                      id={`${baseId}-fullname-error`}
                      aria-live="polite"
                      className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.fullName}</span>
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div>
              <label
                htmlFor={`${baseId}-email`}
                className="block text-xs font-medium text-slate-200 mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id={`${baseId}-email`}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError('email');
                  }}
                  placeholder="you@company.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? `${baseId}-email-error` : undefined}
                  className={`w-full min-h-[44px] bg-[#090D18] border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors ${
                    fieldErrors.email ? 'border-rose-500/70' : 'border-slate-800 focus:border-cyan-500'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p
                  id={`${baseId}-email-error`}
                  aria-live="polite"
                  className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor={`${baseId}-password`}
                className="block text-xs font-medium text-slate-200 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id={`${baseId}-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError('password');
                  }}
                  placeholder="At least 8 characters with a number"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? `${baseId}-password-error` : undefined}
                  className={`w-full min-h-[44px] bg-[#090D18] border rounded-xl pl-10 pr-12 py-2.5 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors ${
                    fieldErrors.password ? 'border-rose-500/70' : 'border-slate-800 focus:border-cyan-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-r-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p
                  id={`${baseId}-password-error`}
                  aria-live="polite"
                  className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.password}</span>
                </p>
              )}
            </div>

            {/* Confirm Password (Sign Up only) */}
            <AnimatePresence mode="wait" initial={false}>
              {mode === 'signup' && (
                <motion.div
                  key="signup-confirm"
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor={`${baseId}-confirm-password`}
                      className="block text-xs font-medium text-slate-200 mb-1.5"
                    >
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock
                        className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id={`${baseId}-confirm-password`}
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          clearFieldError('confirmPassword');
                        }}
                        placeholder="Re-enter your password"
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        aria-describedby={
                          fieldErrors.confirmPassword ? `${baseId}-confirm-error` : undefined
                        }
                        className={`w-full min-h-[44px] bg-[#090D18] border rounded-xl pl-10 pr-12 py-2.5 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors ${
                          fieldErrors.confirmPassword
                            ? 'border-rose-500/70'
                            : 'border-slate-800 focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-r-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p
                        id={`${baseId}-confirm-error`}
                        aria-live="polite"
                        className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{fieldErrors.confirmPassword}</span>
                      </p>
                    )}
                  </div>

                  {/* Terms & Privacy Policy Checkbox */}
                  <div>
                    <div className="flex items-start gap-2.5 min-h-[44px] py-1">
                      <input
                        id={`${baseId}-terms`}
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => {
                          setAgreedToTerms(e.target.checked);
                          clearFieldError('terms');
                        }}
                        aria-invalid={Boolean(fieldErrors.terms)}
                        aria-describedby={fieldErrors.terms ? `${baseId}-terms-error` : undefined}
                        className="mt-0.5 w-5 h-5 rounded border-slate-700 bg-[#090D18] text-cyan-500 accent-cyan-500 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      />
                      <label htmlFor={`${baseId}-terms`} className="text-xs text-slate-300 leading-relaxed cursor-pointer">
                        I agree to{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setIsTermsOpen(true);
                          }}
                          className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
                        >
                          Terms &amp; Privacy Policy
                        </button>
                      </label>
                    </div>
                    {fieldErrors.terms && (
                      <p
                        id={`${baseId}-terms-error`}
                        aria-live="polite"
                        className="mt-1 text-xs text-rose-400 flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{fieldErrors.terms}</span>
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sign In Options Row: Remember me + Forgot password */}
            {mode === 'signin' && (
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`${baseId}-remember`}
                  className="inline-flex items-center gap-2.5 min-h-[44px] text-xs text-slate-300 cursor-pointer select-none"
                >
                  <input
                    id={`${baseId}-remember`}
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-[#090D18] text-cyan-500 accent-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={openForgotModal}
                  className="min-h-[44px] px-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] py-3 px-4 rounded-xl text-sm font-bold bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
            >
              {isSubmitting ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span>{mode === 'signup' ? 'Creating account...' : 'Signing in...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {isForgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${baseId}-forgot-title`}
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 id={`${baseId}-forgot-title`} className="text-lg font-bold text-white">
                    Reset your password
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter your account email and we will send password reset instructions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(false)}
                  aria-label="Close password reset dialog"
                  className="w-11 h-11 -mt-2 -mr-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {resetSuccess ? (
                <div className="space-y-4">
                  <div
                    role="status"
                    aria-live="polite"
                    className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      If an account exists for <strong className="text-white">{resetEmail.trim()}</strong>, password reset instructions have been sent.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(false)}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} noValidate className="space-y-4">
                  <div>
                    <label
                      htmlFor={`${baseId}-reset-email`}
                      className="block text-xs font-medium text-slate-200 mb-1.5"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail
                        className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id={`${baseId}-reset-email`}
                        type="email"
                        autoComplete="email"
                        value={resetEmail}
                        onChange={(e) => {
                          setResetEmail(e.target.value);
                          if (resetError) setResetError(null);
                        }}
                        placeholder="you@company.com"
                        aria-invalid={Boolean(resetError)}
                        aria-describedby={resetError ? `${baseId}-reset-error` : undefined}
                        className={`w-full min-h-[44px] bg-[#090D18] border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                          resetError ? 'border-rose-500/70' : 'border-slate-800 focus:border-cyan-500'
                        }`}
                      />
                    </div>
                    {resetError && (
                      <p
                        id={`${baseId}-reset-error`}
                        aria-live="polite"
                        className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{resetError}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsForgotOpen(false)}
                      className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isResetSubmitting}
                      className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                      {isResetSubmitting && (
                        <span
                          className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      <span>Send Reset Link</span>
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terms & Privacy Policy Modal */}
      <AnimatePresence>
        {isTermsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${baseId}-terms-title`}
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 id={`${baseId}-terms-title`} className="text-lg font-bold text-white">
                  Terms &amp; Privacy Policy
                </h2>
                <button
                  type="button"
                  onClick={() => setIsTermsOpen(false)}
                  aria-label="Close terms dialog"
                  className="w-11 h-11 -mt-2 -mr-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>
                  Indoor Navigation uses your account details strictly to identify your profile on the building floor plan and coordinate peer-to-peer wayfinding.
                </p>
                <p>
                  You can sign out at any time from the dashboard header to clear your active browser session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAgreedToTerms(true);
                  clearFieldError('terms');
                  setIsTermsOpen(false);
                }}
                className="mt-5 w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Agree &amp; Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
