import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authRouter } from '../../routes/auth.js';

// Mock dependencies
vi.mock('../../services/database.js', () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
}));

vi.mock('../../services/redis.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
  cacheTTL: vi.fn().mockResolvedValue(0),
  blacklistToken: vi.fn().mockResolvedValue(undefined),
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

const mockQueryOne = queryOne as ReturnType<typeof vi.fn>;
const mockQuery = query as ReturnType<typeof vi.fn>;

describe('Auth Routes', () => {
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

  describe('POST /auth/register', () => {
    describe('with valid input', () => {
      it('should register a new user successfully', async () => {
        mockQueryOne.mockResolvedValueOnce(null); // No existing user
        mockQuery.mockResolvedValueOnce([
          { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        ]);

        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User',
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe('test@example.com');
        expect(response.body.user.name).toBe('Test User');
      });

      it('should hash the password before storing', async () => {
        mockQueryOne.mockResolvedValueOnce(null);
        mockQuery.mockResolvedValueOnce([
          { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        ]);

        await request(app)
          .post('/auth/register')
          .send({
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User',
          });

        // Verify that the password was hashed (not stored in plain text)
        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO users'),
          expect.arrayContaining([expect.any(String), expect.any(String), 'Test User'])
        );
      });

      it('should normalize email to lowercase', async () => {
        mockQueryOne.mockResolvedValueOnce(null);
        mockQuery.mockResolvedValueOnce([
          { id: 'user-123', email: 'test@example.com', name: null },
        ]);

        await request(app)
          .post('/auth/register')
          .send({
            email: 'TEST@EXAMPLE.COM',
            password: 'password123',
          });

        expect(mockQueryOne).toHaveBeenCalledWith(
          expect.any(String),
          ['test@example.com']
        );
      });

      it('should allow registration without name', async () => {
        mockQueryOne.mockResolvedValueOnce(null);
        mockQuery.mockResolvedValueOnce([
          { id: 'user-123', email: 'test@example.com', name: null },
        ]);

        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'test@example.com',
            password: 'password123',
          });

        expect(response.status).toBe(201);
        expect(response.body.user.name).toBeNull();
      });
    });

    describe('with invalid email', () => {
      it('should return 400 for invalid email format', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'invalid-email',
            password: 'password123',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
        expect(response.body).toHaveProperty('details');
      });

      it('should return 400 for empty email', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email: '',
            password: 'password123',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });

      it('should return 400 for missing email', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            password: 'password123',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });
    });

    describe('with missing/invalid password', () => {
      it('should return 400 for missing password', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'test@example.com',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });

      it('should return 400 for password less than 8 characters', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'test@example.com',
            password: 'short',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });

      it('should return 400 for empty password', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'test@example.com',
            password: '',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });
    });

    describe('with existing user', () => {
      it('should return 409 if email already registered', async () => {
        mockQueryOne.mockResolvedValueOnce({ id: 'existing-user-id' });

        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'existing@example.com',
            password: 'password123',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Unable to complete registration');
      });
    });
  });

  describe('POST /auth/login', () => {
    describe('with valid credentials', () => {
      it('should login successfully with correct credentials', async () => {
        const passwordHash = await bcrypt.hash('password123', 12);
        mockQueryOne.mockResolvedValueOnce({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          password_hash: passwordHash,
        });

        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe('test@example.com');
      });

      it('should return a valid JWT token', async () => {
        const passwordHash = await bcrypt.hash('password123', 12);
        mockQueryOne.mockResolvedValueOnce({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          password_hash: passwordHash,
        });

        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123',
          });

        const decoded = jwt.verify(response.body.token, 'test-secret-key-for-testing');
        expect(decoded).toHaveProperty('userId', 'user-123');
      });

      it('should normalize email to lowercase for login', async () => {
        const passwordHash = await bcrypt.hash('password123', 12);
        mockQueryOne.mockResolvedValueOnce({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          password_hash: passwordHash,
        });

        await request(app)
          .post('/auth/login')
          .send({
            email: 'TEST@EXAMPLE.COM',
            password: 'password123',
          });

        expect(mockQueryOne).toHaveBeenCalledWith(
          expect.any(String),
          ['test@example.com']
        );
      });
    });

    describe('with invalid credentials', () => {
      it('should return 401 for non-existent user', async () => {
        mockQueryOne.mockResolvedValueOnce(null);

        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123',
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Invalid credentials');
      });

      it('should return 401 for wrong password', async () => {
        const passwordHash = await bcrypt.hash('correctpassword', 12);
        mockQueryOne.mockResolvedValueOnce({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          password_hash: passwordHash,
        });

        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword',
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Invalid credentials');
      });

      it('should return 400 for invalid email format', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'invalid-email',
            password: 'password123',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });

      it('should return 400 for missing password', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'test@example.com',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });

      it('should return 400 for missing email', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            password: 'password123',
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation error');
      });
    });
  });
});
