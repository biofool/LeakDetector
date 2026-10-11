// backend/src/middleware/originCheck.ts — CSRF guard for public mutating
// endpoints (#55). Cross-site <form> POSTs need no preflight, so CORS alone
// doesn't stop a malicious page from driving these endpoints through a
// visitor's browser. Browsers always send Origin on form/fetch POSTs; curl
// and the peec.biz PHP proxy send none, so absent Origin stays allowed.
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { ApiError } from './errors.js';

const allowed = new Set<string>();
for (const u of [
  config.publicBaseUrl,
  config.apiPublicUrl,
  ...(config.corsOrigin === '*' ? [] : config.corsOrigin.split(',')),
]) {
  try {
    allowed.add(new URL(u.trim()).origin);
  } catch {
    console.warn(`[originCheck] ignoring unparseable configured origin: ${u}`);
  }
}

export function originCheck(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  // No Origin → not a cross-site browser request (proxy, curl, same-origin
  // GET nav). 'null' comes from sandboxed iframes/file — a CSRF vector, so
  // it is treated as untrusted.
  if (!origin) return next();
  if (origin === 'null' || !allowed.has(origin)) {
    return next(new ApiError(403, 'bad_origin', 'request origin is not allowed'));
  }
  next();
}
