import Redis from 'ioredis';
import { env } from './env';

// Single shared ioredis connection. lazyConnect keeps tests/CI from failing
// hard at import time when Redis isn't up yet — we connect on first use.
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    // Keep reconnecting in the background instead of throwing on transient blips.
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

redis.on('error', (err) => {
  // Don't crash the process on Redis errors; the rate limiter has a fail-open path.
  if (env.nodeEnv !== 'test') {
    console.error('[redis] connection error:', err.message);
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
