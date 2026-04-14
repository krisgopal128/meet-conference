import pkg from 'pg';
const { Pool } = pkg;
import { config } from '../config.js';
import os from 'os';
import logger from '../utils/logger.js';

// Compute pool size based on CPU cores
function getPoolSize(): number {
  return Math.min(25, os.cpus().length * 2 + 2);
}

const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
  // Connection pool limits (optimized)
  max: getPoolSize(),
  min: 2,                                        // Keep minimum connections ready
  idleTimeoutMillis: 10000,                      // Faster cleanup of idle connections
  connectionTimeoutMillis: 5000,                 // Allow more time for connection
  // Query timeouts
  statement_timeout: 30000,                      // 30s max query time
  query_timeout: 30000,                          // 30s query timeout
  // Health checks
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

export async function initDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    logger.info('✅ Database connected');
    
    // Set default timeouts on connection
    await client.query('SET statement_timeout = 30000');
    await client.query('SET lock_timeout = 5000');
    
    client.release();
    
    // Log pool stats
    logger.info(`📊 Database pool: max=${pool.totalCount}, min=2`);
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Execute a query with automatic retry on transient errors and overall timeout
 */
export async function query<T = unknown>(
  sql: string, 
  params?: unknown[], 
  retries = 3,
  timeoutMs = 30000
): Promise<T[]> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    // Check overall timeout
    if (Date.now() - startTime >= timeoutMs) {
      throw lastError || new Error(`Query timed out after ${timeoutMs}ms`);
    }
    
     try {
       const result = await pool.query(sql, params);
       return result.rows as T[];
     } catch (error) {
        lastError = error as Error;
       
       // Treat error as possibly a Postgres error with code/errno
       const pgError = error as { code?: string; errno?: string } | null;
       
       // Retry on connection errors
       const isTransientError = 
         pgError?.code === 'ECONNRESET' ||
         pgError?.code === '57P01' ||      // Admin shutdown
         pgError?.code === '57P02' ||      // Crash shutdown
         pgError?.code === '08006' ||      // Connection failure
         pgError?.code === '08003' ||      // Connection does not exist
         pgError?.errno === 'ECONNRESET';
       
       if (isTransientError && attempt < retries - 1) {
         const delay = Math.min(100 * Math.pow(2, attempt), timeoutMs - (Date.now() - startTime));
         if (delay <= 0) break; // No time left for retry
         logger.warn(`⚠️ Database query failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`, pgError?.code);
         await new Promise(r => setTimeout(r, delay));
         continue;
       }
       
       throw error;
     }
  }
  
  throw lastError || new Error('Query failed after retries');
}

/**
 * Execute a query and return a single row
 */
export async function queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result[0] || null;
}

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}
