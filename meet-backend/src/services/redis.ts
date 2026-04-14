import { createClient, type RedisClientType } from 'redis';
import { config } from '../config.js';
import { gzip as gzipCb, gunzip as gunzipCb } from 'zlib';
import { promisify } from 'util';
import logger from '../utils/logger.js';

// Minimal subset of Redis multi/transactions commands we use in pipeline()
interface PartialMulti {
  set(key: string, value: string): this;
  get(key: string): this;
  del(...keys: string[]): this;
  sAdd(key: string, ...members: string[]): this;
  sRem(key: string, ...members: string[]): this;
  sMembers(key: string): this;
  expire(key: string, seconds: number): this;
  setEx(key: string, seconds: number, value: string): this;
  exec(): Promise<unknown[]>;
}

const gzip = promisify(gzipCb);
const gunzip = promisify(gunzipCb);

// Compression threshold: compress values larger than 1KB
const COMPRESSION_THRESHOLD = 1024;

// Pool configuration
const POOL_SIZE = 3; // Number of connections in pool

// Connection pool for high-throughput scenarios
interface PooledConnection {
  client: RedisClientType;
  inUse: boolean;
  lastUsed: number;
}

const connectionPool: PooledConnection[] = [];
let poolInitialized = false;
let poolHealthCheckInterval: ReturnType<typeof setInterval> | null = null;

// Main client for backwards compatibility and simple operations
let mainClient: RedisClientType | null = null;
let isConnected = false;

/**
 * Create a new Redis client with optimized settings
 */
function createOptimizedClient(): RedisClientType {
  return createClient({
    url: config.redis.url,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis: Too many reconnection attempts');
          return new Error('Too many retries');
        }
        // Exponential backoff with jitter
        const delay = Math.min(retries * 100 + Math.random() * 50, 3000);
        logger.info(`Redis: Reconnecting in ${Math.round(delay)}ms (attempt ${retries})`);
        return delay;
      },
      keepAlive: 5000,
      noDelay: true,
      connectTimeout: 10000,
    },
    disableOfflineQueue: false,
    commandsQueueMaxLength: 1000,
  });
}

/**
 * Initialize connection pool (called in background)
 */
async function initPool(): Promise<void> {
  if (poolInitialized) return;

  logger.info(`🔄 Initializing Redis connection pool (${POOL_SIZE} connections)...`);

  const initPromises = [];

  for (let i = 0; i < POOL_SIZE; i++) {
    const client = createOptimizedClient();
    client.on('error', (err) => logger.error(`Redis pool[${i}] error:`, err));

    initPromises.push(
      client.connect().then(() => {
        connectionPool.push({
          client,
          inUse: false,
          lastUsed: Date.now(),
        });
        logger.info(`✅ Redis pool[${i}] connected`);
      })
    );
  }

  await Promise.all(initPromises);
  poolInitialized = true;
  logger.info(`✅ Redis connection pool ready (${connectionPool.length} connections)`);

  // Start periodic health checks for pool connections (every 30s)
  poolHealthCheckInterval = setInterval(async () => {
    for (let i = 0; i < connectionPool.length; i++) {
      const conn = connectionPool[i];
      if (!conn.inUse && !conn.client.isOpen) {
        try {
          const newClient = createOptimizedClient();
          newClient.on('error', (err) => logger.error(`Redis pool[${i}] error:`, err));
          await newClient.connect();
          conn.client = newClient;
          logger.info(`✅ Redis pool[${i}] reconnected`);
        } catch (err) {
          logger.error(`Redis pool[${i}] reconnection failed:`, err);
        }
      }
    }
  }, 30_000);
}

/**
 * Get a connection from the pool (event-based, no busy-wait)
 */
export async function getPooledConnection(): Promise<RedisClientType> {
  if (!poolInitialized || connectionPool.length === 0) {
    if (!mainClient) throw new Error('Redis not initialized');
    return mainClient;
  }

  // Find available connection (not in use and open)
  for (const conn of connectionPool) {
    if (!conn.inUse && conn.client.isOpen) {
      conn.inUse = true;
      conn.lastUsed = Date.now();
      return conn.client;
    }
  }

  // No available connections - wait briefly and retry, then fall back to main
  await new Promise(resolve => setTimeout(resolve, 50));
  for (const conn of connectionPool) {
    if (!conn.inUse && conn.client.isOpen) {
      conn.inUse = true;
      conn.lastUsed = Date.now();
      return conn.client;
    }
  }

  // All pool connections busy - fall back to main client
  if (mainClient) {
    return mainClient;
  }

  throw new Error('No Redis connections available');
}

