import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export function createRateLimiter(requests, window) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
  });
}

export async function checkRateLimit(limiter, identifier, res) {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  if (!success) {
    res.status(429).json({ error: 'Too many requests, please try again shortly.' });
    return false;
  }
  return true;
}
