import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`\n  ⚡ ThrottleX backend listening on http://localhost:${env.port}`);
  console.log(`     env: ${env.nodeEnv} | fail-${env.rateLimitFailOpen ? 'open' : 'closed'}\n`);
});

// Graceful shutdown.
const shutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
