import Redis from 'ioredis';
import { createHash } from 'crypto';

const TTL = {
  INTENT: 60, // 1 hour in minutes
};

const PREFIX = 'mcp-dashboard';

let redis: Redis | null = null;

/**
 * Initialize Redis connection using ioredis directly.
 * Reads REDIS_HOST, REDIS_PORT, REDIS_USER, REDIS_PASS from env.
 */
export async function initCache(): Promise<void> {
  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT) || 6379;
  const username = process.env.REDIS_USER || undefined;
  const password = process.env.REDIS_PASS || undefined;
  const useTls = process.env.REDIS_TLS !== 'false'; // default: TLS enabled

  if (!host) {
    console.error('[cache] REDIS_HOST not set — running without cache');
    return;
  }

  try {
    const client = new Redis({
      host,
      port,
      username,
      password,
      tls: useTls ? {} : undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    client.on('error', (err) => {
      console.error('[cache] Redis error:', err.message);
    });

    await client.connect();
    redis = client;
    console.error('[cache] Connected to Redis at', host);
  } catch (err) {
    console.error(
      '[cache] Could not connect to Redis:',
      (err as Error).message,
    );
    redis = null;
  }
}

/**
 * Generate a deterministic hash for a cache key.
 */
export function generateCacheKey(prefix: string, data: unknown): string {
  const raw = JSON.stringify(data);
  const hash = createHash('sha256').update(raw).digest('hex');
  const key = `${PREFIX}:${prefix}:${hash}`;
  return key;
}

/**
 * Get a cached value by key.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const result = await redis.get(key);
    if (result) {
      return JSON.parse(result) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with a TTL (in minutes).
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlMinutes?: number,
): Promise<void> {
  if (!redis) return;

  try {
    const ttl = ttlMinutes || TTL.INTENT;
    const serialized = JSON.stringify(value);
    await redis.set(key, serialized, 'EX', ttl * 60);
    console.error(`[cache] SET: ${key} (TTL: ${ttl}min)`);
  } catch (err) {
    console.error('[cache] Error setting cache:', (err as Error).message);
  }
}

/**
 * Returns whether Redis is currently connected.
 */
export function isCacheConnected(): boolean {
  return redis !== null;
}

/**
 * Gracefully disconnect Redis.
 */
export async function disconnectCache(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export { TTL };

