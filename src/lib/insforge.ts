import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_URL;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

if (!baseUrl || !anonKey) {
  throw new Error(
    'Missing InsForge configuration. Ensure VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY are set in .env.local.'
  );
}

// Capture any OAuth callback error before createClient() cleans query params from window.location.search
export const initialOAuthCallbackError: string | null = (() => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const rawError = params.get('insforge_error') || params.get('error');
  if (!rawError) return null;
  return rawError === 'access_denied'
    ? 'Sign-in was cancelled. Please try again or use your email and password.'
    : `Authentication failed: ${rawError}`;
})();

export const insforge = createClient({
  baseUrl,
  anonKey,
});
