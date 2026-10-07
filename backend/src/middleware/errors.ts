// backend/src/middleware/errors.ts — spec error shape + helpers.
import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_failed',
        message: err.issues[0]?.message ?? 'invalid request',
        details: err.issues.map((i) => ({ field: i.path.join('.'), issue: i.message })),
      },
    });
    return;
  }
  if (err instanceof MulterError) {
    // spec §3: 413 photo too large; other multipart violations are bad requests
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const code = err.code === 'LIMIT_FILE_SIZE' ? 'photo_too_large' : 'validation_failed';
    res.status(status).json({ error: { code, message: err.message } });
    return;
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: { code: 'internal', message: 'internal error' } });
}

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ error: { code: 'not_found', message: 'not found' } });
};
