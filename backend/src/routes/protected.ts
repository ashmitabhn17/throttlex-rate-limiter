import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit';

// Demo endpoints that exist only to be protected by the rate limiter.
// Every request passes through the `rateLimit` gate first.
const router = Router();
router.use(rateLimit);

// GET /api/public
router.get('/public', (_req, res) => {
  res.json({ message: 'This is a public endpoint', data: { ok: true } });
});

// GET /api/search?q=...
router.get('/search', (req, res) => {
  const q = String(req.query.q ?? '');
  res.json({
    message: 'Search results',
    query: q,
    results: Array.from({ length: 3 }, (_, i) => ({ id: i + 1, title: `Result ${i + 1} for "${q}"` })),
  });
});

// POST /api/login-demo
router.post('/login-demo', (req, res) => {
  const { username } = (req.body ?? {}) as { username?: string };
  res.json({ message: 'Login attempt accepted (demo)', username: username ?? null, token: 'demo-session-token' });
});

// GET /api/orders
router.get('/orders', (_req, res) => {
  res.json({
    message: 'Orders',
    orders: Array.from({ length: 2 }, (_, i) => ({ id: 1000 + i, total: (i + 1) * 25.5, status: 'shipped' })),
  });
});

export default router;
