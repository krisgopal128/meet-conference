import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockQuery = vi.fn();

vi.mock('../../services/database.js', () => ({
  query: mockQuery,
}));

vi.mock('../../middleware/requireRole.js', () => ({
  requireAdmin: () => (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
}));

let app: express.Application;
let auditLogsRouter: express.Router;

describe('Audit Logs Router', () => {
  beforeAll(async () => {
    const module = await import('../../routes/prashasakah/auditLogs.js');
    auditLogsRouter = module.default;

    app = express();
    app.use(express.json());
    app.use('/prashasakah', auditLogsRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps audit log rows to frontend shape', async () => {
    mockQuery
      .mockResolvedValueOnce([{ count: '1' }])
      .mockResolvedValueOnce([
        {
          id: 'log-1',
          admin_id: 'admin-1',
          actor_email: 'admin@example.com',
          action_type: 'user_ban',
          target_type: 'user',
          target_id: 'user-1',
          details: { reason: 'spam' },
          ip_address: '127.0.0.1',
          created_at: '2026-06-12T00:00:00.000Z',
        },
      ]);

    const response = await request(app).get('/prashasakah/audit-logs?action=user_ban');

    expect(response.status).toBe(200);
    expect(response.body.logs).toEqual([
      {
        id: 'log-1',
        action: 'user_ban',
        targetType: 'user',
        targetId: 'user-1',
        actorId: 'admin-1',
        actorEmail: 'admin@example.com',
        details: { reason: 'spam' },
        ipAddress: '127.0.0.1',
        createdAt: '2026-06-12T00:00:00.000Z',
      },
    ]);
  });
});
