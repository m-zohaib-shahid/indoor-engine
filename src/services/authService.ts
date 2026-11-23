import { InsForgeError, type UserSchema } from '@insforge/sdk';
import { insforge } from '../lib/insforge';

export type OAuthProvider = 'google' | 'github';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  email: string;
  provider: 'email' | 'google' | 'github';
  emailVerified: boolean;
  createdAt: string;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
}

export type SignUpResult =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'verification-required'; email: string; method: 'code' | 'link' };

export interface SignInInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface VerifyEmailInput {
  email: string;
  code: string;
}

export interface ConfirmPasswordResetInput {
  email: string;
  code: string;
  newPassword: string;
}

export interface PublicAuthConfig {
  oAuthProviders: OAuthProvider[];
  requireEmailVerification: boolean;
  verifyEmailMethod: 'code' | 'link';
  resetPasswordMethod: 'code' | 'link';
  passwordMinLength: number;
  disableSignup: boolean;
}

export type AuthErrorCode =
  | 'wrong-credentials'
  | 'email-already-exists'
  | 'email-not-verified'
  | 'invalid-code'
  | 'rate-limited'
  | 'oauth-iframe-blocked'
  | 'network-error'
  | 'validation-error';

export class AuthServiceError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
  }
}

const EPHEMERAL_SESSION_KEY = 'indoor_nav_ephemeral_session_v1';
const TAB_ALIVE_KEY = 'indoor_nav_tab_alive_v1';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

function ensureOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new AuthServiceError(
      'network-error',
      'You appear to be offline. Please check your internet connection and try again.'
    );
  }
}

function setSessionPersistencePreference(rememberMe: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (rememberMe) {
      window.localStorage.removeItem(EPHEMERAL_SESSION_KEY);
      window.sessionStorage.setItem(TAB_ALIVE_KEY, '1');
    } else {
      window.localStorage.setItem(EPHEMERAL_SESSION_KEY, '1');
      window.sessionStorage.setItem(TAB_ALIVE_KEY, '1');
    }
  } catch {
    // Ignore storage restriction errors
  }
}

function clearSessionPersistencePreference(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(EPHEMERAL_SESSION_KEY);
    window.sessionStorage.removeItem(TAB_ALIVE_KEY);
  } catch {
    // Ignore storage restriction errors
  }
}

function shouldInvalidateEphemeralSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isEphemeral = window.localStorage.getItem(EPHEMERAL_SESSION_KEY) === '1';
    const isSameTab = window.sessionStorage.getItem(TAB_ALIVE_KEY) === '1';
    return isEphemeral && !isSameTab;
  } catch {
    return false;
  }
}

function toAuthUser(user: UserSchema): AuthUser {
  const profileName =
    user.profile && typeof user.profile.name === 'string' && user.profile.name.trim()
      ? user.profile.name.trim()
      : null;
  const fallbackName = user.email.split('@')[0] || 'Navigator';
  const roleMeta =
    user.metadata && typeof user.metadata.role === 'string' && user.metadata.role.trim()
      ? user.metadata.role.trim()
      : 'Member';

  const providers = Array.isArray(user.providers) ? user.providers : [];
  let provider: AuthUser['provider'] = 'email';
  if (providers.includes('google')) {
    provider = 'google';
  } else if (providers.includes('github')) {
    provider = 'github';
  }

  return {
    id: user.id,
    name: profileName ?? fallbackName,
    role: roleMeta,
    email: user.email,
    provider,
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt,
  };
}

