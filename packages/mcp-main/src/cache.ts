import { RedisCache } from '@mp-front/common/cache-providers';
import { createHash } from 'crypto';

// TTL in minutes (RedisCache.set expects minutes)
const TTL = {
  INTENT: 60, // 1 hour — same intent text = same parsed result from LLM
};

const PREFIX = 'mcp-dashboard';

let redis: RedisCache<unknown> | null = null;

/**
 * Initialize Redis connection via @mp-front/common.
 * Falls back gracefully if Redis is unavailable.
 */
export function initCache(): void {
  try {
    redis = new RedisCache<unknown>();
    redis
      .statusHost()
      .then(() =>
        console.log('[cache] Connected to Redis via @mp-front/common'),
      )
      .catch((err: Error) => {
        console.warn(
          '[cache] Could not connect to Redis — running without cache:',
          err.message,
        );
        redis = null;
      });
  } catch (err) {
    console.warn('[cache] Failed to initialize Redis:', (err as Error).message);
    redis = null;
  }
}

/**
 * Generate a deterministic hash for a cache key.
 * Logs the hash for debugging/searching.
 */
export function generateCacheKey(prefix: string, data: unknown): string {
  const raw = JSON.stringify(data);
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  const key = `${PREFIX}:${prefix}:${hash}`;
  console.log(`[cache] Key: ${key} | Hash: ${hash}`);
  return key;
}

/**
 * Get a cached value by key. Returns null on miss or if Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const result = await redis.simpleGet(key);
    if (result) {
      console.log(`[cache] HIT: ${key}`);
      return JSON.parse(result) as T;
    }
    console.log(`[cache] MISS: ${key}`);
    return null;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with a TTL.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlMinutes?: number,
): Promise<void> {
  if (!redis) return;

  try {
    await redis.set({
      prefix: key,
      idData: 'data',
      body: value,
      expire: ttlMinutes || TTL.INTENT,
      encrypted: false,
    });
  } catch (err) {
    console.warn('[cache] Error setting cache:', (err as Error).message);
  }
}

/**
 * Gracefully disconnect Redis.
 */
export async function disconnectCache(): Promise<void> {
  // @mp-front/common manages its own connection lifecycle
  console.log('[cache] Cache layer stopped');
}

export { TTL };

