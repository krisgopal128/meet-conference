import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock dependencies before importing
const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../services/database.js', () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
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

let app: express.Application;

describe('Meetings Router', () => {
  beforeAll(async () => {
    const module = await import('../../routes/meetings.js');
    const meetingsRouter = module.meetingsRouter;
    
    app = express();
    app.use(express.json());
    app.use('/meetings', meetingsRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /meetings', () => {
    it('should return meetings for current user', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'meeting-1',
          room_id: 'room-1',
          room_name: 'test-room',
          room_title: 'Test Room',
          started_at: new Date(),
          ended_at: null,
          participant_count: 5,
          max_participants: 50,
        },
      ]);

      const response = await request(app).get('/meetings');

      expect(response.status).toBe(200);
      expect(response.body.meetings).toHaveLength(1);
    });

    it('should support pagination params', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const response = await request(app).get('/meetings?limit=10&offset=20');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /meetings/history', () => {
    it('should return meeting history with participant counts', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'meeting-1',
          room_id: 'room-1',
          room_name: 'test-room',
          room_title: 'Test Room',
          started_at: new Date(),
          ended_at: new Date(),
          participant_count: 3,
          max_participants: 50,
          uniqueParticipants: 5,
        },
      ]);

      const response = await request(app).get('/meetings/history');

      expect(response.status).toBe(200);
      expect(response.body.meetings[0].uniqueParticipants).toBe(5);
    });
  });

  describe('POST /meetings/diagnostics', () => {
    it('should accept valid diagnostics payload', async () => {
      const response = await request(app)
        .post('/meetings/diagnostics')
        .send({
          selectedQualityMode: 'balanced',
          effectiveQualityMode: 'balanced',
          screenShareMode: 'off',
          autoFallbackActive: false,
          qualityOverrideReason: null,
          connectionQualityLabel: 'excellent',
          packetLossPercent: 0.5,
          rttMs: 50,
          jitterMs: 10,
          availableBitrateKbps: 2000,
          renderFps: 30,
          diagnosticsLog: [],
          capturedAt: new Date().toISOString(),
        });

      expect(response.status).toBe(202);
      expect(response.body.message).toBe('Diagnostics accepted');
    });

    it('should validate diagnostics schema', async () => {
      const response = await request(app)
        .post('/meetings/diagnostics')
        .send({
          selectedQualityMode: 'balanced',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /meetings/scheduled', () => {
    it('should return upcoming scheduled meetings', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'scheduled-1',
          room_name: 'upcoming-meeting',
          title: 'Upcoming Meeting',
          host_name: 'Test User',
          host_email: 'test@example.com',
          scheduled_start: new Date(Date.now() + 86400000),
        },
      ]);

      const response = await request(app).get('/meetings/scheduled');

      expect(response.status).toBe(200);
      expect(response.body.meetings).toHaveLength(1);
    });
  });

  describe('POST /meetings/schedule', () => {
    it('should create a scheduled meeting', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'scheduled-1',
        room_name: 'test-meeting-abc123',
        title: 'Test Meeting',
        host_id: 'user-123',
        scheduled_start: new Date(Date.now() + 86400000),
      }]);
      mockQuery.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/meetings/schedule')
        .send({
          title: 'Test Meeting',
          scheduledStart: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.meeting).toBeDefined();
    });

    it('should validate title is required', async () => {
      const response = await request(app)
        .post('/meetings/schedule')
        .send({
          scheduledStart: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it('should validate email format for participants', async () => {
      const response = await request(app)
        .post('/meetings/schedule')
        .send({
          title: 'Test Meeting',
          scheduledStart: new Date(Date.now() + 86400000).toISOString(),
          participantEmails: ['invalid-email'],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /meetings/:id', () => {
    it('should return meeting with participants', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'meeting-123',
        room_id: 'room-123',
      });
      mockQueryOne.mockResolvedValueOnce({
        id: 'meeting-123',
        room_id: 'room-123',
        room_name: 'test-room',
        room_title: 'Test Room',
        room_description: null,
        started_at: new Date(),
        ended_at: null,
      });
      mockQuery.mockResolvedValueOnce([
        {
          id: 'participant-1',
          user_id: 'user-123',
          user_name: 'Test User',
          user_email: 'test@example.com',
          joined_at: new Date(),
        },
      ]);

      const response = await request(app).get('/meetings/meeting-123');

      expect(response.status).toBe(200);
      expect(response.body.meeting).toBeDefined();
      expect(response.body.participants).toHaveLength(1);
    });

    it('should return 404 for non-existent meeting', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const response = await request(app).get('/meetings/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /meetings/scheduled/:id', () => {
    it('should cancel meeting if user is host', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'scheduled-123',
        host_id: 'user-123',
        room_name: 'test-room',
      });
      mockQuery.mockResolvedValueOnce([]);
      mockQuery.mockResolvedValueOnce([]);

      const response = await request(app).delete('/meetings/scheduled/scheduled-123');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Meeting cancelled');
    });

    it('should reject if user is not host', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'scheduled-123',
        host_id: 'other-user',
        room_name: 'test-room',
      });

      const response = await request(app).delete('/meetings/scheduled/scheduled-123');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /meetings/:id/chat', () => {
    it('should return chat messages for meeting participant', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'meeting-123',
        room_id: 'room-123',
      });
      mockQuery.mockResolvedValueOnce([
        {
          id: 'msg-1',
          content: 'Hello!',
          created_at: new Date(),
          message_type: 'text',
          user_id: 'user-123',
          user_name: 'Test User',
          user_email: 'test@example.com',
        },
      ]);

      const response = await request(app).get('/meetings/meeting-123/chat');

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(1);
    });

    it('should return 404 if user has no access', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const response = await request(app).get('/meetings/meeting-123/chat');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /meetings/:id/chat', () => {
    it('should send a chat message', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 'meeting-123' });
      mockQuery.mockResolvedValueOnce([{
        id: 'msg-1',
        content: 'Hello everyone!',
        created_at: new Date(),
        message_type: 'text',
      }]);

      const response = await request(app)
        .post('/meetings/meeting-123/chat')
        .send({ content: 'Hello everyone!' });

      expect(response.status).toBe(201);
      expect(response.body.message.content).toBe('Hello everyone!');
    });

    it('should reject empty message', async () => {
      const response = await request(app)
        .post('/meetings/meeting-123/chat')
        .send({ content: '' });

      expect(response.status).toBe(400);
    });

    it('should reject message over 5000 characters', async () => {
      const response = await request(app)
        .post('/meetings/meeting-123/chat')
        .send({ content: 'x'.repeat(5001) });

      expect(response.status).toBe(400);
    });
  });
});
