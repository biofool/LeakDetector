// backend/src/app.ts — express app, exported for tests; index.ts listens.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import reportsRouter from './routes/reports.js';
import councilsRouter from './routes/councils.js';
import volunteersRouter from './routes/volunteers.js';
import { errorHandler, notFound } from './middleware/errors.js';

export function createApp() {
  const app = express();
  // #48 — do NOT trust proxy headers: the origin is publicly reachable, so a
  // client-supplied X-Forwarded-For is attacker-controlled. Rate limiting
  // uses middleware/clientIp.ts, which only honours an asserted client IP
  // alongside the X-LD-Proxy-Secret sent by the peec.biz PHP proxy.
  // crossOriginResourcePolicy must stay cross-origin — the PWA loads
  // /uploads photos from this API on a different origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  // urlencoded: browser confirm/unsubscribe/verify form posts (#50, #51).
  app.use(express.urlencoded({ extended: false, limit: '8kb' }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} ${Date.now() - start}ms`));
    next();
  });
  app.use('/uploads', express.static(config.uploadDir));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/councils', councilsRouter);
  app.use('/api/v1/volunteers', volunteersRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
