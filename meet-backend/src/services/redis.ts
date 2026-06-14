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
 * Initialize Redis - creates the main client
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
}

// Connection promise singleton to prevent concurrent connect() calls
let connectingPromise: Promise<void> | null = null;

// Ensure connection before operations
async function ensureConnected(): Promise<void> {
  if (!mainClient) throw new Error('Redis not initialized');
  // If already open/ready, nothing to do
  if (mainClient.isOpen && mainClient.isReady) return;
  // If the client is open but not ready, wait briefly
  if (mainClient.isOpen && !mainClient.isReady) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return;
  }
  // If not open at all, try reconnecting — use shared promise to prevent race
  if (!mainClient.isOpen) {
    if (connectingPromise) return connectingPromise;
    connectingPromise = mainClient.connect().then(() => { connectingPromise = null; }).catch((err: unknown) => {
      connectingPromise = null;
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('already') || msg.includes('connecting')) return;
      throw new Error('Redis not connected');
    });
    await connectingPromise;
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

/**
 * Atomically increment a counter and set its expiry.
 * Uses MULTI/EXEC so concurrent callers cannot race the read-then-write pattern.
 * Returns the new value after increment.
 */
export async function cacheIncrWithExpire(key: string, ttlSeconds: number): Promise<number> {
  await ensureConnected();
  if (!mainClient) throw new Error('Redis not initialized');
  const multi = mainClient.multi();
  multi.incr(key);
  multi.expire(key, ttlSeconds);
  const results = await multi.exec();
  return Number(results[0]);
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

// Admitted/kicked participant presence moved to participantPresence.ts.
// Re-exported below for backwards compatibility.

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
  // Close main client
  if (mainClient && isConnected) {
    await mainClient.quit();
    isConnected = false;
  }
}

// ============================================
// RE-EXPORTS (Admitted/Kicked participant presence)
// ============================================
// These functions were extracted to participantPresence.ts for separation of
// concerns. Re-exported here so existing imports from redis.js keep working.
export {
  addAdmittedParticipant,
  isParticipantAdmitted,
  isGuestNameAdmitted,
  getAdmittedParticipant,
  removeAdmittedParticipant,
  addKickedParticipant,
  isParticipantKicked,
  isGuestNameKicked,
  removeKickedParticipant,
} from './participantPresence.js';