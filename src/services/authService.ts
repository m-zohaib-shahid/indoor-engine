/**
 * Placeholder client-side Authentication Service (localStorage / sessionStorage).
 *
 * NOTE: No backend (e.g. Firebase Auth or Supabase) is currently configured in this
 * project. This service acts as a clean interface boundary behind `signUp`, `signIn`,
 * `signInWithGoogle`, `signOut`, `requestPasswordReset`, and `getCurrentUser` so a
 * real authentication provider can be swapped in later without modifying UI components.
 *
 * Passwords are NEVER stored in plain text. Only a non-reversible client-side SHA-256
 * verifier token is stored locally for placeholder verification. Do not treat client-side
 * storage as production authentication.
 */

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  email: string;
  provider: 'email' | 'google';
  createdAt: string;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export type AuthErrorCode =
  | 'wrong-credentials'
  | 'email-already-exists'
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

interface StoredAccountRecord {
  id: string;
  name: string;
  role: string;
  email: string;
  /** Placeholder salted SHA-256 digest for mock verification only (never plain-text password). */
  verifier: string;
  provider: 'email' | 'google';
  createdAt: string;
}

const ACCOUNTS_STORAGE_KEY = 'indoor_nav_placeholder_accounts_v1';
const LOCAL_SESSION_KEY = 'indoor_nav_auth_session_v1';
const TAB_SESSION_KEY = 'indoor_nav_auth_tab_session_v1';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Computes a one-way salted SHA-256 digest for placeholder credential matching.
 * This ensures no plain-text passwords are ever written to localStorage.
 */
async function createPlaceholderVerifier(email: string, secret: string): Promise<string> {
  const input = `indoor-nav-placeholder-salt::${normalizeEmail(email)}::${secret}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic digest if SubtleCrypto is unavailable in non-secure contexts
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv_${(hash >>> 0).toString(16)}`;
}

function readStoredAccounts(): StoredAccountRecord[] {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredAccounts(accounts: StoredAccountRecord[]): void {
  try {
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    throw new AuthServiceError(
      'network-error',
      'Unable to save your session in this browser. Please check storage permissions and try again.'
    );
  }
}

function persistSession(user: AuthUser, rememberMe: boolean): void {
  try {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
    window.sessionStorage.removeItem(TAB_SESSION_KEY);
    const serialized = JSON.stringify(user);
    if (rememberMe) {
      window.localStorage.setItem(LOCAL_SESSION_KEY, serialized);
    } else {
      window.sessionStorage.setItem(TAB_SESSION_KEY, serialized);
    }
  } catch {
    throw new AuthServiceError(
      'network-error',
      'Unable to persist your session. Please try again.'
    );
  }
}

function toAuthUser(record: StoredAccountRecord): AuthUser {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    email: record.email,
    provider: record.provider,
    createdAt: record.createdAt,
  };
}

export const authService = {
  async signUp({ fullName, email, password }: SignUpInput): Promise<AuthUser> {
    await delay(450);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new AuthServiceError(
        'network-error',
        'You appear to be offline. Please check your internet connection and try again.'
      );
    }

    const cleanEmail = normalizeEmail(email);
    const cleanName = fullName.trim();
    const accounts = readStoredAccounts();

    if (accounts.some((acc) => acc.email === cleanEmail)) {
      throw new AuthServiceError(
        'email-already-exists',
        'An account with this email is already registered. Try signing in instead.'
      );
    }

    const verifier = await createPlaceholderVerifier(cleanEmail, password);
    const newRecord: StoredAccountRecord = {
      id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      role: 'Member',
      email: cleanEmail,
      verifier,
      provider: 'email',
      createdAt: new Date().toISOString(),
    };

    writeStoredAccounts([...accounts, newRecord]);
    const user = toAuthUser(newRecord);
    persistSession(user, true);
    return user;
  },

  async signIn({ email, password, rememberMe = true }: SignInInput): Promise<AuthUser> {
    await delay(420);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new AuthServiceError(
        'network-error',
        'You appear to be offline. Please check your internet connection and try again.'
      );
    }

    const cleanEmail = normalizeEmail(email);
    const accounts = readStoredAccounts();
    const existing = accounts.find((acc) => acc.email === cleanEmail);

    if (!existing) {
      throw new AuthServiceError(
        'wrong-credentials',
        'Incorrect email or password. Please check your credentials and try again.'
      );
    }

    const verifier = await createPlaceholderVerifier(cleanEmail, password);
    if (existing.verifier !== verifier) {
      throw new AuthServiceError(
        'wrong-credentials',
        'Incorrect email or password. Please check your credentials and try again.'
      );
    }

    const user = toAuthUser(existing);
    persistSession(user, rememberMe);
    return user;
  },

  async signInWithGoogle(): Promise<AuthUser> {
    await delay(450);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new AuthServiceError(
        'network-error',
        'You appear to be offline. Please check your internet connection and try again.'
      );
    }

    // Placeholder Google profile for local demo mode until OAuth/Firebase is wired
    const googleUser: AuthUser = {
      id: 'usr_google_demo',
      name: 'Alex Morgan',
      role: 'Member',
      email: 'alex.morgan@gmail.com',
      provider: 'google',
      createdAt: new Date().toISOString(),
    };

    persistSession(googleUser, true);
    return googleUser;
  },

  async requestPasswordReset(email: string): Promise<void> {
    await delay(400);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new AuthServiceError(
        'network-error',
        'Unable to send reset instructions while offline. Please try again.'
      );
    }

    const cleanEmail = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new AuthServiceError('validation-error', 'Please enter a valid email address.');
    }
  },

  async signOut(): Promise<void> {
    try {
      window.localStorage.removeItem(LOCAL_SESSION_KEY);
      window.sessionStorage.removeItem(TAB_SESSION_KEY);
    } catch {
      // Ignore storage access errors on sign out
    }
  },

  getCurrentUser(): AuthUser | null {
    try {
      const tabRaw = window.sessionStorage.getItem(TAB_SESSION_KEY);
      const localRaw = window.localStorage.getItem(LOCAL_SESSION_KEY);
      const raw = tabRaw || localRaw;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthUser;
      if (!parsed || !parsed.id || !parsed.email || !parsed.name) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },
};
