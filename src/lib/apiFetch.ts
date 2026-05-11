/**
 * Auth-aware fetch wrapper for client-side API calls.
 *
 * - Stores JWT in localStorage (works in iframes/embedded contexts)
 * - Auto-attaches Authorization header
 * - Built-in retry logic for failed requests
 * - Auto-redirects to login on 401
 */

const TOKEN_KEY = 'wbms-auth-token';
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(status: number): boolean {
  // Retry on server errors and rate limiting, but NOT on auth/client errors
  return status >= 500 || status === 429;
}

// ---------------------------------------------------------------------------
// Auth-aware fetch with retry
// ---------------------------------------------------------------------------

/**
 * Wrapper around `window.fetch` that:
 * 1. Attaches JWT Authorization header automatically
 * 2. Retries on server errors (5xx) and rate limiting (429)
 * 3. Handles 401 by clearing the token
 *
 * Usage:
 *   apiFetch('/api/settings')
 *   apiFetch('/api/messages', { method: 'POST', body: … })
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { _retryCount?: number },
): Promise<Response> {
  const token = getToken();
  const retryCount = init?._retryCount ?? 0;

  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Only set Content-Type to JSON if there's a body and it's not FormData
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Remove internal property from init
  const { _retryCount, ...cleanInit } = init ?? {};

  try {
    const response = await fetch(input, { ...cleanInit, headers });

    // Handle 401 — clear token (let the app handle redirect)
    if (response.status === 401 && !input.toString().includes('/api/auth/')) {
      removeToken();
    }

    // Retry on server errors
    if (!response.ok && shouldRetry(response.status) && retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAY * (retryCount + 1));
      return apiFetch(input, { ...cleanInit, _retryCount: retryCount + 1 });
    }

    return response;
  } catch (error) {
    // Network error — retry if possible
    if (retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAY * (retryCount + 1));
      return apiFetch(input, { ...cleanInit, _retryCount: retryCount + 1 });
    }

    throw error;
  }
}
