import { Router } from 'express';
import { Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

// GET /admin/analytics/summary
router.get('/summary', async (_req, res, next) => {
  try {
    const [totalRequests, allowedRequests, blockedRequests, activeApiKeys, totalApiKeys] = await Promise.all([
      prisma.requestLog.count(),
      prisma.requestLog.count({ where: { status: RequestStatus.ALLOWED } }),
      prisma.requestLog.count({ where: { status: RequestStatus.BLOCKED } }),
      prisma.apiKey.count({ where: { status: 'ACTIVE' } }),
      prisma.apiKey.count(),
    ]);

    // Average requests per minute over the last hour.
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const lastHour = await prisma.requestLog.count({ where: { createdAt: { gte: since } } });
    const avgRequestsPerMinute = Math.round((lastHour / 60) * 100) / 100;

    // Most-limited (blocked) route.
    const topBlocked = await prisma.requestLog.groupBy({
      by: ['route'],
      where: { status: RequestStatus.BLOCKED },
      _count: { route: true },
      orderBy: { _count: { route: 'desc' } },
      take: 1,
    });

    res.json({
      totalRequests,
      allowedRequests,
      blockedRequests,
      activeApiKeys,
      totalApiKeys,
      avgRequestsPerMinute,
      topLimitedRoute: topBlocked[0]?.route ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/analytics/requests-over-time?hours=24
// Buckets allowed vs blocked counts per hour.
router.get('/requests-over-time', async (req, res, next) => {
  try {
    const hours = Math.min(Math.max(parseInt(String(req.query.hours ?? '24'), 10) || 24, 1), 168);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Raw SQL for time-bucketing by hour (Postgres date_trunc).
    const rows = await prisma.$queryRaw<
      Array<{ bucket: Date; status: RequestStatus; count: bigint }>
    >(Prisma.sql`
      SELECT date_trunc('hour', "createdAt") AS bucket, "status", COUNT(*)::bigint AS count
      FROM "RequestLog"
      WHERE "createdAt" >= ${since}
      GROUP BY bucket, "status"
      ORDER BY bucket ASC
    `);

    // Reshape into { time, allowed, blocked } series.
    const map = new Map<string, { time: string; allowed: number; blocked: number }>();
    for (const row of rows) {
      const time = row.bucket.toISOString();
      const entry = map.get(time) ?? { time, allowed: 0, blocked: 0 };
      if (row.status === RequestStatus.ALLOWED) entry.allowed = Number(row.count);
      else entry.blocked = Number(row.count);
      map.set(time, entry);
    }

    res.json({ series: Array.from(map.values()) });
  } catch (err) {
    next(err);
  }
});

// GET /admin/analytics/top-routes?limit=5
router.get('/top-routes', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '5'), 10) || 5, 1), 50);
    const grouped = await prisma.requestLog.groupBy({
      by: ['route', 'method'],
      _count: { _all: true },
      orderBy: { _count: { route: 'desc' } },
      take: limit,
    });

    // Add blocked counts per route for context.
    const results = await Promise.all(
      grouped.map(async (g) => {
        const blocked = await prisma.requestLog.count({
          where: { route: g.route, method: g.method, status: RequestStatus.BLOCKED },
        });
        return { route: g.route, method: g.method, total: g._count._all, blocked };
      }),
    );

    res.json({ routes: results });
  } catch (err) {
    next(err);
  }
});

export default router;
