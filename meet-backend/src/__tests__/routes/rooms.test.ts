import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock ALL dependencies before importing the router
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../services/database.js', () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
}));

vi.mock('../../services/livekit.js', () => ({
  createRoom: vi.fn().mockResolvedValue({}),
  listRooms: vi.fn().mockResolvedValue([]),
  getRoomInfo: vi.fn().mockResolvedValue([]),
  deleteRoom: vi.fn().mockResolvedValue(undefined),
  listParticipants: vi.fn().mockResolvedValue([]),
  removeParticipant: vi.fn().mockResolvedValue(undefined),
  admitFromLobby: vi.fn().mockResolvedValue(undefined),
  participantCanModerate: vi.fn().mockResolvedValue(true),
  isModeratorParticipant: vi.fn().mockReturnValue(false),
  muteAllAudioTracks: vi.fn().mockResolvedValue(undefined),
  muteVideoTrack: vi.fn().mockResolvedValue(undefined),
  disableScreenShareTrack: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/validation.js', () => ({
  sanitizeRoomName: vi.fn((name: string) => name),
  sanitizeDescription: vi.fn((desc: string) => desc),
  sanitizeChatMessage: vi.fn((msg: string) => msg),
}));

const mockUser = { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'user' };
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

// Import router AFTER mocks are set up
let app: express.Application;
let roomsRouter: express.Router;

describe('Rooms Router', () => {
  beforeAll(async () => {
    // Dynamic import after mocks
    const module = await import('../../routes/rooms.js');
    roomsRouter = module.roomsRouter;
    
    app = express();
    app.use(express.json());
    app.use('/rooms', roomsRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /rooms - Create Room', () => {
    it('should create a room with valid data', async () => {
      mockQueryOne.mockResolvedValueOnce(null); // No existing room
      mockQuery.mockResolvedValueOnce([{
        id: 'room-123',
        name: 'test-room',
        title: 'Test Room',
        description: 'A test room',
        host_id: 'user-123',
        max_participants: 50,
        status: 'waiting',
        created_at: new Date(),
      }]);

      const response = await request(app)
        .post('/rooms')
        .send({
          name: 'test-room',
          title: 'Test Room',
          description: 'A test room',
          maxParticipants: 50,
        });

      expect(response.status).toBe(201);
      expect(response.body.room).toBeDefined();
      expect(response.body.room.name).toBe('test-room');
    });

    it('should reject duplicate room names', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 'existing-room' });

      const response = await request(app)
        .post('/rooms')
        .send({
          name: 'existing-room',
          title: 'Duplicate Room',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Room name already exists');
    });

    it('should validate room name length (too short)', async () => {
      const response = await request(app)
        .post('/rooms')
        .send({
          name: 'ab',
          title: 'Short Name',
        });

      expect(response.status).toBe(400);
    });

    it('should validate max participants range', async () => {
      const response = await request(app)
        .post('/rooms')
        .send({
          name: 'test-room',
          maxParticipants: 1,
        });

      expect(response.status).toBe(400);
    });

    it('should accept optional faceCrop settings', async () => {
      mockQueryOne.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce([{
        id: 'room-123',
        name: 'test-room',
        title: null,
        description: null,
        host_id: 'user-123',
        max_participants: 50,
        status: 'waiting',
        created_at: new Date(),
      }]);

      const response = await request(app)
        .post('/rooms')
        .send({
          name: 'test-room',
          settings: {
            faceCrop: {
              enabled: true,
              aspectRatio: '16:9',
              model: 'tiny',
            },
          },
        });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /rooms - List Rooms', () => {
    it('should list user rooms by default', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'room-1',
          name: 'room-1',
          title: 'Room 1',
          description: null,
          host_id: 'user-123',
          host_name: 'Test User',
          host_email: 'test@example.com',
          max_participants: 50,
          status: 'active',
          created_at: new Date(),
        },
      ]);

      const response = await request(app).get('/rooms');

      expect(response.status).toBe(200);
      expect(response.body.rooms).toHaveLength(1);
    });

    it('should list all rooms with ?all=true', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'room-1', name: 'room-1', host_id: 'user-123' },
        { id: 'room-2', name: 'room-2', host_id: 'other-user' },
      ]);

      const response = await request(app).get('/rooms?all=true');

      expect(response.status).toBe(200);
      expect(response.body.rooms).toHaveLength(2);
    });
  });

  describe('GET /rooms/:name - Get Room Details', () => {
    it('should return room details', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'room-123',
        name: 'test-room',
        title: 'Test Room',
        description: null,
        host_id: 'user-123',
        host_name: 'Test User',
        host_email: 'test@example.com',
        max_participants: 50,
        status: 'active',
        metadata: {},
        created_at: new Date(),
      });

      const response = await request(app).get('/rooms/test-room');

      expect(response.status).toBe(200);
      expect(response.body.room.name).toBe('test-room');
    });

    it('should return 404 for non-existent room', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const response = await request(app).get('/rooms/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Room not found');
    });
  });

  describe('PATCH /rooms/:name - Update Room', () => {
    it('should update room if user is host', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'room-123',
        host_id: 'user-123',
      });
      mockQuery.mockResolvedValueOnce([{
        id: 'room-123',
        name: 'test-room',
        title: 'Updated Title',
      }]);

      const response = await request(app)
        .patch('/rooms/test-room')
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.room.title).toBe('Updated Title');
    });

    it('should reject update if user is not host', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'room-123',
        host_id: 'other-user',
      });

      const response = await request(app)
        .patch('/rooms/test-room')
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /rooms/:name - Delete Room', () => {
    it('should delete room if user is host', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'room-123',
        host_id: 'user-123',
      });
      mockQuery.mockResolvedValueOnce([]);

      const response = await request(app).delete('/rooms/test-room');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Room deleted');
    });

    it('should reject delete if user is not host', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'room-123',
        host_id: 'other-user',
      });

      const response = await request(app).delete('/rooms/test-room');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /rooms/:name/participants', () => {
    it('should return participants list for host', async () => {
      // Room where mockUser is host
      mockQueryOne.mockResolvedValueOnce({ id: 'room-123', host_id: 'user-123' });

      const response = await request(app).get('/rooms/test-room/participants');

      expect(response.status).toBe(200);
      expect(response.body.participants).toEqual([]);
    });

    it('should return 404 for non-existent room', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const response = await request(app).get('/rooms/nonexistent/participants');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /rooms/:name/settings', () => {
    it('should return room settings', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'room-123',
        settings: { faceCrop: { enabled: true, aspectRatio: '16:9' } },
      });

      const response = await request(app).get('/rooms/test-room/settings');

      expect(response.status).toBe(200);
      expect(response.body.settings).toBeDefined();
    });

    it('should return defaults if no settings', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'room-123',
        settings: null,
      });

      const response = await request(app).get('/rooms/test-room/settings');

      expect(response.status).toBe(200);
      expect(response.body.settings.faceCrop.enabled).toBe(false);
    });
  });

  describe('POST /rooms/:name/mute/:identity', () => {
    it('should mute participant audio', async () => {
      mockQueryOne.mockResolvedValueOnce({ host_id: 'user-123' });

      const response = await request(app).post('/rooms/test-room/mute/participant-1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Participant muted');
    });
  });

  describe('POST /rooms/:name/mute-all', () => {
    it('should mute all non-moderator participants', async () => {
      mockQueryOne.mockResolvedValueOnce({ host_id: 'user-123' });

      const response = await request(app).post('/rooms/test-room/mute-all');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All participants muted');
    });
  });
});
