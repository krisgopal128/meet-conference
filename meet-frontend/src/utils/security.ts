/**
 * Security utilities for input validation, URL sanitization, and token handling.
 */

/**
 * Allowed URL schemes for external links.
 * Blocks javascript:, data:, vbscript:, and other dangerous schemes.
 */
const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Validate and sanitize a URL for use in href attributes.
 * Returns null if the URL is unsafe.
 * 
 * Memoized with LRU cache for frequently-used URLs.
 */
const urlCache = new Map<string, string | null>();
const URL_CACHE_MAX_SIZE = 100;

export function sanitizeUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  // Check cache
  const cached = urlCache.get(trimmed);
  if (cached !== undefined) return cached;

  let result: string | null = null;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (SAFE_URL_SCHEMES.includes(parsed.protocol)) {
      result = trimmed;
    }
  } catch {
    // Relative URLs are safe (they stay on same origin)
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      result = trimmed;
    }
    // Protocol-relative URLs need validation
    if (trimmed.startsWith('//')) {
      try {
        const parsed = new URL(`https:${trimmed}`);
        if (SAFE_URL_SCHEMES.includes(parsed.protocol)) {
          result = trimmed;
        }
      } catch {
        result = null;
      }
    }
  }

  // Cache result with LRU eviction
  if (urlCache.size >= URL_CACHE_MAX_SIZE) {
    const firstKey = urlCache.keys().next().value;
    if (firstKey) urlCache.delete(firstKey);
  }
  urlCache.set(trimmed, result);

  return result;
}

/**
 * Check if a URL is safe for use in an anchor tag.
 */
export function isSafeUrl(url: string | undefined | null): boolean {
  return sanitizeUrl(url) !== null;
}

/**
 * Decode JWT token payload without verification.
 * Returns null if the token is invalid or malformed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    // Add padding if needed
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired.
 * Returns true if expired, false if valid, null if cannot be determined.
 */
export function isTokenExpired(token: string | null): boolean | null {
  if (!token) return true;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const exp = payload.exp;
  if (typeof exp !== 'number') return null;

  // Add 30 second buffer to prevent edge cases
  return Date.now() >= (exp * 1000) - 30000;
}

/**
 * Get the expiration timestamp from a JWT token (in milliseconds).
 * Returns null if the token doesn't have an expiration.
 */
export function getTokenExpiry(token: string | null): number | null {
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const exp = payload.exp;
  if (typeof exp !== 'number') return null;

  return exp * 1000;
}

/**
 * Get seconds until token expiry.
 * Returns null if expiry cannot be determined.
 */
export function getSecondsUntilExpiry(token: string | null): number | null {
  const expiry = getTokenExpiry(token);
  if (expiry === null) return null;

  return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
}

/**
 * Strip HTML tags from a string for safe display.
 * Used as an additional layer of defense beyond React's auto-escaping.
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Truncate a string to a maximum length and strip potentially dangerous content.
 */
export function sanitizeDisplayText(input: string, maxLength = 10000): string {
  if (!input) return '';
  const stripped = stripHtmlTags(input);
  return stripped.length > maxLength ? stripped.slice(0, maxLength) : stripped;
}

/**
 * Validate a room name to prevent path traversal and injection.
 * Room names should only contain alphanumeric characters, hyphens, and underscores.
 */
export function isValidRoomName(name: string): boolean {
  if (!name || name.length > 100) return false;
  // Allow alphanumeric, hyphens, underscores, and dots (for generated names like "quick-forest-1234")
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

/**
 * Validate an email address format.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Generate a random CSRF token for client-side request signing.
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
