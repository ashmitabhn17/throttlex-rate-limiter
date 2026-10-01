import { Plan, ApiKeyStatus } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { redis } from '../src/config/redis';
import { generateApiKey } from '../src/utils/apiKey';

/** Remove all rate-limit related data between tests. */
export async function resetData(): Promise<void> {
  await prisma.requestLog.deleteMany();
  await prisma.rateLimitRule.deleteMany();
  await prisma.apiKey.deleteMany();
  await redis.flushdb();
}

export async function createTestApiKey(opts?: {
  plan?: Plan;
  status?: ApiKeyStatus;
  name?: string;
}): Promise<{ id: string; raw: string; keyHash: string }> {
  const { raw, keyHash, keyPrefix } = generateApiKey();
  const created = await prisma.apiKey.create({
    data: {
      name: opts?.name ?? 'test-key',
      keyHash,
      keyPrefix,
      plan: opts?.plan ?? Plan.FREE,
      status: opts?.status ?? ApiKeyStatus.ACTIVE,
    },
  });
  return { id: created.id, raw, keyHash };
}

export async function createRule(opts: {
  route: string;
  method: string;
  plan: Plan;
  capacity: number;
  refillRatePerSecond: number;
  windowSeconds?: number;
}): Promise<void> {
  await prisma.rateLimitRule.create({
    data: {
      route: opts.route,
      method: opts.method,
      plan: opts.plan,
      capacity: opts.capacity,
      refillRatePerSecond: opts.refillRatePerSecond,
      windowSeconds: opts.windowSeconds ?? 60,
      algorithm: 'TOKEN_BUCKET',
      enabled: true,
    },
  });
}

export async function closeConnections(): Promise<void> {
  await prisma.$disconnect();
  redis.disconnect();
}