function mapInsForgeError(err: unknown, fallbackMessage: string): AuthServiceError {
  if (err instanceof AuthServiceError) return err;

  if (err instanceof InsForgeError) {
    const msg = err.message || fallbackMessage;
    const lower = msg.toLowerCase();
    const errorCode = String(err.error || '').toUpperCase();

    if (
      err.statusCode === 0 ||
      lower.includes('failed to fetch') ||
      lower.includes('network') ||
      lower.includes('timeout')
    ) {
      return new AuthServiceError(
        'network-error',
        'Unable to reach the authentication server. Please check your connection and try again.'
      );
    }

    if (err.statusCode === 429 || errorCode.includes('RATE_LIMIT')) {
      return new AuthServiceError(
        'rate-limited',
        'Too many attempts. Please wait a minute before trying again.'
      );
    }

    if (
      lower.includes('not verified') ||
      lower.includes('verify your email') ||
      lower.includes('email verification') ||
      errorCode.includes('EMAIL_NOT_VERIFIED')
    ) {
      return new AuthServiceError(
        'email-not-verified',
        'Your email address has not been verified yet. Enter the 6-digit verification code sent to your inbox.'
      );
    }

    if (
      err.statusCode === 409 ||
      errorCode === 'ALREADY_EXISTS' ||
      lower.includes('already exists') ||
      lower.includes('already registered')
    ) {
      return new AuthServiceError(
        'email-already-exists',
        'An account with this email is already registered. Try signing in instead.'
      );
    }

    if (
      errorCode.includes('INVALID_OTP') ||
      errorCode.includes('OTP_EXPIRED') ||
      lower.includes('invalid verification') ||
      lower.includes('expired verification') ||
      lower.includes('invalid otp') ||
      lower.includes('invalid reset') ||
      lower.includes('expired code') ||
      lower.includes('invalid code')
    ) {
      return new AuthServiceError(
        'invalid-code',
        msg || 'Invalid or expired verification code. Please check the code or request a new one.'
      );
    }

    if (
      err.statusCode === 401 ||
      errorCode === 'INVALID_CREDENTIALS' ||
      lower.includes('invalid credentials') ||
      lower.includes('invalid email or password') ||
      lower.includes('incorrect')
    ) {
      return new AuthServiceError(
        'wrong-credentials',
        'Incorrect email or password. Please check your credentials and try again.'
      );
    }

    if (err.statusCode === 400 || errorCode === 'INVALID_INPUT') {
      return new AuthServiceError('validation-error', msg);
    }

    return new AuthServiceError('validation-error', msg);
  }

  if (err instanceof Error) {
    const lower = err.message.toLowerCase();
    if (lower.includes('fetch') || lower.includes('network')) {
      return new AuthServiceError(
        'network-error',
        'Unable to reach the authentication server. Please try again.'
      );
    }
    return new AuthServiceError('validation-error', err.message || fallbackMessage);
  }

  return new AuthServiceError('validation-error', fallbackMessage);
}

const DEFAULT_PUBLIC_CONFIG: PublicAuthConfig = {
  oAuthProviders: ['google', 'github'],
  requireEmailVerification: true,
  verifyEmailMethod: 'code',
  resetPasswordMethod: 'code',
  passwordMinLength: 6,
  disableSignup: false,
};

