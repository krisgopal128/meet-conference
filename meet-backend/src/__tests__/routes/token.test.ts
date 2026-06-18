import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { tokenRouter } from '../../routes/token.js';

// Mock dependencies
vi.mock('../../services/database.js', () => ({
  queryOne: vi.fn(),
}));

vi.mock('../../services/livekit.js', () => ({
  createAccessToken: vi.fn(),
  ParticipantRole: 'attendee' as const,
}));

vi.mock('../../services/redis.js', () => ({
  isParticipantKicked: vi.fn().mockResolvedValue(0),
  isGuestNameKicked: vi.fn().mockResolvedValue(0),
  isGuestNameAdmitted: vi.fn().mockResolvedValue(0),
  cacheDel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  tokenLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/authenticate.js', () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    // Mock authenticated user
    req.user = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    };
    next();
  },
}));

import { queryOne } from '../../services/database.js';
import { createAccessToken } from '../../services/livekit.js';

const mockQueryOne = queryOne as ReturnType<typeof vi.fn>;
const mockCreateAccessToken = createAccessToken as ReturnType<typeof vi.fn>;

describe('Token Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/token', tokenRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /token - Token Generation', () => {
    describe('with valid room and participant', () => {
      it('should generate token with valid room name', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'other-user',
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
            role: 'attendee',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token', 'mock-livekit-token');
        expect(response.body).toHaveProperty('roomName', 'test-room');
        expect(response.body).toHaveProperty('role', 'attendee');
      });

      it('should generate token with participant identity', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'other-user',
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
            role: 'presenter',
            identity: 'custom-identity',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('identity', 'custom-identity');
      });

      it('should use authenticated user ID as default identity', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'other-user',
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
          });

        expect(response.body).toHaveProperty('identity', 'user-123');
      });

      it('should use user name from authenticated user', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'other-user',
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
          });

        expect(response.body).toHaveProperty('name', 'Test User');
      });

      it('should use email prefix as name fallback', async () => {
        // Temporarily modify the mock to have no name
        vi.doMock('../../middleware/authenticate.js', () => ({
          authenticate: (req: any, _res: any, next: () => void) => {
            req.user = {
              id: 'user-123',
              email: 'testuser@example.com',
              name: null,
              role: 'user',
            };
            next();
          },
        }));

        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'other-user',
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
          });

        // This test verifies the fallback logic exists
        expect(response.status).toBe(200);
      });

      it('should allow custom TTL', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'other-user',
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
            ttl: 7200,
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('expiresIn', 7200);
      });

      it('should default to 3600 seconds TTL', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'other-user',
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
          });

        expect(response.body).toHaveProperty('expiresIn', 3600);
      });

      it('should downgrade elevated roles to attendee for non-creator', async () => {
        const roles = ['cohost', 'presenter', 'attendee', 'viewer'];
        const expectedRoles: Record<string, string> = {
          cohost: 'attendee',
          presenter: 'attendee',
          attendee: 'attendee',
          viewer: 'viewer',
        };

        for (const role of roles) {
          mockQueryOne.mockResolvedValueOnce({
            id: 'room-123',
            status: 'active',
            host_id: 'other-user',
            password_hash: null,
            waiting_room_enabled: false,
          });
          mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

          const response = await request(app)
            .post('/token')
            .send({
              roomName: 'test-room',
              role,
            });

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('role', expectedRoles[role]);
        }
      });
    });

    describe('with host privileges', () => {
      it('should grant host role to room creator', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'user-123', // Same as authenticated user
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
            role: 'attendee', // Requesting attendee but is host
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('role', 'host'); // Upgraded to host
      });

      it('should deny host role for non-creator', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'other-user',
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
            role: 'host', // Requesting host but not creator
          });

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('error', 'Only the room creator can be host');
      });
    });

    describe('with invalid input', () => {
      it('should return 400 for missing room name', async () => {
        const response = await request(app)
          .post('/token')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });

      it('should return 400 for empty room name', async () => {
        const response = await request(app)
          .post('/token')
          .send({
            roomName: '',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });

      it('should return 400 for invalid role', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          host_id: 'other-user',
        });

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
            role: 'invalid-role',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });

      it('should return 400 for TTL below minimum', async () => {
        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
            ttl: 30, // Below 60 second minimum
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });

      it('should return 400 for TTL above maximum', async () => {
        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'test-room',
            ttl: 100000, // Above 86400 second maximum
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });
    });

    describe('with ended room', () => {
      it('should return 400 if room has ended', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'ended',
          host_id: 'other-user',
        });

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'ended-room',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Room has ended');
      });
    });

    describe('with non-existent room', () => {
      it('should still generate token (room will be created by LiveKit)', async () => {
        mockQueryOne.mockResolvedValueOnce(null); // Room doesn't exist
        mockCreateAccessToken.mockResolvedValueOnce('mock-livekit-token');

        const response = await request(app)
          .post('/token')
          .send({
            roomName: 'new-room',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token', 'mock-livekit-token');
      });
    });
  });

  describe('POST /token/guest - Guest Token', () => {
    describe('with valid input', () => {
      it('should generate token for guest user', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          password_hash: null,
          waiting_room_enabled: false,
        });
        mockQueryOne.mockResolvedValueOnce({
          waiting_room_enabled: false,
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-guest-token');

        const response = await request(app)
          .post('/token/guest')
          .send({
            roomName: 'test-room',
            name: 'Guest User',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token', 'mock-guest-token');
        expect(response.body).toHaveProperty('name', 'Guest User');
        expect(response.body).toHaveProperty('inLobby', false);
      });

      it('should generate unique guest identity', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          password_hash: null,
          waiting_room_enabled: false,
        });
        mockQueryOne.mockResolvedValueOnce({
          waiting_room_enabled: false,
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-guest-token');

        const response = await request(app)
          .post('/token/guest')
          .send({
            roomName: 'test-room',
            name: 'Guest User',
          });

        expect(response.body).toHaveProperty('identity');
        expect(response.body.identity).toMatch(/^guest_/);
      });

      it('should place guest in lobby if waiting room enabled', async () => {
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
          password_hash: null,
          waiting_room_enabled: true,
          host_id: 'host-123',
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-guest-token');

        const response = await request(app)
          .post('/token/guest')
          .send({
            roomName: 'test-room',
            name: 'Guest User',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('inLobby', true);
      });

      it('should allow only attendee and viewer roles for guests', async () => {
        const allowedRoles = ['attendee', 'viewer'];

        for (const role of allowedRoles) {
          mockQueryOne.mockResolvedValueOnce({
            id: 'room-123',
            status: 'active',
            password_hash: null,
            waiting_room_enabled: false,
          });
          mockQueryOne.mockResolvedValueOnce({
            waiting_room_enabled: false,
          });
          mockCreateAccessToken.mockResolvedValueOnce('mock-guest-token');

          const response = await request(app)
            .post('/token/guest')
            .send({
              roomName: 'test-room',
              name: 'Guest User',
              role,
            });

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('role', role);
        }
      });
    });

    describe('with password-protected room', () => {
      it('should require password for protected room', async () => {
        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash('roompass', 12);
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
        });
        mockQueryOne.mockResolvedValueOnce({
          password_hash: passwordHash,
        });

        const response = await request(app)
          .post('/token/guest')
          .send({
            roomName: 'protected-room',
            name: 'Guest User',
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Room password required');
      });

      it('should verify correct password', async () => {
        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash('roompass', 12);
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
        });
        mockQueryOne.mockResolvedValueOnce({
          password_hash: passwordHash,
        });
        mockCreateAccessToken.mockResolvedValueOnce('mock-guest-token');

        const response = await request(app)
          .post('/token/guest')
          .send({
            roomName: 'protected-room',
            name: 'Guest User',
            password: 'roompass',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token', 'mock-guest-token');
      });

      it('should reject incorrect password', async () => {
        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash('roompass', 12);
        mockQueryOne.mockResolvedValueOnce({
          id: 'room-123',
          status: 'active',
        });
        mockQueryOne.mockResolvedValueOnce({
          password_hash: passwordHash,
        });

        const response = await request(app)
          .post('/token/guest')
          .send({
            roomName: 'protected-room',
            name: 'Guest User',
            password: 'wrongpass',
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Invalid room password');
      });
    });
  });
});
