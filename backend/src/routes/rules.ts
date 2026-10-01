import { Router } from 'express';
import { z } from 'zod';
import { Plan, RateLimitAlgorithm } from '@prisma/client';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { notFound, conflict } from '../utils/httpError';

const router = Router();
router.use(requireAuth);

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const createSchema = z.object({
  route: z.string().min(1).startsWith('/'),
  method: z.enum(HTTP_METHODS),
  plan: z.nativeEnum(Plan),
  algorithm: z.nativeEnum(RateLimitAlgorithm).default(RateLimitAlgorithm.TOKEN_BUCKET),
  capacity: z.number().int().positive(),
  refillRatePerSecond: z.number().positive(),
  windowSeconds: z.number().int().positive().default(60),
  enabled: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

// GET /admin/rules
router.get('/', async (_req, res, next) => {
  try {
    const rules = await prisma.rateLimitRule.findMany({
      orderBy: [{ plan: 'asc' }, { route: 'asc' }],
    });
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

// POST /admin/rules
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const existing = await prisma.rateLimitRule.findUnique({
      where: { plan_method_route: { plan: data.plan, method: data.method, route: data.route } },
    });
    if (existing) throw conflict('A rule for this plan + method + route already exists');

    const rule = await prisma.rateLimitRule.create({ data });
    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/rules/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const existing = await prisma.rateLimitRule.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Rule not found');

    const rule = await prisma.rateLimitRule.update({ where: { id: req.params.id }, data });
    res.json({ rule });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/rules/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.rateLimitRule.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Rule not found');
    await prisma.rateLimitRule.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
