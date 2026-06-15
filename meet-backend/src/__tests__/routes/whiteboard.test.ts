import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockGetRoomByName = vi.fn();
const mockParticipantCanModerate = vi.fn();

vi.mock('../../services/database.js', () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
}));

vi.mock('../../services/roomService.js', () => ({
  getRoomByName: mockGetRoomByName,
}));

vi.mock('../../services/livekit.js', () => ({
  participantCanModerate: mockParticipantCanModerate,
}));

const mockUser = { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'user' };
vi.mock('../../middleware/authenticate.js', () => ({
  authenticate: vi.fn((req: any, _res: any, next: any) => {
    req.user = mockUser;
    next();
  }),
}));

let app: express.Application;
let whiteboardRouter: express.Router;

describe('Whiteboard Router', () => {
  beforeAll(async () => {
    const module = await import('../../routes/whiteboard.js');
    whiteboardRouter = module.whiteboardRouter;

    app = express();
    app.use(express.json());
    app.use('/whiteboard', whiteboardRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default locked state when no whiteboard exists', async () => {
    mockGetRoomByName.mockResolvedValue({ id: 'room-1', name: 'test-room', host_id: 'user-123' });
    mockQueryOne.mockResolvedValueOnce(null);

    const response = await request(app).get('/whiteboard/test-room');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ scene: [], files: {}, locked: true, updated_at: null });
  });

  it('rejects participant edits when whiteboard is locked', async () => {
    mockGetRoomByName.mockResolvedValue({ id: 'room-1', name: 'test-room', host_id: 'host-1' });
    mockParticipantCanModerate.mockResolvedValue(false);
    mockQueryOne
      .mockResolvedValueOnce({ id: 'participant-1' })
      .mockResolvedValueOnce({ locked: true });

    const response = await request(app)
      .put('/whiteboard/test-room')
      .send({ scene: [] });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Whiteboard is locked. Only room moderators can edit it.');
  });

  it('allows participant edits when whiteboard is unlocked', async () => {
    mockGetRoomByName.mockResolvedValue({ id: 'room-1', name: 'test-room', host_id: 'host-1' });
    mockParticipantCanModerate.mockResolvedValue(false);
    mockQueryOne
      .mockResolvedValueOnce({ id: 'participant-1' })
      .mockResolvedValueOnce({ locked: false });
    mockQuery.mockResolvedValueOnce([]);

    const response = await request(app)
      .put('/whiteboard/test-room')
      .send({ scene: [] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
