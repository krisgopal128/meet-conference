import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCached,
  invalidateCache,
  invalidatePattern,
  buildListKey,
  TTL_SHORT,
  TTL_MEDIUM,
  TTL_LONG,
} from '../../src/services/cache.js';

// Mock the redis service
vi.mock('../../src/services/redis.js', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(() => Promise.resolve()),
  cacheDel: vi.fn(() => Promise.resolve()),
  cacheDelPattern: vi.fn(() => Promise.resolve(0)),
}));

import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../../src/services/redis.js';

describe('Cache Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCached', () => {
    it('returns cached value on cache hit', async () => {
      const mockData = { id: 1, name: 'Test' };
      vi.mocked(cacheGet).mockResolvedValueOnce(mockData);

      const fetchFn = vi.fn().mockResolvedValue(mockData);
      const result = await getCached('test:key', TTL_MEDIUM, fetchFn);

      expect(result).toEqual(mockData);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(cacheGet).toHaveBeenCalledWith('test:key');
    });

    it('fetches and caches on cache miss', async () => {
      const mockData = { id: 1, name: 'Test' };
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const fetchFn = vi.fn().mockResolvedValue(mockData);
      const result = await getCached('test:key', TTL_MEDIUM, fetchFn);

      expect(result).toEqual(mockData);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(cacheSet).toHaveBeenCalledWith('test:key', mockData, TTL_MEDIUM);
    });

    it('returns null and caches sentinel for null results', async () => {
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const fetchFn = vi.fn().mockResolvedValue(null);
      const result = await getCached('test:key', TTL_MEDIUM, fetchFn);

      expect(result).toBeNull();
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(cacheSet).toHaveBeenCalledWith('test:key', '__NULL__', 5); // NULL_TTL
    });

    it('returns null for cached null sentinel', async () => {
      vi.mocked(cacheGet).mockResolvedValueOnce('__NULL__');

      const fetchFn = vi.fn().mockResolvedValue({ id: 1 });
      const result = await getCached('test:key', TTL_MEDIUM, fetchFn);

      expect(result).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('falls back to fetch when cache read fails', async () => {
      const mockData = { id: 1, name: 'Test' };
      vi.mocked(cacheGet).mockRejectedValueOnce(new Error('Redis down'));

      const fetchFn = vi.fn().mockResolvedValue(mockData);
      const result = await getCached('test:key', TTL_MEDIUM, fetchFn);

      expect(result).toEqual(mockData);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does not cache when write fails', async () => {
      const mockData = { id: 1, name: 'Test' };
      vi.mocked(cacheGet).mockResolvedValueOnce(null);
      vi.mocked(cacheSet).mockRejectedValueOnce(new Error('Redis down'));

      const fetchFn = vi.fn().mockResolvedValue(mockData);
      const result = await getCached('test:key', TTL_MEDIUM, fetchFn);

      expect(result).toEqual(mockData);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      // Should still return data even if cache write fails
    });

    it('does not cache undefined values', async () => {
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const fetchFn = vi.fn().mockResolvedValue(undefined);
      const result = await getCached('test:key', TTL_MEDIUM, fetchFn);

      expect(result).toBeUndefined();
      expect(cacheSet).toHaveBeenCalledWith('test:key', '__NULL__', 5);
    });
  });

  describe('invalidateCache', () => {
    it('does nothing when no keys provided', async () => {
      await invalidateCache();
      expect(cacheDel).not.toHaveBeenCalled();
    });

    it('deletes single key', async () => {
      await invalidateCache('test:key');

      expect(cacheDel).toHaveBeenCalledWith('test:key');
    });

    it('deletes multiple keys in parallel', async () => {
      await invalidateCache('key1', 'key2', 'key3');

      expect(cacheDel).toHaveBeenCalledTimes(3);
      expect(cacheDel).toHaveBeenCalledWith('key1');
      expect(cacheDel).toHaveBeenCalledWith('key2');
      expect(cacheDel).toHaveBeenCalledWith('key3');
    });
  });

  describe('invalidatePattern', () => {
    it('deletes keys matching pattern', async () => {
      await invalidatePattern('cache:meetings:*');

      expect(cacheDelPattern).toHaveBeenCalledWith('cache:meetings:*');
    });

    it('handles pattern deletion errors', async () => {
      vi.mocked(cacheDelPattern).mockRejectedValueOnce(new Error('Redis down'));

      // Should not throw, just log warning
      await expect(invalidatePattern('cache:meetings:*')).resolves.not.toThrow();
    });
  });

  ;

  describe('buildListKey', () => {
    it('builds simple key with no params', () => {
      expect(buildListKey('meetings', {})).toBe('cache:meetings:');
    });

    it('builds key with single param', () => {
      expect(buildListKey('meetings', { status: 'active' })).toBe('cache:meetings:status=active');
    });

    it('builds key with multiple params (sorted)', () => {
      const result = buildListKey('meetings', { z: 'last', a: 'first', m: 'middle' });
      expect(result).toBe('cache:meetings:a=first&m=middle&z=last');
    });

    it('filters out undefined params', () => {
      const result = buildListKey('meetings', { a: '1', b: undefined, c: '3' });
      expect(result).toBe('cache:meetings:a=1&c=3');
    });

    it('filters out empty string params', () => {
      const result = buildListKey('meetings', { a: '1', b: '', c: '3' });
      expect(result).toBe('cache:meetings:a=1&c=3');
    });

    it('handles numbers in params', () => {
      expect(buildListKey('meetings', { page: 1, limit: 20 })).toBe('cache:meetings:limit=20&page=1');
    });

    it('handles boolean in params', () => {
      expect(buildListKey('meetings', { active: true })).toBe('cache:meetings:active=true');
    });
  });

  describe('TTL constants', () => {
    it('exports defined TTL constants', () => {
      expect(TTL_SHORT).toBe(60);
      expect(TTL_MEDIUM).toBe(180);
      expect(TTL_LONG).toBe(300);
    });
  });
});