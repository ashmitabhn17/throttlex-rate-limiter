import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { requireAuth } from '../middleware/requireAuth';
import { unauthorized, notFound } from '../utils/httpError';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw unauthorized('Invalid credentials');

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw unauthorized('Invalid credentials');

    const token = signToken({ sub: user.id, email: user.email });

    // Also set an httpOnly cookie for browser-based dashboard sessions.
    res.cookie('tx_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('tx_token');
  res.json({ ok: true });
});

// GET /auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.adminUser!.sub },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!user) throw notFound('User not found');
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
