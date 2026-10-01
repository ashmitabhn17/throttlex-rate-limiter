import { Plan } from '@prisma/client';

/**
 * Fallback limits applied when no explicit RateLimitRule exists for a
 * (plan, method, route). Keeps every protected endpoint enforceable even
 * before an admin configures a custom rule.
 */
export const DEFAULT_PLAN_LIMITS: Record<Plan, { capacity: number; refillRatePerSecond: number; windowSeconds: number }> = {
  FREE: { capacity: 30, refillRatePerSecond: 1, windowSeconds: 60 },
  PRO: { capacity: 200, refillRatePerSecond: 15, windowSeconds: 60 },
  ENTERPRISE: { capacity: 2000, refillRatePerSecond: 100, windowSeconds: 60 },
};
