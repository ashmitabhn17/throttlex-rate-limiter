import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { unauthorized } from '../utils/httpError';

/**
 * Protects admin/dashboard routes. Accepts a JWT from either the
 * Authorization: Bearer <token> header or the `tx_token` cookie.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    let token: string | undefined;

    if (header?.startsWith('Bearer ')) {
      token = header.slice('Bearer '.length).trim();
    } else if (req.cookies?.tx_token) {
      token = req.cookies.tx_token;
    }

    if (!token) {
      throw unauthorized('Missing authentication token');
    }

    req.adminUser = verifyToken(token);
    next();
  } catch (err) {
    if ((err as { name?: string }).name === 'HttpError') {
      next(err);
    } else {
      next(unauthorized('Invalid or expired token'));
    }
  }
}
