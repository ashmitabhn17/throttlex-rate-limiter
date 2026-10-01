import request from 'supertest';
import { Plan } from '@prisma/client';
import { createApp } from '../src/app';
import { resetData, createTestApiKey, createRule, closeConnections } from './helpers';

const app = createApp();

describe('Protected API rate limiting', () => {
  beforeEach(async () => {
    await resetData();
  });

  afterAll(async () => {
    await closeConnections();
  });

  it('rejects requests with no API key', async () => {
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/api key/i);
  });

  it('rejects an invalid API key', async () => {
    const res = await request(app).get('/api/search').set('x-api-key', 'tx_live_deadbeef');
    expect(res.status).toBe(401);
  });

  it('rejects a disabled API key', async () => {
    const { raw } = await createTestApiKey({ status: 'DISABLED' });
    const res = await request(app).get('/api/search').set('x-api-key', raw);
    expect(res.status).toBe(403);
  });

  it('allows a request and returns standard rate-limit headers', async () => {
    const { raw } = await createTestApiKey({ plan: Plan.FREE });
    await createRule({ route: '/api/search', method: 'GET', plan: Plan.FREE, capacity: 10, refillRatePerSecond: 1 });

    const res = await request(app).get('/api/search').set('x-api-key', raw);
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(Number(res.headers['x-ratelimit-remaining'])).toBe(9);
    expect(res.headers['x-ratelimit-policy']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('returns 429 with Retry-After once the bucket is exhausted', async () => {
    const { raw } = await createTestApiKey({ plan: Plan.FREE });
    // Capacity 3, no refill within the test window.
    await createRule({ route: '/api/search', method: 'GET', plan: Plan.FREE, capacity: 3, refillRatePerSecond: 0 });

    for (let i = 0; i < 3; i++) {
      const ok = await request(app).get('/api/search').set('x-api-key', raw);
      expect(ok.status).toBe(200);
    }

    const blocked = await request(app).get('/api/search').set('x-api-key', raw);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      error: 'Too many requests',
      remaining: 0,
    });
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('never allows more than capacity under concurrent load (atomicity)', async () => {
    const { raw } = await createTestApiKey({ plan: Plan.FREE });
    const capacity = 5;
    await createRule({ route: '/api/search', method: 'GET', plan: Plan.FREE, capacity, refillRatePerSecond: 0 });

    // Fire many requests in parallel against a fresh, full bucket.
    const N = 50;
    const responses = await Promise.all(
      Array.from({ length: N }, () => request(app).get('/api/search').set('x-api-key', raw)),
    );

    const allowed = responses.filter((r) => r.status === 200).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    // The Lua script guarantees the accounting is exact: exactly `capacity`
    // requests succeed even though all N raced for the same bucket.
    expect(allowed).toBe(capacity);
    expect(blocked).toBe(N - capacity);
  });
});
