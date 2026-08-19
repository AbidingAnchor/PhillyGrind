import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis;
try {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('[rateLimit] Missing Upstash Redis configuration');
    redis = null;
  } else {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (error) {
  console.error('[rateLimit] Failed to initialize Redis:', error.message);
  redis = null;
}

export function createRateLimiter(requests, window) {
  if (!redis) {
    console.warn('[rateLimit] Redis not available, rate limiting disabled');
    return null;
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
  });
}

export async function checkRateLimit(limiter, identifier, res) {
  if (!limiter) {
    return true; // Skip rate limiting if Redis is unavailable
  }
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    if (!success) {
      res.status(429).json({ error: 'Too many requests, please try again shortly.' });
      return false;
    }
    return true;
  } catch (error) {
    console.error('[rateLimit] Rate limit check failed:', error.message);
    return true; // Allow request if rate limiting fails
  }
}
