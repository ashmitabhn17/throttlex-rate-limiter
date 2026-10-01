import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';

import authRoutes from './routes/auth';
import apiKeyRoutes from './routes/apiKeys';
import ruleRoutes from './routes/rules';
import analyticsRoutes from './routes/analytics';
import logRoutes from './routes/logs';
import protectedRoutes from './routes/protected';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Needed so req.ip reflects X-Forwarded-For behind a proxy.
  app.set('trust proxy', true);

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
      // Expose rate-limit headers so the browser playground can read them.
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-RateLimit-Policy',
        'X-RateLimit-Degraded',
        'Retry-After',
      ],
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'throttlex-backend' }));

  // Admin (dashboard) API — JWT protected inside each router.
  app.use('/auth', authRoutes);
  app.use('/admin/api-keys', apiKeyRoutes);
  app.use('/admin/rules', ruleRoutes);
  app.use('/admin/analytics', analyticsRoutes);
  app.use('/admin/logs', logRoutes);

  // Protected demo APIs — guarded by x-api-key + rate limiter.
  app.use('/api', protectedRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
