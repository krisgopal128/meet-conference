/**
 * Response Cache Service
 *
 * Cache-aside pattern layered on top of the existing Redis cache helpers
 * (cacheGet / cacheSet / cacheDel / cacheDelPattern from services/redis.ts).
 *
 * Provides a single `getCached<T>()` wrapper that handles:
 *   - Cache miss -> fetch -> store (non-blocking write)
 *   - Null sentinel for "not found" results (short TTL to prevent DoS)
 *   - Graceful fallback when Redis is unavailable
 *   - Pattern-based invalidation for mutations
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

/** Sentinel value for cached null/not-found results */
const NULL_SENTINEL = '__NULL__';

/** TTL for null/not-found sentinel entries (prevents repeated DB hits) */
const NULL_TTL = 5;

// ============================================
// Core: Get-or-Fetch
// ============================================

/**
 * Get a cached value or compute and store it.
 *
 * Null results are cached with a short TTL (5s) using a sentinel value
 * to prevent repeated DB hits for non-existent resources (DoS mitigation).
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  // Try cache read
  try {
    const cached = await cacheGet<string>(key);
    if (cached !== null) {
      if (cached === NULL_SENTINEL) {
        logger.debug(`[Cache] HIT (null sentinel) ${key}`);
        return null as T;
      }
      logger.debug(`[Cache] HIT  ${key}`);
      return cached as T;
    }
  } catch (err) {
    logger.warn(`[Cache] Read error for ${key}, falling through:`, err);
  }

  // Cache miss — fetch fresh data
  logger.debug(`[Cache] MISS ${key}`);
  const data = await fetchFn();

  if (data !== null && data !== undefined) {
    cacheSet(key, data, ttlSeconds).catch((err) => {
      logger.warn(`[Cache] Write error for ${key}:`, err);
    });
  } else {
    // Cache null results with short TTL to prevent repeated DB hits
    cacheSet(key, NULL_SENTINEL, NULL_TTL).catch((err) => {
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
 */
export async function invalidateAllCache(): Promise<void> {
  await invalidatePattern('cache:*');
}

// ============================================
// Key Builder
// ============================================

/**
 * Build a deterministic cache key from a prefix and query params.
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
