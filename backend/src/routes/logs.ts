import { Router } from 'express';
import { z } from 'zod';
import { Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  status: z.nativeEnum(RequestStatus).optional(),
  apiKeyId: z.string().optional(),
  route: z.string().optional(),
  method: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /admin/logs — recent request logs with filters.
router.get('/', async (req, res, next) => {
  try {
    const { status, apiKeyId, route, method, limit, offset } = querySchema.parse(req.query);

    const where: Prisma.RequestLogWhereInput = {
      ...(status ? { status } : {}),
      ...(apiKeyId ? { apiKeyId } : {}),
      ...(route ? { route: { contains: route, mode: 'insensitive' } } : {}),
      ...(method ? { method: method.toUpperCase() } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.requestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { apiKey: { select: { id: true, name: true, keyPrefix: true, plan: true } } },
      }),
      prisma.requestLog.count({ where }),
    ]);

    res.json({ logs, total, limit, offset });
  } catch (err) {
    next(err);
  }
});

export default router;
