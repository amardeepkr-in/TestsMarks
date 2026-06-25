import Redis from 'ioredis';
import { info, warn, error as logError } from './logger';

// In-memory cache fallback
class MemoryCache {
  private cache: Map<string, { value: unknown; expiry: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  async get(key: string): Promise<unknown | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    const expiry = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Cache configuration
const CACHE_ENABLED = process.env.ENABLE_CACHING !== 'false';
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL || '300', 10); // 5 minutes
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Initialize cache client
let cacheClient: Redis | MemoryCache;
let isRedis = false;

if (CACHE_ENABLED && REDIS_URL) {
  try {
    cacheClient = new Redis(REDIS_URL, {
      password: REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    cacheClient.on('connect', () => {
      info('Redis cache connected');
      isRedis = true;
    });

    cacheClient.on('error', (err) => {
      warn('Redis cache error, falling back to memory cache', { error: err.message });
      isRedis = false;
    });

    isRedis = true;
  } catch (err) {
    warn('Failed to initialize Redis, using memory cache', { error: err });
    cacheClient = new MemoryCache();
    isRedis = false;
  }
} else {
  info('Using in-memory cache');
  cacheClient = new MemoryCache();
  isRedis = false;
}

/**
 * Get value from cache
 */
export async function get<T = unknown>(key: string): Promise<T | null> {
  if (!CACHE_ENABLED) return null;

  try {
    const value = await cacheClient.get(key);

    if (value === null) return null;

    // Parse JSON if using Redis
    if (isRedis && typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    }

    return value as T;
  } catch (err) {
    logError('Cache get error', { key, error: err });
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
export async function set(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<boolean> {
  if (!CACHE_ENABLED) return false;

  try {
    if (isRedis) {
      const serialized = JSON.stringify(value);
      await (cacheClient as Redis).setex(key, ttl, serialized);
    } else {
      await (cacheClient as MemoryCache).set(key, value, ttl);
    }
    return true;
  } catch (err) {
    logError('Cache set error', { key, error: err });
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function del(key: string): Promise<boolean> {
  if (!CACHE_ENABLED) return false;

  try {
    await cacheClient.del(key);
    return true;
  } catch (err) {
    logError('Cache delete error', { key, error: err });
    return false;
  }
}

/**
 * Clear all cache entries (or by pattern)
 */
export async function clear(pattern?: string): Promise<boolean> {
  if (!CACHE_ENABLED) return false;

  try {
    if (pattern) {
      const keys = await cacheClient.keys(pattern);
      if (keys.length > 0) {
        if (isRedis) {
          await (cacheClient as Redis).del(...keys);
        } else {
          for (const key of keys) {
            await cacheClient.del(key);
          }
        }
      }
    } else {
      if (isRedis) {
        await (cacheClient as Redis).flushdb();
      } else {
        await (cacheClient as MemoryCache).clear();
      }
    }
    return true;
  } catch (err) {
    logError('Cache clear error', { pattern, error: err });
    return false;
  }
}

/**
 * Check if key exists in cache
 */
export async function exists(key: string): Promise<boolean> {
  if (!CACHE_ENABLED) return false;

  try {
    if (isRedis) {
      const result = await (cacheClient as Redis).exists(key);
      return result === 1;
    } else {
      const value = await cacheClient.get(key);
      return value !== null;
    }
  } catch (err) {
    logError('Cache exists error', { key, error: err });
    return false;
  }
}

/**
 * Get or set cache value (cache-aside pattern)
 */
export async function getOrSet<T = unknown>(
  key: string,
  factory: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  // Try to get from cache
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Generate value
  const value = await factory();

  // Store in cache
  await set(key, value, ttl);

  return value;
}

/**
 * Increment a counter in cache
 */
export async function increment(key: string, amount: number = 1): Promise<number> {
  if (!CACHE_ENABLED) return 0;

  try {
    if (isRedis) {
      return await (cacheClient as Redis).incrby(key, amount);
    } else {
      const current = (await get<number>(key)) || 0;
      const newValue = current + amount;
      await set(key, newValue, DEFAULT_TTL);
      return newValue;
    }
  } catch (err) {
    logError('Cache increment error', { key, error: err });
    return 0;
  }
}

/**
 * Decrement a counter in cache
 */
export async function decrement(key: string, amount: number = 1): Promise<number> {
  return increment(key, -amount);
}

/**
 * Get multiple keys at once
 */
export async function mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
  if (!CACHE_ENABLED || keys.length === 0) return [];

  try {
    if (isRedis) {
      const values = await (cacheClient as Redis).mget(...keys);
      return values.map(v => {
        if (v === null) return null;
        try {
          return JSON.parse(v);
        } catch {
          return v as T;
        }
      });
    } else {
      return Promise.all(keys.map(key => get<T>(key)));
    }
  } catch (err) {
    logError('Cache mget error', { keys, error: err });
    return keys.map(() => null);
  }
}

/**
 * Set multiple keys at once
 */
export async function mset(entries: Array<{ key: string; value: unknown; ttl?: number }>): Promise<boolean> {
  if (!CACHE_ENABLED || entries.length === 0) return false;

  try {
    await Promise.all(
      entries.map(({ key, value, ttl }) => set(key, value, ttl))
    );
    return true;
  } catch (err) {
    logError('Cache mset error', { error: err });
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getStats(): Promise<{
  type: 'redis' | 'memory';
  enabled: boolean;
  connected?: boolean;
  keyCount?: number;
}> {
  const stats: {
    type: 'redis' | 'memory';
    enabled: boolean;
    connected?: boolean;
    keyCount?: number;
  } = {
    type: isRedis ? 'redis' : 'memory',
    enabled: CACHE_ENABLED,
  };

  if (CACHE_ENABLED) {
    try {
      if (isRedis) {
        stats.connected = (cacheClient as Redis).status === 'ready';
        stats.keyCount = await (cacheClient as Redis).dbsize();
      } else {
        stats.connected = true;
        const keys = await cacheClient.keys('*');
        stats.keyCount = keys.length;
      }
    } catch {
      stats.connected = false;
    }
  }

  return stats;
}

/**
 * Cache key builders for common patterns
 */
export const CacheKeys = {
  submissions: (page: number = 1, limit: number = 50) =>
    `submissions:list:${page}:${limit}`,
  submission: (id: number) =>
    `submission:${id}`,
  analytics: (type: string) =>
    `analytics:${type}`,
  settings: () =>
    'settings',
  userPermissions: (userId: number) =>
    `user:${userId}:permissions`,
  searchResults: (query: string, page: number) =>
    `search:${query}:${page}`,
  filter: (filterId: number) =>
    `filter:${filterId}`,
};

// Cleanup on process exit
process.on('SIGTERM', () => {
  if (isRedis) {
    (cacheClient as Redis).disconnect();
  } else {
    (cacheClient as MemoryCache).destroy();
  }
});


