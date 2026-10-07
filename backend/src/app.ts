// backend/src/app.ts — express app, exported for tests; index.ts listens.
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import reportsRouter from './routes/reports.js';
import { errorHandler, notFound } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Railway runs behind a proxy (spec §3)
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} ${Date.now() - start}ms`));
    next();
  });
  app.use('/uploads', express.static(config.uploadDir));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
