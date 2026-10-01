import { Router } from 'express';
import { z } from 'zod';
import { Plan, ApiKeyStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { generateApiKey } from '../utils/apiKey';
import { notFound } from '../utils/httpError';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  plan: z.nativeEnum(Plan).default(Plan.FREE),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  plan: z.nativeEnum(Plan).optional(),
  status: z.nativeEnum(ApiKeyStatus).optional(),
});

// Never leak the hash; expose only display-safe fields.
const publicSelect = {
  id: true,
  name: true,
  keyPrefix: true,
  plan: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
} as const;

// GET /admin/api-keys
router.get('/', async (_req, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      select: publicSelect,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ apiKeys: keys });
  } catch (err) {
    next(err);
  }
});

// POST /admin/api-keys  — returns the raw key exactly once.
router.post('/', async (req, res, next) => {
  try {
    const { name, plan } = createSchema.parse(req.body);
    const { raw, keyHash, keyPrefix } = generateApiKey();

    const created = await prisma.apiKey.create({
      data: { name, plan, keyHash, keyPrefix },
      select: publicSelect,
    });

    res.status(201).json({
      apiKey: created,
      // Shown once — the client must copy it now; it is never retrievable again.
      rawKey: raw,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/api-keys/:id  — rename, change plan, enable/disable.
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const existing = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('API key not found');

    const updated = await prisma.apiKey.update({
      where: { id: req.params.id },
      data,
      select: publicSelect,
    });
    res.json({ apiKey: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/api-keys/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('API key not found');
    await prisma.apiKey.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
