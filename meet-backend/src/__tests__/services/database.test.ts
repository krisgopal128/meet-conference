import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock pg module before importing database service
const mockQuery = vi.fn();
const mockConnect = vi.fn();
const mockEnd = vi.fn();

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.query = mockQuery;
      this.connect = mockConnect;
      this.end = mockEnd;
      this.totalCount = 5;
    }),
  },
}));

// Mock config
vi.mock('../../config.js', () => ({
  config: {
    database: {
      url: 'postgresql://localhost:5432/testdb',
    },
    nodeEnv: 'test',
  },
}));

// Mock os module
vi.mock('os', () => ({
  cpus: () => [{}, {}, {}, {}], // 4 CPUs
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

describe('Database Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('query function', () => {
    it('should execute query and return rows', async () => {
      const mockRows = [{ id: 1, name: 'test' }];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const { query } = await import('../../services/database.js');
      const result = await query('SELECT * FROM test');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockRows);
    });

    it('should pass parameters to query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const { query } = await import('../../services/database.js');
      await query('SELECT * FROM users WHERE id = $1', ['user-123']);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', ['user-123']);
    });

    it('should retry on transient errors (ECONNRESET)', async () => {
      const transientError = new Error('Connection reset');
      (transientError as any).code = 'ECONNRESET';

      mockQuery
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const { query } = await import('../../services/database.js');
      const result = await query('SELECT 1');

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('should throw after max retries', async () => {
      const transientError = new Error('Connection failed');
      (transientError as any).code = 'ECONNRESET';

      mockQuery.mockRejectedValue(transientError);

      const { query } = await import('../../services/database.js');
      
      await expect(query('SELECT 1')).rejects.toThrow('Connection failed');
      
      // Should have tried 3 times (default retries)
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should retry on admin shutdown (57P01)', async () => {
      const adminError = new Error('Admin shutdown');
      (adminError as any).code = '57P01';

      mockQuery
        .mockRejectedValueOnce(adminError)
        .mockResolvedValueOnce({ rows: [] });

      const { query } = await import('../../services/database.js');
      await query('SELECT 1');

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should retry on crash shutdown (57P02)', async () => {
      const crashError = new Error('Crash shutdown');
      (crashError as any).code = '57P02';

      mockQuery
        .mockRejectedValueOnce(crashError)
        .mockResolvedValueOnce({ rows: [] });

      const { query } = await import('../../services/database.js');
      await query('SELECT 1');

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-transient errors', async () => {
      const syntaxError = new Error('Syntax error');
      (syntaxError as any).code = '42601';

      mockQuery.mockRejectedValue(syntaxError);

      const { query } = await import('../../services/database.js');
      
      await expect(query('SELECT SYNTAX ERROR')).rejects.toThrow('Syntax error');
      
      // Should not retry for non-transient errors
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('queryOne function', () => {
    it('should return first row', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'first' }, { id: 2 }] });

      const { queryOne } = await import('../../services/database.js');
      const result = await queryOne('SELECT * FROM test');

      expect(result).toEqual({ id: 1, name: 'first' });
    });

    it('should return null for empty result', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const { queryOne } = await import('../../services/database.js');
      const result = await queryOne('SELECT * FROM test WHERE false');

      expect(result).toBeNull();
    });

    it('should pass parameters correctly', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const { queryOne } = await import('../../services/database.js');
      await queryOne('SELECT * FROM users WHERE id = $1', ['user-123']);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', ['user-123']);
    });
  });

  describe('initDatabase function', () => {
    it('should connect and set timeouts', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };
      mockConnect.mockResolvedValue(mockClient);

      const { initDatabase } = await import('../../services/database.js');
      await initDatabase();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SET statement_timeout = 30000');
      expect(mockClient.query).toHaveBeenCalledWith('SET lock_timeout = 5000');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw on connection failure', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      const { initDatabase } = await import('../../services/database.js');
      
      await expect(initDatabase()).rejects.toThrow('Connection refused');
    });
  });

  describe('closeDatabase function', () => {
    it('should close pool gracefully', async () => {
      mockEnd.mockResolvedValue(undefined);

      const { closeDatabase } = await import('../../services/database.js');
      await closeDatabase();

      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('Type Safety', () => {
    it('should support generic type parameter for query', async () => {
      interface User {
        id: string;
        name: string;
        email: string;
      }

      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: '1', name: 'Test', email: 'test@example.com' }] 
      });

      const { query } = await import('../../services/database.js');
      const users = await query<User>('SELECT * FROM users');

      expect(users[0].name).toBe('Test');
      expect(users[0].email).toBe('test@example.com');
    });

    it('should support generic type parameter for queryOne', async () => {
      interface Room {
        id: string;
        name: string;
      }

      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'room-1', name: 'test-room' }] 
      });

      const { queryOne } = await import('../../services/database.js');
      const room = await queryOne<Room>('SELECT * FROM rooms WHERE id = $1', ['room-1']);

      expect(room?.name).toBe('test-room');
    });
  });
});
