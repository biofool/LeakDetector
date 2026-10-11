// backend/src/middleware/staffAuth.ts — JWT staff auth [D-05].
// #53 — every authenticated request re-reads the user row: a deactivated or
// deleted account is rejected on the next request instead of living out the
// 8 h token, and role/council changes take effect immediately.
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
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
  if (!token) return next(); // no header → public access
  void (async () => {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    const { rows } = await query(
      'SELECT role, council_id, display_name FROM users WHERE id = $1 AND is_active',
      [payload.sub],
    );
    const user = rows[0];
    if (!user) throw new ApiError(401, 'invalid_token', 'account is deactivated or no longer exists');
    req.user = {
      id: payload.sub as string,
      role: user.role,
      council_id: user.council_id ?? null,
      display_name: user.display_name,
    };
  })()
    .then(() => next())
    .catch((e) => {
      // a present-but-invalid token means the caller thinks they're staff —
      // don't silently downgrade them to the public view
      next(e instanceof ApiError ? e : new ApiError(401, 'invalid_token', 'token is invalid or expired'));
    });
}

export function requireStaff(req: Request, _res: Response, next: NextFunction): void {
  optionalStaff(req, _res, (err?: unknown) => {
    if (err) return next(err);
    if (!req.user) return next(new ApiError(401, 'unauthenticated', 'staff login required'));
    next();
  });
}

/** platform_admin sees all; others only their own council's reports. */
export function canAccess(user: StaffUser, councilId: number): boolean {
  return user.role === 'platform_admin' || user.council_id === councilId;
}
