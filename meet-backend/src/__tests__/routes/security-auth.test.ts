import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authRouter } from '../../routes/auth.js';

vi.mock('../../services/database.js', () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
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
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  authLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../config.js', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key-for-testing',
      expiresIn: '7d',
    },
    nodeEnv: 'test',
  },
}));

import { queryOne, query } from '../../services/database.js';
import { cacheGet } from '../../services/redis.js';

const mockQueryOne = queryOne as ReturnType<typeof vi.fn>;
const mockQuery = query as ReturnType<typeof vi.fn>;
const mockCacheGet = cacheGet as ReturnType<typeof vi.fn>;

const TEST_SECRET = 'test-secret-key-for-testing';

describe('Security: Weak Authentication Systems', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should reject passwords shorter than 8 characters via Zod schema', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: '123',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Validation error');
  });

  it('should block SQL injection attempts in the register email field', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: "test@example.com'; DROP TABLE users;--",
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body).not.toHaveProperty('user');
  });

  it('should block SQL injection attempts in the login email field', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: "admin@meet.com' OR '1'='1",
        password: 'password123',
      });

    expect(response.status).not.toBe(200);
    expect([400, 401]).toContain(response.status);
  });

  it('should sign JWT tokens with the configured secret', async () => {
    const passwordHash = await bcrypt.hash('password123', 12);
    mockQueryOne.mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      password_hash: passwordHash,
      role: 'user',
      is_banned: false,
    });
    mockQuery.mockResolvedValue(undefined);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    const token = response.body.token;
    expect(token).toBeDefined();

    const decoded = jwt.verify(token, TEST_SECRET) as { userId: string };
    expect(decoded.userId).toBe('user-123');

    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  it('should not leak password_hash in the login response body', async () => {
    const passwordHash = await bcrypt.hash('password123', 12);
    mockQueryOne.mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      password_hash: passwordHash,
      role: 'user',
      is_banned: false,
    });
    mockQuery.mockResolvedValue(undefined);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
  });

  it('should not leak password_hash in the register response body', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    mockQuery.mockResolvedValueOnce([
      { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'user' },
    ]);

    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

    expect(response.status).toBe(201);
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
  });

  it('should lock an account after 5 failed login attempts', async () => {
    mockCacheGet.mockResolvedValueOnce(5);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'correctpassword',
      });

    expect(response.status).toBe(429);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.toLowerCase()).toContain('lock');
  });

  it('should reject expired JWT tokens', async () => {
    const expiredToken = jwt.sign(
      { userId: 'user-123', type: 'access', exp: Math.floor(Date.now() / 1000) - 10 },
      TEST_SECRET,
    );

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it('should reject malformed JWT tokens', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token');

    expect(response.status).toBe(401);
  });

  it('should reject a refresh token used as an access token', async () => {
    const refreshToken = jwt.sign(
      { userId: 'user-123', type: 'refresh' },
      TEST_SECRET,
      { expiresIn: '7d' },
    );

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshToken}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Invalid token');
  });
});
