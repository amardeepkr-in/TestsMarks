import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  error?: string;
}

/**
 * In-memory rate limiter for development
 * Uses a Map to track requests per identifier
 */
class InMemoryRateLimiter {
  private requests: Map<string, { count: number; resetAt: number }> = new Map();
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const record = this.requests.get(identifier);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      this.cleanup(now);
    }

    if (!record || now > record.resetAt) {
      // New window
      this.requests.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return {
        success: true,
        limit: this.limit,
        remaining: this.limit - 1,
        reset: now + this.windowMs,
      };
    }

    if (record.count >= this.limit) {
      // Rate limit exceeded
      return {
        success: false,
        limit: this.limit,
        remaining: 0,
        reset: record.resetAt,
        error: 'Rate limit exceeded',
      };
    }

    // Increment count
    record.count++;
    this.requests.set(identifier, record);

    return {
      success: true,
      limit: this.limit,
      remaining: this.limit - record.count,
      reset: record.resetAt,
    };
  }

  private cleanup(now: number) {
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetAt) {
        this.requests.delete(key);
      }
    }
  }
}

/**
 * Create rate limiter instance
 * Uses Redis if available, otherwise falls back to in-memory
 */
function createRateLimiter(config: RateLimitConfig) {
  const redisUrl = process.env.REDIS_URL;
  const redisToken = process.env.REDIS_TOKEN;

  if (redisUrl && redisToken) {
    // Use Redis for production
    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    // Convert milliseconds to seconds for Upstash Duration format
    const windowSeconds = Math.floor(config.windowMs / 1000);
    const windowString = `${windowSeconds}s` as `${number}s`;

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, windowString),
      analytics: true,
      prefix: 'testmarks',
    });
  }

  // Use in-memory for development
  return new InMemoryRateLimiter(config.requests, config.windowMs);
}

/**
 * Login rate limiter
 * 5 requests per 15 minutes per IP
 */
export const loginRateLimit = createRateLimiter({
  requests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

/**
 * API rate limiter
 * 100 requests per minute per IP
 */
export const apiRateLimit = createRateLimiter({
  requests: 100,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Check rate limit for a given identifier
 * @param limiter - Rate limiter instance
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @returns Rate limit result
 */
export async function checkRateLimit(
  limiter: Ratelimit | InMemoryRateLimiter,
  identifier: string
): Promise<RateLimitResult> {
  try {
    if (limiter instanceof InMemoryRateLimiter) {
      return await limiter.check(identifier);
    }

    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      error: result.success ? undefined : 'Rate limit exceeded',
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow request if rate limiting fails
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: Date.now(),
      error: 'Rate limit check failed',
    };
  }
}

/**
 * Get client IP address from headers
 * @param headers - Request headers
 * @returns IP address or 'unknown'
 */
export function getClientIp(headers: Headers): string {
  // Check common headers for IP address
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return 'unknown';
}


