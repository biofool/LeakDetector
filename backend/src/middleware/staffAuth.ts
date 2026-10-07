// backend/src/middleware/staffAuth.ts — JWT staff auth [D-05].
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError } from './errors.js';
import type { StaffUser } from '../types.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: StaffUser;
  }
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

export function optionalStaff(req: Request, _res: Response, next: NextFunction): void {
  const token = bearer(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
      req.user = { id: payload.sub as string, role: payload.role, council_id: payload.council_id ?? null, display_name: payload.name };
    } catch { /* invalid token → treat as public */ }
  }
  next();
}

export function requireStaff(req: Request, _res: Response, next: NextFunction): void {
  optionalStaff(req, _res, () => {
    if (!req.user) return next(new ApiError(401, 'unauthenticated', 'staff login required'));
    next();
  });
}

/** platform_admin sees all; others only their own council's reports. */
export function canAccess(user: StaffUser, councilId: number): boolean {
  return user.role === 'platform_admin' || user.council_id === councilId;
}
