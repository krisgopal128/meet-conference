import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { roomsRouter } from '../../routes/rooms.js';
import { tokenRouter } from '../../routes/token.js';
import externalRouter from '../../routes/external.js';

vi.mock('../../services/database.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock('../../services/redis.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
  cacheTTL: vi.fn().mockResolvedValue(0),
  cacheIncrWithExpire: vi.fn().mockResolvedValue(1),
  cacheExists: vi.fn().mockResolvedValue(false),
  cacheDelPattern: vi.fn().mockResolvedValue(0),
  blacklistToken: vi.fn().mockResolvedValue(undefined),
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
  isParticipantKicked: vi.fn().mockResolvedValue(0),
  isGuestNameKicked: vi.fn().mockResolvedValue(0),
  isGuestNameAdmitted: vi.fn().mockResolvedValue(0),
  addKickedParticipant: vi.fn().mockResolvedValue(undefined),
  addAdmittedParticipant: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/livekit.js', () => ({
  createRoom: vi.fn().mockResolvedValue({}),
  listRooms: vi.fn().mockResolvedValue([]),
  getRoomInfo: vi.fn().mockResolvedValue(null),
  deleteRoom: vi.fn().mockResolvedValue(undefined),
  listParticipants: vi.fn().mockResolvedValue([]),
  removeParticipant: vi.fn().mockResolvedValue(undefined),
  admitFromLobby: vi.fn().mockResolvedValue(undefined),
  participantCanModerate: vi.fn().mockResolvedValue(true),
  isModeratorParticipant: vi.fn().mockReturnValue(false),
  muteAllAudioTracks: vi.fn().mockResolvedValue(undefined),
  muteVideoTrack: vi.fn().mockResolvedValue(undefined),
  disableScreenShareTrack: vi.fn().mockResolvedValue(undefined),
  createAccessToken: vi.fn().mockResolvedValue('mock-livekit-token'),
  ParticipantRole: 'attendee' as const,
}));

vi.mock('../../utils/validation.js', () => ({
  sanitizeRoomName: vi.fn((name: string) => name),
  sanitizeDescription: vi.fn((desc: string) => desc),
  sanitizeChatMessage: vi.fn((msg: string) => msg),
}));

let mockAuthUser: any = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
};

vi.mock('../../middleware/authenticate.js', () => ({
  authenticate: vi.fn((req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    req.user = mockAuthUser;
    next();
  }),
  optionalAuth: vi.fn((req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      req.user = mockAuthUser;
    }
    next();
  }),
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  tokenLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../config.js', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key-for-testing',
      expiresIn: '7d',
    },
    nodeEnv: 'test',
    livekit: {
      url: 'ws://localhost:7880',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
    },
    frontendUrl: 'http://localhost:5173',
  },
}));

vi.mock('livekit-server-sdk', () => ({
  AccessToken: vi.fn().mockImplementation(() => ({
    addGrant: vi.fn(),
    toJwt: vi.fn().mockResolvedValue('mock-livekit-jwt'),
    ttl: 3600,
  })),
  RoomServiceClient: vi.fn().mockImplementation(() => ({
    deleteRoom: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { queryOne, query } from '../../services/database.js';
import { cacheGet } from '../../services/redis.js';

const mockQueryOne = queryOne as ReturnType<typeof vi.fn>;
const mockQuery = query as ReturnType<typeof vi.fn>;
const mockCacheGet = cacheGet as ReturnType<typeof vi.fn>;

describe('Security: Missing Authorization Checks', () => {
  let roomsApp: Express;
  let tokenApp: Express;
  let externalApp: Express;

  beforeAll(() => {
    roomsApp = express();
    roomsApp.use(express.json());
    roomsApp.use('/rooms', roomsRouter);

    tokenApp = express();
    tokenApp.use(express.json());
    tokenApp.use('/token', tokenRouter);

    externalApp = express();
    externalApp.use(express.json());
    externalApp.use('/external', externalRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockQueryOne.mockReset();
    mockQuery.mockReset();
    mockCacheGet.mockReset();

    mockQueryOne.mockResolvedValue(null);
    mockQuery.mockResolvedValue([]);
    mockCacheGet.mockResolvedValue(null);

    mockAuthUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no Authorization header is provided on a protected route', async () => {
    const response = await request(roomsApp).get('/rooms');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  it('should prevent a non-host user from starting a meeting (role escalation)', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'room-1',
      name: 'test-room',
      host_id: 'different-user',
      status: 'active',
      waiting_room_enabled: false,
    });

    const response = await request(roomsApp)
      .post('/rooms/test-room/start')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(403);
  });

  it('should reject external API requests without an API key', async () => {
    const response = await request(externalApp)
      .post('/external/rooms')
      .send({ name: 'test-room' });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  it('should reject external API requests with an invalid API key', async () => {
    const response = await request(externalApp)
      .post('/external/rooms')
      .set('Authorization', 'Bearer invalid-api-key')
      .send({ name: 'test-room' });

    expect(response.status).toBe(403);
  });

  it('should reject external API requests with an expired API key', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'key-1',
      user_id: 'user-1',
      is_active: true,
      permissions: { rooms: { create: true } },
      expires_at: new Date(Date.now() - 86400000),
    });

    const response = await request(externalApp)
      .post('/external/rooms')
      .set('Authorization', 'Bearer expired-key')
      .send({ name: 'test-room' });

    expect(response.status).toBe(403);
  });

  it('should reject external API requests with a deactivated API key', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'key-1',
      user_id: 'user-1',
      is_active: false,
      permissions: { rooms: { create: true } },
      expires_at: null,
    });

    const response = await request(externalApp)
      .post('/external/rooms')
      .set('Authorization', 'Bearer deactivated-key')
      .send({ name: 'test-room' });

    expect(response.status).toBe(403);
  });

  it('should reject token generation when the API key owner does not own the room', async () => {
    mockCacheGet
      .mockResolvedValueOnce({
        id: 'key-1',
        user_id: 'my-user',
        is_active: true,
        permissions: { token: { generate: true } },
        expires_at: null,
      })
      .mockResolvedValueOnce(1);

    mockQueryOne.mockResolvedValueOnce({
      id: 'room-1',
      host_id: 'other-user',
    });

    const response = await request(externalApp)
      .post('/external/token')
      .set('Authorization', 'Bearer valid-owner-key')
      .send({
        room: 'test-room',
        identity: 'student-1',
        role: 'attendee',
      });

    expect(response.status).toBe(403);
  });

  it('should prevent a non-host from deleting a room', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'room-1',
      name: 'test-room',
      host_id: 'different-user',
      status: 'active',
    });

    const response = await request(roomsApp)
      .delete('/rooms/test-room')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(403);
  });

  it('should prevent a non-host from updating a room', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'room-1',
      name: 'test-room',
      host_id: 'different-user',
      status: 'active',
    });

    const response = await request(roomsApp)
      .patch('/rooms/test-room')
      .set('Authorization', 'Bearer valid-token')
      .send({ title: 'Hacked Title' });

    expect(response.status).toBe(403);
  });

  it('should reject host role claim on the token endpoint from a non-host user', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'room-1',
      name: 'test-room',
      host_id: 'different-user',
      status: 'active',
      waiting_room_enabled: false,
    });

    const response = await request(tokenApp)
      .post('/token')
      .set('Authorization', 'Bearer valid-token')
      .send({
        roomName: 'test-room',
        role: 'host',
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error', 'Only the room creator can be host');
  });
});