export const authService = {
  async getAuthConfig(): Promise<PublicAuthConfig> {
    try {
      const { data, error } = await insforge.auth.getPublicAuthConfig();
      if (error || !data) {
        return DEFAULT_PUBLIC_CONFIG;
      }
      const providers = Array.isArray(data.oAuthProviders)
        ? data.oAuthProviders.filter(
            (p): p is OAuthProvider => p === 'google' || p === 'github'
          )
        : DEFAULT_PUBLIC_CONFIG.oAuthProviders;

      return {
        oAuthProviders: providers,
        requireEmailVerification: Boolean(data.requireEmailVerification),
        verifyEmailMethod: data.verifyEmailMethod === 'link' ? 'link' : 'code',
        resetPasswordMethod: data.resetPasswordMethod === 'link' ? 'link' : 'code',
        passwordMinLength:
          typeof data.passwordMinLength === 'number' && data.passwordMinLength > 0
            ? data.passwordMinLength
            : 6,
        disableSignup: Boolean(data.disableSignup),
      };
    } catch {
      return DEFAULT_PUBLIC_CONFIG;
    }
  },

  async signUp({ fullName, email, password }: SignUpInput): Promise<SignUpResult> {
    ensureOnline();

    const cleanEmail = normalizeEmail(email);
    const cleanName = fullName.trim();

    const { data, error } = await insforge.auth.signUp({
      email: cleanEmail,
      password,
      name: cleanName,
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    });

    if (error) {
      throw mapInsForgeError(error, 'Unable to create your account right now. Please try again.');
    }

    if (data?.requireEmailVerification) {
      return {
        status: 'verification-required',
        email: data.user?.email ?? cleanEmail,
        method: 'code',
      };
    }

    if (data?.accessToken && data.user) {
      setSessionPersistencePreference(true);
      return {
        status: 'authenticated',
        user: toAuthUser(data.user),
      };
    }

    throw new AuthServiceError(
      'validation-error',
      'Unexpected registration response. Please try signing in.'
    );
  },

  async verifyEmail({ email, code }: VerifyEmailInput): Promise<AuthUser> {
    ensureOnline();

    const cleanEmail = normalizeEmail(email);
    const cleanCode = code.trim();

    const { data, error } = await insforge.auth.verifyEmail({
      email: cleanEmail,
      otp: cleanCode,
    });

    if (error) {
      throw mapInsForgeError(
        error,
        'Invalid or expired verification code. Please double-check and try again.'
      );
    }

    if (!data?.user) {
      throw new AuthServiceError(
        'invalid-code',
        'Verification could not be completed. Please try again.'
      );
    }

    setSessionPersistencePreference(true);
    return toAuthUser(data.user);
  },

  async resendVerificationCode(email: string): Promise<void> {
    ensureOnline();

    const cleanEmail = normalizeEmail(email);
    const { error } = await insforge.auth.resendVerificationEmail({
      email: cleanEmail,
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    });

    if (error) {
      throw mapInsForgeError(
        error,
        'Unable to resend verification code right now. Please try again shortly.'
      );
    }
  },

  async signIn({ email, password, rememberMe = true }: SignInInput): Promise<AuthUser> {
    ensureOnline();

    const cleanEmail = normalizeEmail(email);
    const { data, error } = await insforge.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      throw mapInsForgeError(
        error,
        'Incorrect email or password. Please check your credentials and try again.'
      );
    }

    if (!data?.user || !data.accessToken) {
      throw new AuthServiceError(
        'wrong-credentials',
        'Unable to start a session. Please try again.'
      );
    }

    setSessionPersistencePreference(rememberMe);
    return toAuthUser(data.user);
  },

  async signInWithOAuth(provider: OAuthProvider): Promise<void> {
    ensureOnline();

    if (typeof window !== 'undefined' && window.self !== window.top) {
      throw new AuthServiceError(
        'oauth-iframe-blocked',
        `Social sign-in with ${provider === 'google' ? 'Google' : 'GitHub'} cannot open inside an embedded preview frame. Open this app in a full browser tab to continue with ${provider === 'google' ? 'Google' : 'GitHub'}.`
      );
    }

    setSessionPersistencePreference(true);
    const redirectTo =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const { error } = await insforge.auth.signInWithOAuth(provider, {
      redirectTo,
    });

    if (error) {
      throw mapInsForgeError(
        error,
        `Unable to continue with ${provider === 'google' ? 'Google' : 'GitHub'} right now.`
      );
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
    ensureOnline();

    const cleanEmail = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new AuthServiceError('validation-error', 'Please enter a valid email address.');
    }

    const { error } = await insforge.auth.sendResetPasswordEmail({
      email: cleanEmail,
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    });

    if (error) {
      throw mapInsForgeError(
        error,
        'Unable to send password reset code right now. Please try again.'
      );
    }
  },

  async confirmPasswordReset({
    email,
    code,
    newPassword,
  }: ConfirmPasswordResetInput): Promise<void> {
    ensureOnline();

    const cleanEmail = normalizeEmail(email);
    const cleanCode = code.trim();

    const { data: tokenData, error: exchangeError } =
      await insforge.auth.exchangeResetPasswordToken({
        email: cleanEmail,
        code: cleanCode,
      });

    if (exchangeError || !tokenData?.token) {
      throw mapInsForgeError(
        exchangeError,
        'Invalid or expired reset code. Please verify the 6-digit code from your email.'
      );
    }

    const { error: resetError } = await insforge.auth.resetPassword({
      newPassword,
      otp: tokenData.token,
    });

    if (resetError) {
      throw mapInsForgeError(
        resetError,
        'Unable to update your password. Please request a new reset code.'
      );
    }
  },

  async signOut(): Promise<void> {
    clearSessionPersistencePreference();
    try {
      await insforge.auth.signOut();
    } catch {
      // Ignore network errors when clearing local session
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      if (shouldInvalidateEphemeralSession()) {
        clearSessionPersistencePreference();
        await insforge.auth.signOut().catch(() => undefined);
        return null;
      }

      const { data } = await insforge.auth.getCurrentUser();
      if (!data?.user) {
        return null;
      }

      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(TAB_ALIVE_KEY, '1');
        } catch {
          // Ignore
        }
      }

      return toAuthUser(data.user);
    } catch {
      return null;
    }
  },
};
