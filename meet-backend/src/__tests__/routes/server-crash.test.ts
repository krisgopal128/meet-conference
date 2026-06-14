import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';

// ===== Hoisted mock variables =====
const { mockQuery, mockQueryOne, mockUser, mockWebhookReceive } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockQueryOne: vi.fn(),
  mockUser: { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'user' },
  mockWebhookReceive: vi.fn(),
}));

// ===== Mocks =====

vi.mock('../../services/database.js', () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
}));

vi.mock('../../services/redis.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
  cacheDelPattern: vi.fn().mockResolvedValue(0),
  cacheExists: vi.fn().mockResolvedValue(false),
  cacheTTL: vi.fn().mockResolvedValue(0),
  cacheIncrWithExpire: vi.fn().mockResolvedValue(1),
  blacklistToken: vi.fn().mockResolvedValue(undefined),
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
  addKickedParticipant: vi.fn().mockResolvedValue(undefined),
  isParticipantKicked: vi.fn().mockResolvedValue(false),
  isGuestNameKicked: vi.fn().mockResolvedValue(false),
  removeKickedParticipant: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config.js', () => ({
  config: {
    jwt: { secret: 'test-secret-key-for-testing', expiresIn: '7d' },
    nodeEnv: 'test',
    cors: { origins: ['http://localhost:5173'] },
    livekit: { url: 'ws://localhost:7880', apiKey: 'test', apiSecret: 'test' },
  },
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
  webhookLimiter: (_req: any, _res: any, next: any) => next(),
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
  invalidateTokenAuth: vi.fn(),
  invalidateUserAuth: vi.fn(),
  invalidateAllTokenCacheForUser: vi.fn(),
}));

vi.mock('../../services/livekit.js', () => ({
  createRoom: vi.fn().mockResolvedValue({}),
  listRooms: vi.fn().mockResolvedValue([]),
  getRoomInfo: vi.fn().mockResolvedValue(null),
  deleteRoom: vi.fn().mockResolvedValue(undefined),
  listParticipants: vi.fn().mockResolvedValue([]),
  removeParticipant: vi.fn().mockResolvedValue(undefined),
  participantCanModerate: vi.fn().mockResolvedValue(true),
  webhookReceiver: { receive: mockWebhookReceive },
}));

vi.mock('../../services/webhookService.js', () => ({
  handleRoomStarted: vi.fn(),
  handleRoomFinished: vi.fn(),
  handleParticipantJoined: vi.fn(),
  handleParticipantLeft: vi.fn(),
  handleEgressStarted: vi.fn(),
  handleEgressEnded: vi.fn(),
  clearAllHostLeaveTimeouts: vi.fn(),
}));

vi.mock('../../services/lobbyService.js', () => ({
  processLobbyParticipants: vi.fn().mockResolvedValue(undefined),
}));

// Import routes after mocks
import { authRouter } from '../../routes/auth.js';
import { roomsRouter } from '../../routes/rooms.js';
import { webhookRouter } from '../../routes/webhook.js';

describe('Server Crash Resilience — Error Handling Under Load', () => {
  let app: Express;

  beforeEach(() => {
    app = express();

    // Webhook route needs raw body collection (before JSON parser)
    app.use(
      '/webhook/livekit',
      (req: any, _res: any, next: any) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          req.body = Buffer.concat(chunks);
          next();
        });
      },
      webhookRouter,
    );

    app.use(express.json({ limit: '1mb' }));
    app.use('/auth', authRouter);
    app.use('/rooms', roomsRouter);

    // Global error handler
    app.use(
      (
        err: Error & { status?: number; statusCode?: number },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        const status = err.status || err.statusCode || 500;
        res.status(status).json({ error: err.message || 'Internal server error' });
      },
    );

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Unhandled database errors', () => {
    it('should return 500, not crash, when DB throws on /auth/login', async () => {
      mockQueryOne.mockRejectedValue(new Error('DB connection failed'));

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(500);
    });

    it('should return 500, not crash, when DB throws on GET /rooms', async () => {
      mockQuery.mockRejectedValue(new Error('Connection lost'));

      const response = await request(app).get('/rooms');

      expect(response.status).toBe(500);
    });
  });

  describe('Malformed request bodies', () => {
    it('should return 400 for malformed JSON, not crash', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"broken');

      expect(response.status).toBe(400);
    });

    it('should reject request bodies larger than 1mb', async () => {
      const largeBody = '{"data":"' + 'x'.repeat(2 * 1024 * 1024) + '"}';

      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send(largeBody);

      expect(response.status).toBe(413);
    });
  });

  describe('Webhook error resilience', () => {
    it('should return 401 for invalid webhook payload, not crash', async () => {
      mockWebhookReceive.mockRejectedValueOnce(new Error('Invalid signature'));

      const response = await request(app)
        .post('/webhook/livekit')
        .set('Content-Type', 'application/json')
        .send('{"event":"room_started"}');

      expect([400, 401]).toContain(response.status);
    });
  });
});
