// Ensure tests run in test mode. These tests require a live Postgres + Redis
// (start them with `docker compose up -d` and run `npm run prisma:migrate`).
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_FAIL_OPEN = process.env.RATE_LIMIT_FAIL_OPEN ?? 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
