import { redis } from '../config/redis';
import { env } from '../config/env';
import { TOKEN_BUCKET_LUA } from '../lua/tokenBucket';
import { FIXED_WINDOW_LUA } from '../lua/fixedWindow';
import { apiKeyRedisIdentity, routeHash } from '../utils/apiKey';

export type Algorithm = 'TOKEN_BUCKET' | 'FIXED_WINDOW';

export interface RateLimitConfig {
  algorithm: Algorithm;
  capacity: number;
  refillRatePerSecond: number;
  windowSeconds: number;
}

export interface RateLimitIdentity {
  /** SHA-256 hash of the API key (never the raw key). */
  keyHash: string;
  plan: string;
  route: string;
  method: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the client should retry (only meaningful when blocked). */
  retryAfter: number;
  /** Seconds until the bucket/window fully resets. */
  reset: number;
  /** True when Redis was unavailable and we fell open. */
  degraded: boolean;
}

/**
 * Build the Redis key for a bucket.
 *
 * Design: rl:{apiKeyHash}:plan:routeHash
 *
 * WHY THIS SHAPE (hot-key avoidance):
 * If every request shared one global key like `rl:global`, that single key would
 * become a hot key: a single Redis slot serialising the entire fleet's traffic,
 * which caps throughput and, on Redis Cluster, pins all load to one node.
 *
 * By putting the per-tenant {apiKeyHash} identity FIRST, each API key gets its
 * own bucket, so load spreads naturally across keys (and across cluster hash
 * slots). The curly braces make {apiKeyHash} a Redis Cluster "hash tag": all
 * keys for one API key route to the same slot (useful if we later add multiple
 * keys per tenant in a MULTI), while different API keys land on different slots.
 *
 * We further split by :plan:routeHash so a burst on /api/search doesn't consume
 * the /api/login-demo budget. The route is hashed to keep keys short and to
 * avoid leaking full paths / weird characters into key space. The raw API key
 * never appears — only its SHA-256-derived identity.
 */
export function buildBucketKey(identity: RateLimitIdentity): string {
  const keyId = apiKeyRedisIdentity(identity.keyHash);
  const rHash = routeHash(identity.route, identity.method);
  return `rl:{${keyId}}:${identity.plan}:${rHash}`;
}

/**
 * Run the rate-limit check atomically in Redis via a Lua script.
 * Falls open (or closed, per config) if Redis is unreachable.
 */
export async function checkRateLimit(
  identity: RateLimitIdentity,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = buildBucketKey(identity);
  const nowMs = Date.now();
  // Give idle buckets a generous but bounded lifetime.
  const ttlSeconds = Math.max(config.windowSeconds * 2, 120);

  try {
    let raw: unknown;

    if (config.algorithm === 'FIXED_WINDOW') {
      raw = await redis.eval(FIXED_WINDOW_LUA, 1, key, config.capacity, config.windowSeconds);
    } else {
      raw = await redis.eval(
        TOKEN_BUCKET_LUA,
        1,
        key,
        config.capacity,
        config.refillRatePerSecond,
        nowMs,
        1, // requested tokens
        ttlSeconds,
      );
    }

    const [allowed, remaining, retryAfter, reset] = raw as [number, number, number, number];

    return {
      allowed: allowed === 1,
      limit: config.capacity,
      remaining: Math.max(0, remaining),
      retryAfter: Math.max(0, retryAfter),
      reset: Math.max(0, reset),
      degraded: false,
    };
  } catch (err) {
    // Redis is down or the script errored. Apply the configured failure policy.
    if (env.nodeEnv !== 'test') {
      console.error('[rateLimiter] Redis error, applying fail-' + (env.rateLimitFailOpen ? 'open' : 'closed'), (err as Error).message);
    }

    if (env.rateLimitFailOpen) {
      return {
        allowed: true,
        limit: config.capacity,
        remaining: config.capacity,
        retryAfter: 0,
        reset: config.windowSeconds,
        degraded: true,
      };
    }

    return {
      allowed: false,
      limit: config.capacity,
      remaining: 0,
      retryAfter: config.windowSeconds,
      reset: config.windowSeconds,
      degraded: true,
    };
  }
}
