import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';

// ===== Hoisted mock variables (available when vi.mock factories run) =====
const { mockQuery, mockQueryOne, mockPoolQuery, mockPoolEnd, mockUser } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockQueryOne: vi.fn(),
  mockPoolQuery: vi.fn(),
  mockPoolEnd: vi.fn(),
  mockUser: { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'user' },
}));

// ===== Mocks =====

vi.mock('../../services/database.js', () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
}));

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.query = mockPoolQuery;
      this.connect = vi.fn();
      this.end = mockPoolEnd;
    }),
  },
}));

vi.mock('../../config.js', () => ({
  config: {
    database: { url: 'postgresql://localhost:5432/testdb', ssl: false },
    jwt: { secret: 'test-secret-key-for-testing', expiresIn: '7d' },
    nodeEnv: 'test',
  },
}));

vi.mock('os', () => ({ cpus: () => [{}] }));
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

vi.mock('../../services/cache.js', () => ({
  getCached: vi.fn(
    async (_key: string, _ttl: number, fetchFn: () => Promise<unknown>) => fetchFn(),
  ),
  invalidatePattern: vi.fn().mockResolvedValue(undefined),
  TTL_SHORT: 30,
  TTL_MEDIUM: 60,
  TTL_LONG: 120,
}));

vi.mock('../../middleware/authenticate.js', () => ({
  authenticate: vi.fn((req: any, _res: any, next: any) => {
    req.user = mockUser;
    next();
  }),
  optionalAuth: vi.fn((req: any, _res: any, next: any) => {
    req.user = mockUser;
    next();
  }),
}));

vi.mock('../../services/meetingService.js', () => ({
  verifyMeetingAccess: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/livekit.js', () => ({
  createRoom: vi.fn().mockResolvedValue({}),
  listRooms: vi.fn().mockResolvedValue([]),
  getRoomInfo: vi.fn().mockResolvedValue(null),
  deleteRoom: vi.fn().mockResolvedValue(undefined),
  listParticipants: vi.fn().mockResolvedValue([]),
  removeParticipant: vi.fn().mockResolvedValue(undefined),
  participantCanModerate: vi.fn().mockResolvedValue(true),
  webhookReceiver: { receive: vi.fn() },
}));

vi.mock('../../utils/validation.js', () => ({
  sanitizeRoomName: vi.fn((name: string) => name),
  sanitizeDescription: vi.fn((desc: string) => desc),
  sanitizeChatMessage: vi.fn((msg: string) => msg),
}));

vi.mock('../../schemas/meetings.js', () => ({
  scheduleMeetingSchema: { parse: vi.fn() },
  diagnosticsPayloadSchema: { parse: vi.fn() },
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
  webhookLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Import routes after mocks are set up
import { meetingsRouter } from '../../routes/meetings.js';
import { roomsRouter } from '../../routes/rooms.js';

describe('Database Performance — Slow Query Prevention', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/meetings', meetingsRouter);
    app.use('/rooms', roomsRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Meeting history pagination', () => {
    it('should use LIMIT and OFFSET in the SQL query', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await request(app).get('/meetings?limit=10&offset=20');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/LIMIT/i);
      expect(sql).toMatch(/OFFSET/i);
      expect(params).toEqual(['user-123', 10, 20]);
    });

    it('should cap limit at 100 when an excessive value is provided', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await request(app).get('/meetings?limit=99999');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain(100);
      expect(params).not.toContain(99999);
    });

    it('should clamp negative offset to 0', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await request(app).get('/meetings?offset=-5');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain(0);
      expect(params).not.toContain(-5);
    });
  });

  describe('Rooms parameterized queries', () => {
    it('should use $1 parameterized placeholder, not string interpolation', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'room-1',
          name: 'test-room',
          host_id: 'user-123',
          title: 'Test',
          description: null,
          max_participants: 50,
          status: 'active',
          created_at: new Date(),
        },
      ]);

      await request(app).get('/rooms?search=test');

      // At least one query call must use a parameterized placeholder ($1)
      const sqlCalls = mockQuery.mock.calls.map((c) => c[0] as string);
      const hasParameterized = sqlCalls.some((sql) => sql.includes('$1'));
      expect(hasParameterized).toBe(true);

      // At least one call must include a params array with values
      const callsWithParams = mockQuery.mock.calls.filter(
        (c) => Array.isArray(c[1]) && (c[1] as unknown[]).length > 0,
      );
      expect(callsWithParams.length).toBeGreaterThan(0);

      // Verify the SQL does NOT contain raw string interpolation of the search term
      const allSql = sqlCalls.join(' ');
      expect(allSql).not.toMatch(/WHERE.*test/);
    });
  });

  describe('Database retry on transient error', () => {
    it('should retry and succeed after ECONNRESET', async () => {
      const transientError = new Error('Connection reset');
      (transientError as any).code = 'ECONNRESET';

      mockPoolQuery
        .mockReset()
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      // Use vi.importActual to get the REAL query function (not the mock)
      const actualDb = await vi.importActual<typeof import('../../services/database.js')>(
        '../../services/database.js',
      );

      const result = await actualDb.query('SELECT 1');

      expect(mockPoolQuery).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ id: 1 }]);
    });
  });
});