/**
 * Release a connection back to the pool
 */
export function releaseConnection(client: RedisClientType): void {
  const conn = connectionPool.find(c => c.client === client);
  if (conn) conn.inUse = false;
}

/**
 * Initialize Redis - creates main client and connection pool
 */
export async function initRedis(): Promise<void> {
  mainClient = createOptimizedClient();

  mainClient.on('error', (err) => logger.error('Redis error:', err));
  mainClient.on('connect', () => {
    logger.info('✅ Redis connected');
    isConnected = true;
  });
  mainClient.on('disconnect', () => {
    logger.warn('⚠️ Redis disconnected');
    isConnected = false;
  });
  mainClient.on('ready', () => {
    logger.info('📊 Redis ready for commands');
  });

  await mainClient.connect();

  // Initialize pool in background (non-blocking)
  initPool().catch(err => {
    logger.warn('Redis pool initialization failed, using single connection:', err);
  });
}

// Ensure connection before operations
async function ensureConnected(): Promise<void> {
  if (!isConnected && mainClient) {
    await mainClient.connect().catch(() => {
      throw new Error('Redis not connected');
    });
  }
}

// ============================================
// COMPRESSION HELPERS
// ============================================

async function compressValue(value: unknown): Promise<{ data: string; compressed: boolean }> {
  const json = JSON.stringify(value);
  if (json.length < COMPRESSION_THRESHOLD) {
    return { data: json, compressed: false };
  }
  const compressed = await gzip(Buffer.from(json));
  return { data: compressed.toString('base64'), compressed: true };
}

async function decompressValue<T>(data: string, compressed: boolean): Promise<T | null> {
  if (!data) return null;
  try {
    if (compressed) {
      const decompressed = await gunzip(Buffer.from(data, 'base64'));
      return JSON.parse(decompressed.toString());
    }
    return JSON.parse(data);
  } catch (e) {
    logger.error('[REDIS] Failed to parse JSON in decompressValue:', e);
    return null;
  }
}

// ============================================
// BASIC CACHE OPERATIONS
// ============================================

export async function cacheGet<T>(key: string): Promise<T | null> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  const data = await mainClient.get(key);
  if (!data) return null;

  if (data.startsWith('gz:')) {
    return decompressValue<T>(data.slice(3), true);
  }

  try {
    return JSON.parse(data);
  } catch (e) {
    logger.error('[REDIS] Failed to parse JSON in cacheGet:', e);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  const { data, compressed } = await compressValue(value);
  const finalData = compressed ? `gz:${data}` : data;
  await mainClient.setEx(key, ttlSeconds, finalData);
}

export async function cacheDel(key: string): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  await mainClient.del(key);
}

export async function cacheDelPattern(pattern: string): Promise<number> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  let deletedCount = 0;
  let cursor = 0;

  do {
    const result = await mainClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = result.cursor;

    if (result.keys.length > 0) {
      const pipeline = mainClient.multi();
      for (const key of result.keys) {
        pipeline.del(key);
      }
      await pipeline.exec();
      deletedCount += result.keys.length;
    }
  } while (cursor !== 0);

  return deletedCount;
}

export async function cacheExists(key: string): Promise<boolean> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  return (await mainClient.exists(key)) === 1;
}

export async function cacheTTL(key: string): Promise<number> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  return mainClient.ttl(key);
}

