import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Plan, RateLimitAlgorithm } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@throttlex.dev';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

  // ---- Admin user ----
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'ThrottleX Admin',
      email: adminEmail,
      passwordHash,
    },
  });
  console.log(`✓ Seeded admin user: ${adminEmail} / ${adminPassword}`);

  // ---- Default rate-limit rules ----
  const rules: Array<{
    route: string;
    method: string;
    plan: Plan;
    capacity: number;
    refillRatePerSecond: number;
    windowSeconds: number;
  }> = [
    { route: '/api/search', method: 'GET', plan: Plan.FREE, capacity: 20, refillRatePerSecond: 2, windowSeconds: 60 },
    { route: '/api/login-demo', method: 'POST', plan: Plan.FREE, capacity: 5, refillRatePerSecond: 0.5, windowSeconds: 60 },
    { route: '/api/search', method: 'GET', plan: Plan.PRO, capacity: 100, refillRatePerSecond: 10, windowSeconds: 60 },
    { route: '/api/search', method: 'GET', plan: Plan.ENTERPRISE, capacity: 1000, refillRatePerSecond: 50, windowSeconds: 60 },
    // A couple of extra defaults so the demo endpoints are all covered on FREE.
    { route: '/api/public', method: 'GET', plan: Plan.FREE, capacity: 100, refillRatePerSecond: 5, windowSeconds: 60 },
    { route: '/api/orders', method: 'GET', plan: Plan.FREE, capacity: 30, refillRatePerSecond: 1, windowSeconds: 60 },
  ];

  for (const rule of rules) {
    await prisma.rateLimitRule.upsert({
      where: {
        plan_method_route: { plan: rule.plan, method: rule.method, route: rule.route },
      },
      update: {
        capacity: rule.capacity,
        refillRatePerSecond: rule.refillRatePerSecond,
        windowSeconds: rule.windowSeconds,
        enabled: true,
      },
      create: {
        ...rule,
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
        enabled: true,
      },
    });
  }
  console.log(`✓ Seeded ${rules.length} default rate-limit rules`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
