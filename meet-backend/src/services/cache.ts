/**
 * Response Cache Service
 *
 * Cache-aside pattern layered on top of the existing Redis cache helpers
 * (cacheGet / cacheSet / cacheDel / cacheDelPattern from services/redis.ts).
 *
 * Provides a single `getCached<T>()` wrapper that handles:
 *   - Cache miss → fetch → store (non-blocking write)
 *   - Graceful fallback when Redis is unavailable
 *   - Pattern-based invalidation for mutations
 *
 * Key prefix convention:
 *   cache:stats:*       — admin dashboard stats
 *   cache:meetings:*    — meeting history / details
 *   cache:users:*       — user list / detail
 *   cache:rooms:*       — room list / detail
 *   cache:apikeys:*     — API key list
 *   cache:audit:*       — audit logs
 *   cache:participants:* — participant summaries
 */

import logger from '../utils/logger.js';
import {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
} from './redis.js';

/** Short TTL — rapidly-changing data (active meetings, participant counts) */
export const TTL_SHORT = 30;

/** Medium TTL — dashboard stats, user lists */
export const TTL_MEDIUM = 60;

/** Long TTL — metadata that rarely changes (room config, API key list) */
export const TTL_LONG = 120;

// ============================================
// Core: Get-or-Fetch
// ============================================

/**
 * Get a cached value or compute and store it.
 *
 * The fetch function may return `null` (e.g., "not found").
 * Null results are NOT cached — every request will re-fetch.
 * Only non-null results are stored in Redis.
 *
 * On Redis failure, silently falls through to `fetchFn`
 * so caching never breaks the application.
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  // Try cache read
  try {
    const cached = await cacheGet<T>(key);
    if (cached !== null) {
      logger.debug(`[Cache] HIT  ${key}`);
      return cached;
    }
  } catch (err) {
    logger.warn(`[Cache] Read error for ${key}, falling through:`, err);
  }

  // Cache miss — fetch fresh data
  logger.debug(`[Cache] MISS ${key}`);
  const data = await fetchFn();

  // Only cache non-null results (null = "not found", shouldn't be cached)
  if (data !== null && data !== undefined) {
    cacheSet(key, data, ttlSeconds).catch((err) => {
      logger.warn(`[Cache] Write error for ${key}:`, err);
    });
  }

  return data;
}

// ============================================
// Invalidation
// ============================================

/**
 * Invalidate one or more exact cache keys.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  try {
    await Promise.all(keys.map((k) => cacheDel(k)));
    logger.debug(`[Cache] Invalidated ${keys.length} key(s)`);
  } catch (err) {
    logger.warn('[Cache] Invalidation error:', err);
  }
}

/**
 * Invalidate all cache keys matching a glob pattern.
 *
 * Uses SCAN (not KEYS) via the existing `cacheDelPattern` helper.
 *
 * Example: `invalidatePattern('cache:stats:*')`
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    const deleted = await cacheDelPattern(pattern);
    if (deleted > 0) {
      logger.debug(`[Cache] Invalidated ${deleted} key(s) matching ${pattern}`);
    }
  } catch (err) {
    logger.warn(`[Cache] Pattern invalidation error for ${pattern}:`, err);
  }
}

/**
 * Invalidate all response cache entries.
 * Use sparingly — only for global mutations.
 */
export async function invalidateAllCache(): Promise<void> {
  await invalidatePattern('cache:*');
}

// ============================================
// Key Builder
// ============================================

/**
 * Build a deterministic cache key from a prefix and query params.
 * Sorts params for consistent cache hits regardless of key order.
 */
export function buildListKey(
  prefix: string,
  params: Record<string, unknown>,
): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return `cache:${prefix}:${parts.join('&')}`;
}
