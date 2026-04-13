import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Simple LRU cache for cn() function results.
 * Many components call cn() repeatedly with the same class combinations.
 */
const cnCache = new Map<string, string>();
const CN_CACHE_MAX_SIZE = 200;

/**
 * Merge Tailwind CSS classes with clsx.
 * Memoized with LRU cache for frequently-used class combinations.
 */
export function cn(...inputs: ClassValue[]): string {
  // Create cache key from inputs
  const key = inputs
    .map((input) => (typeof input === 'string' ? input : JSON.stringify(input)))
    .join('|');

  // Check cache
  const cached = cnCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  // Compute result
  const result = twMerge(clsx(inputs));

  // Cache result (with LRU eviction)
  if (cnCache.size >= CN_CACHE_MAX_SIZE) {
    // Delete oldest entry (first key)
    const firstKey = cnCache.keys().next().value;
    if (firstKey !== undefined) {
      cnCache.delete(firstKey);
    }
  }
  cnCache.set(key, result);

  return result;
}
