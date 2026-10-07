// backend/src/middleware/rateLimit.ts — fixed-window in-memory limiter.
// Per-process; fine for a single-instance pilot, swap for Redis at scale.
import type { Request, Response, NextFunction } from 'express';

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(bucket: string, limit: number, windowMs: number) {
  if (process.env.DISABLE_RATE_LIMIT) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || entry.reset <= now) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > limit) {
      res.status(429).json({ error: { code: 'rate_limited', message: 'too many requests, try again later' } });
      return;
    }
    next();
  };
}
