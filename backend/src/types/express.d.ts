import { JwtPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      // Populated by requireAuth for admin (dashboard) routes.
      adminUser?: JwtPayload;
    }
  }
}

export {};
