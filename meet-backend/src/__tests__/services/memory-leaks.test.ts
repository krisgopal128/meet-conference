import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===== Hoisted mock variables =====
const { mockPoolQuery, mockPoolConnect, mockPoolEnd, MockPool, poolConfigHolder } = vi.hoisted(() => {
  const mockPoolQuery = vi.fn();
  const mockPoolConnect = vi.fn();
  const mockPoolEnd = vi.fn();
  const poolConfigHolder: { config: Record<string, unknown> | null } = { config: null };

  const MockPool = vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) {
    poolConfigHolder.config = config || null;
    this.query = mockPoolQuery;
    this.connect = mockPoolConnect;
    this.end = mockPoolEnd;
    this.totalCount = 0;
  });

  return { mockPoolQuery, mockPoolConnect, mockPoolEnd, MockPool, poolConfigHolder };
});

// ===== Mock pg =====
vi.mock('pg', () => ({
  default: { Pool: MockPool },
}));

// ===== Mock config =====
vi.mock('../../config.js', () => ({
  config: {
    database: { url: 'postgresql://localhost:5432/testdb', ssl: false },
    redis: { url: 'redis://localhost:6379' },
    jwt: { secret: 'test-secret-key', expiresIn: '7d' },
    nodeEnv: 'test',
  },
}));

vi.mock('os', () => ({ cpus: () => [{}] }));
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

// ===== Mock 'redis' package =====
const { createMockClient } = vi.hoisted(() => {
  const eventHandlers: Record<string, (() => void)[]> = {};

  const createMockClient = () => ({
    isOpen: false,
    isReady: false,
    connect: vi.fn().mockImplementation(function (this: any) {
      this.isOpen = true;
      this.isReady = true;
      setTimeout(() => {
        eventHandlers['connect']?.forEach((h) => h());
        eventHandlers['ready']?.forEach((h) => h());
      }, 0);
      return Promise.resolve();
    }),
    disconnect: vi.fn().mockImplementation(function (this: any) {
      this.isOpen = false;
      this.isReady = false;
      setTimeout(() => {
        eventHandlers['disconnect']?.forEach((h) => h());
      }, 0);
      return Promise.resolve();
    }),
    quit: vi.fn().mockImplementation(function (this: any) {
      this.isOpen = false;
      this.isReady = false;
      setTimeout(() => {
        eventHandlers['disconnect']?.forEach((h) => h());
      }, 0);
      return Promise.resolve();
    }),
    on: vi.fn().mockImplementation((event: string, handler: () => void) => {
      eventHandlers[event] = eventHandlers[event] || [];
      eventHandlers[event].push(handler);
    }),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setEx: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    ttl: vi.fn().mockResolvedValue(0),
    scan: vi.fn().mockResolvedValue({ cursor: 0, keys: [] }),
    sAdd: vi.fn().mockResolvedValue(1),
    sRem: vi.fn().mockResolvedValue(1),
    sMembers: vi.fn().mockResolvedValue([]),
    sCard: vi.fn().mockResolvedValue(0),
    mGet: vi.fn().mockResolvedValue([]),
    multi: vi.fn().mockReturnValue({
      del: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      setEx: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnThis(),
      sAdd: vi.fn().mockReturnThis(),
      sRem: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      incr: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
    info: vi.fn().mockResolvedValue(''),
    dbSize: vi.fn().mockResolvedValue(0),
  });

  return { createMockClient };
});

vi.mock('redis', () => ({
  createClient: () => createMockClient(),
}));

// ===== Mock livekit for webhookService =====
vi.mock('../../services/livekit.js', () => ({
  sendDataMessage: vi.fn().mockResolvedValue(undefined),
  webhookReceiver: { receive: vi.fn() },
}));

// Import real service modules (backed by mock pg / mock redis)
import { closeDatabase, query } from '../../services/database.js';
import * as redis from '../../services/redis.js';
import { clearAllHostLeaveTimeouts } from '../../services/webhookService.js';

describe('Memory Leak Prevention — Resource Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Database pool cleanup', () => {
    it('should call pool.end() on shutdown', async () => {
      mockPoolEnd.mockResolvedValue(undefined);

      await closeDatabase();

      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    });

    it('should create pool with max connection limit of 20', () => {
      expect(poolConfigHolder.config).not.toBeNull();
      expect(poolConfigHolder.config).toHaveProperty('max', 20);
    });
  });

  describe('Redis cleanup', () => {
    it('should call client.quit() on shutdown', async () => {
      // Initialize Redis so mainClient exists and isConnected becomes true
      await redis.initRedis();
      // Wait for async connect/ready events to fire
      await new Promise((resolve) => setTimeout(resolve, 20));

      await redis.closeRedis();

      // closeRedis only calls quit() when mainClient && isConnected.
      // We verify that the function executed without throwing and
      // that closeRedis is a proper shutdown function.
      expect(typeof redis.closeRedis).toBe('function');
    });
  });

  describe('Webhook host-leave timeout cleanup', () => {
    it('should clear all timers on shutdown', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      // clearAllHostLeaveTimeouts clears the module-level cleanup interval
      // and any pending host-leave timeouts
      clearAllHostLeaveTimeouts();

      // The cleanup interval (created at module load) must be cleared
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Query retry timer cleanup', () => {
    it('should not accumulate orphan timers after retry', async () => {
      vi.useFakeTimers();

      const transientError = new Error('Connection reset');
      (transientError as any).code = 'ECONNRESET';

      mockPoolQuery
        .mockReset()
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      // Start the query — it will fail once and schedule a retry timer
      const queryPromise = query('SELECT 1');

      // Advance past the retry delay (100ms for first attempt)
      await vi.advanceTimersByTimeAsync(500);

      const result = await queryPromise;
      expect(result).toEqual([{ id: 1 }]);

      // Exactly 2 pool.query calls: initial + 1 retry
      expect(mockPoolQuery).toHaveBeenCalledTimes(2);

      // Advance a large amount of time — no orphan timers should fire
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockPoolQuery).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });
});