// ============================================
// PIPELINE OPERATIONS (Batch)
// ============================================

 export async function pipeline(commands: Array<{
   command: 'set' | 'get' | 'del' | 'sAdd' | 'sRem' | 'sMembers' | 'expire' | 'setEx';
   args: unknown[];
 }>): Promise<unknown[]> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  const multi = mainClient.multi() as PartialMulti;
  for (const cmd of commands) {
    const fn = multi[cmd.command];
    if (typeof fn !== 'function') {
      throw new Error(`Unsupported Redis multi command: ${cmd.command}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fn as any).apply(multi, cmd.args);
  }
  return multi.exec();
}

export async function cacheSetMulti(items: Array<{ key: string; value: unknown; ttl?: number }>): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  const multi = mainClient.multi();
  for (const item of items) {
    const { data, compressed } = await compressValue(item.value);
    const finalData = compressed ? `gz:${data}` : data;
    if (item.ttl) {
      multi.setEx(item.key, item.ttl, finalData);
    } else {
      multi.set(item.key, finalData);
    }
  }
  await multi.exec();
}

export async function cacheGetMulti<T>(keys: string[]): Promise<Map<string, T | null>> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  const results = new Map<string, T | null>();
  if (keys.length === 0) return results;

  const values = await mainClient.mGet(keys);

  for (let i = 0; i < keys.length; i++) {
    const data = values[i];
    if (!data) {
      results.set(keys[i], null);
      continue;
    }

    if (data.startsWith('gz:')) {
      results.set(keys[i], await decompressValue<T>(data.slice(3), true));
    } else {
      try {
        results.set(keys[i], JSON.parse(data));
      } catch (e) {
        logger.error('[REDIS] Failed to parse JSON in cacheGetMulti:', e);
        results.set(keys[i], null);
      }
    }
  }

  return results;
}

// ============================================
// ROOM STATE OPERATIONS
// ============================================

export async function setRoomState(roomName: string, state: unknown): Promise<void> {
  await cacheSet(`room:${roomName}:state`, state, 3600);
}

export async function getRoomState<T>(roomName: string): Promise<T | null> {
  return cacheGet<T>(`room:${roomName}:state`);
}

export async function delRoomState(roomName: string): Promise<number> {
  return cacheDelPattern(`room:${roomName}:*`);
}

// ============================================
// PARTICIPANT PRESENCE (Using Pool)
// ============================================

export async function addParticipant(roomName: string, identity: string): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  await mainClient.sAdd(`room:${roomName}:participants`, identity);
}

export async function addParticipants(roomName: string, identities: string[]): Promise<void> {
  if (identities.length === 0) return;
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  const multi = mainClient.multi();
  for (const identity of identities) {
    multi.sAdd(`room:${roomName}:participants`, identity);
  }
  await multi.exec();
}

export async function removeParticipant(roomName: string, identity: string): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  await mainClient.sRem(`room:${roomName}:participants`, identity);
}

export async function removeParticipants(roomName: string, identities: string[]): Promise<void> {
  if (identities.length === 0) return;
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  const multi = mainClient.multi();
  for (const identity of identities) {
    multi.sRem(`room:${roomName}:participants`, identity);
  }
  await multi.exec();
}

export async function getParticipants(roomName: string): Promise<string[]> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  return mainClient.sMembers(`room:${roomName}:participants`);
}

export async function getParticipantCount(roomName: string): Promise<number> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  return mainClient.sCard(`room:${roomName}:participants`);
}

// ============================================
// MONITORING & STATS
// ============================================

export async function getRedisInfo(): Promise<{
  connected: boolean;
  usedMemory: string;
  totalKeys: number;
  hitRate: number;
}> {
  if (!isConnected || !mainClient) {
    return { connected: false, usedMemory: '0', totalKeys: 0, hitRate: 0 };
  }

  try {
    const [memoryInfo, statsInfo, dbSize] = await Promise.all([
      mainClient.info('memory'),
      mainClient.info('stats'),
      mainClient.dbSize(),
    ]);

    const memoryMatch = memoryInfo.match(/used_memory_human:(\S+)/);
    const usedMemory = memoryMatch ? memoryMatch[1] : 'unknown';

    const keyspaceHits = statsInfo.match(/keyspace_hits:(\d+)/);
    const keyspaceMisses = statsInfo.match(/keyspace_misses:(\d+)/);
    const hits = parseInt(keyspaceHits?.[1] || '0', 10);
    const misses = parseInt(keyspaceMisses?.[1] || '0', 10);
    const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;

    return {
      connected: true,
      usedMemory,
      totalKeys: dbSize,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  } catch (error) {
    logger.error('Failed to get Redis info:', error);
    return { connected: true, usedMemory: 'unknown', totalKeys: 0, hitRate: 0 };
  }
}

// ============================================
// ADMITTED PARTICIPANTS (Auto-admit on rejoin)
// ============================================

// Admitted participants stay valid for 4 hours (longer than a typical meeting)
const ADMITTED_TTL_SECONDS = 4 * 60 * 60;

/**
 * Add a participant to the admitted list for a room.
 * They will be auto-admitted if they rejoin within the TTL.
 */
export async function addAdmittedParticipant(roomName: string, identity: string, guestName?: string): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  // Store by identity
  await mainClient.setEx(
    `admitted:${roomName}:${identity}`,
    ADMITTED_TTL_SECONDS,
    JSON.stringify({ identity, guestName, admittedAt: Date.now() })
  );
  logger.info(`[ADMIT] Added ${identity} to admitted list for room ${roomName}, TTL: ${ADMITTED_TTL_SECONDS}s`);

  // Also store by guest name for name-based lookup
  if (guestName) {
    const normalizedName = guestName.toLowerCase().trim();
    await mainClient.setEx(
      `admitted_guest:${roomName}:${normalizedName}`,
      ADMITTED_TTL_SECONDS,
      identity
    );
    logger.info(`[ADMIT] Also tracking guest "${guestName}" for room ${roomName}`);
  }
}

/**
 * Check if a participant was previously admitted (by identity).
 * Returns the TTL remaining (0 if not admitted).
 */
export async function isParticipantAdmitted(roomName: string, identity: string): Promise<number> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  return Math.max(0, await mainClient.ttl(`admitted:${roomName}:${identity}`));
}

/**
 * Check if a guest name was previously admitted.
 * Returns the TTL remaining (0 if not admitted).
 */
export async function isGuestNameAdmitted(roomName: string, guestName: string): Promise<number> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  const normalizedName = guestName.toLowerCase().trim();
  return Math.max(0, await mainClient.ttl(`admitted_guest:${roomName}:${normalizedName}`));
}

/**
 * Get admitted participant info by identity.
 */
export async function getAdmittedParticipant(roomName: string, identity: string): Promise<{ identity: string; guestName?: string; admittedAt: number } | null> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  const data = await mainClient.get(`admitted:${roomName}:${identity}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Remove participant from admitted list (e.g., when kicked).
 */
export async function removeAdmittedParticipant(roomName: string, identity: string): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  await mainClient.del(`admitted:${roomName}:${identity}`);
}

// ============================================
// KICKED PARTICIPANTS (Cooldown)
// ============================================

const KICK_COOLDOWN_SECONDS = 10;

export async function addKickedParticipant(roomName: string, identity: string, guestName?: string): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');

  await mainClient.setEx(
    `kicked:${roomName}:${identity}`,
    KICK_COOLDOWN_SECONDS,
    Date.now().toString()
  );
  logger.info(`[KICK] Added ${identity} to kicked list for room ${roomName}, cooldown: ${KICK_COOLDOWN_SECONDS}s`);

  if (guestName) {
    const normalizedName = guestName.toLowerCase().trim();
    await mainClient.setEx(
      `kicked_guest:${roomName}:${normalizedName}`,
      KICK_COOLDOWN_SECONDS,
      identity
    );
    logger.info(`[KICK] Also tracking guest "${guestName}" for room ${roomName}`);
  }
}

export async function isParticipantKicked(roomName: string, identity: string): Promise<number> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  return Math.max(0, await mainClient.ttl(`kicked:${roomName}:${identity}`));
}

