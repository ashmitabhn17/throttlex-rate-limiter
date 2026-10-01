import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),

  databaseUrl: required('DATABASE_URL', 'postgresql://throttlex:throttlex@localhost:5432/throttlex?schema=public'),
  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),

  jwtSecret: required('JWT_SECRET', 'change-me-in-production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  // Fail-open: if Redis is unreachable, allow traffic through rather than block it.
  // This favours availability of the protected APIs over strict enforcement.
  rateLimitFailOpen: (process.env.RATE_LIMIT_FAIL_OPEN ?? 'true') === 'true',

  isTest: process.env.NODE_ENV === 'test',
};
