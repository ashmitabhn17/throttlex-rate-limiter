import { Request, Response, NextFunction } from 'express';
import { RequestStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { hashApiKey } from '../utils/apiKey';
import { DEFAULT_PLAN_LIMITS } from '../config/defaults';
import { checkRateLimit, Algorithm } from '../services/rateLimiter';

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/** The route path used for rule matching, e.g. "/api/search". */
function resolveRoute(req: Request): string {
  const base = req.baseUrl || '';
  const path = req.path || '';
  return `${base}${path}`.replace(/\/+$/, '') || path;
}

/**
 * Rate-limiting gate for the protected demo APIs.
 *
 * Flow:
 *  1. Read x-api-key header.
 *  2. Hash it (SHA-256) — the raw key is never used for lookups or storage.
 *  3. Find the ApiKey row by hash; reject if missing or disabled.
 *  4. Resolve the plan and the matching RateLimitRule (or fall back to plan defaults).
 *  5. Run the atomic Redis/Lua token bucket.
 *  6. Attach standard X-RateLimit-* headers.
 *  7. Persist a RequestLog row (allowed/blocked).
 *  8. Continue to the handler, or return 429.
 */
export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const route = resolveRoute(req);
  const method = req.method.toUpperCase();
  const rawKey = req.header('x-api-key');

  console.log(`\n[RateLimit] Incoming request: ${method} ${route} from IP: ${clientIp(req)}`);

  if (!rawKey) {
    console.log(`[RateLimit] Blocked: Missing API key`);
    res.status(401).json({ error: 'Missing API key', message: 'Provide an API key via the x-api-key header.' });
    return;
  }

  // We hash the API key using SHA-256 to securely identify the caller.
  // The raw API key is never stored in the database or Redis, preventing leaks.
  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });

  if (!apiKey) {
    console.log(`[RateLimit] Blocked: Invalid API key`);
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  if (apiKey.status === 'DISABLED') {
    console.log(`[RateLimit] Blocked: API key disabled`);
    res.status(403).json({ error: 'API key disabled' });
    return;
  }

  // Resolve the effective rule: explicit rule for (plan, method, route) wins,
  // otherwise fall back to this plan's default limits.
  const rule = await prisma.rateLimitRule.findFirst({
    where: { plan: apiKey.plan, method, route, enabled: true },
  });

  const config = rule
    ? {
        algorithm: rule.algorithm as Algorithm,
        capacity: rule.capacity,
        refillRatePerSecond: rule.refillRatePerSecond,
        windowSeconds: rule.windowSeconds,
      }
    : { algorithm: 'TOKEN_BUCKET' as Algorithm, ...DEFAULT_PLAN_LIMITS[apiKey.plan] };

  // Run the atomic Redis/Lua token bucket logic to check the rate limit.
  const result = await checkRateLimit({ keyHash, plan: apiKey.plan, route, method }, config);

  console.log(`[RateLimit] Outcome for ${route}: ${result.allowed ? 'ALLOWED' : 'BLOCKED'} (Remaining: ${result.remaining}/${result.limit})`);

  // Standard rate-limit headers on every response (allowed or blocked).
  const policy = `${config.capacity};w=${config.windowSeconds};burst=${config.capacity};algorithm=${config.algorithm.toLowerCase()}`;
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(result.reset));
  res.setHeader('X-RateLimit-Policy', policy);
  if (result.degraded) res.setHeader('X-RateLimit-Degraded', 'true');

  const status: RequestStatus = result.allowed ? 'ALLOWED' : 'BLOCKED';

  // Fire-and-forget logging + lastUsedAt bump. We don't block the response on it,
  // but we do catch to avoid unhandled rejections.
  void prisma.requestLog
    .create({
      data: {
        apiKeyId: apiKey.id,
        route,
        method,
        status,
        ip: clientIp(req),
        userAgent: req.header('user-agent') ?? null,
        limit: result.limit,
        remaining: result.remaining,
        retryAfter: result.allowed ? null : result.retryAfter,
      },
    })
    .catch((e) => console.error('[rateLimit] failed to write log:', (e as Error).message));

  void prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please retry later.',
      limit: result.limit,
      remaining: result.remaining,
      retryAfter: result.retryAfter,
    });
    return;
  }

  next();
}