export async function isGuestNameKicked(roomName: string, guestName: string): Promise<number> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  const normalizedName = guestName.toLowerCase().trim();
  return Math.max(0, await mainClient.ttl(`kicked_guest:${roomName}:${normalizedName}`));
}

export async function removeKickedParticipant(roomName: string, identity: string): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  await mainClient.del(`kicked:${roomName}:${identity}`);
}

// ============================================
// TOKEN BLACKLIST (Logout/Invalidation)
// ============================================

/**
 * Add a JWT token to the blacklist until it expires.
 * Uses the token's TTL to auto-cleanup.
 */
export async function blacklistToken(token: string, ttlSeconds: number): Promise<void> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  // Use token hash to avoid storing full token in Redis
  const { createHash } = await import('crypto');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await mainClient.setEx(`blacklist:${tokenHash}`, Math.max(ttlSeconds, 1), '1');
}

/**
 * Check if a JWT token is blacklisted.
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  const { createHash } = await import('crypto');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return (await mainClient.exists(`blacklist:${tokenHash}`)) === 1;
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

export async function closeRedis(): Promise<void> {
  // Stop health check interval
  if (poolHealthCheckInterval) {
    clearInterval(poolHealthCheckInterval);
    poolHealthCheckInterval = null;
  }

  // Close all pooled connections
  for (const conn of connectionPool) {
    try {
      await conn.client.quit();
    } catch {
      // Ignore errors during shutdown
    }
  }
  connectionPool.length = 0;
  poolInitialized = false;

  // Close main client
  if (mainClient && isConnected) {
    await mainClient.quit();
    isConnected = false;
  }
}
