// backend/src/config.ts — env-driven config; .env is dev-only.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Node >=20.6 can load .env natively; ignore failure when absent.
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  try { process.loadEnvFile(envPath); } catch { /* malformed .env — rely on real env */ }
}

const env = (key: string, fallback = ''): string => process.env[key] ?? fallback;

export const config = {
  port: Number(env('PORT', '8080')),
  databaseUrl: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5433/leakdetector'),
  publicBaseUrl: env('PUBLIC_BASE_URL', 'http://127.0.0.1:5173'),
  apiPublicUrl: env('API_PUBLIC_URL', 'http://127.0.0.1:8080'),

  jwtSecret: env('JWT_SECRET', 'dev-insecure-secret'),
  jwtTtlHours: Number(env('JWT_TTL_HOURS', '8')),

  uploadDir: env('UPLOAD_DIR', 'data/uploads'),
  s3: {
    bucket: env('S3_BUCKET'),
    region: env('S3_REGION', 'auto'),
    endpoint: env('S3_ENDPOINT') || undefined,
    accessKeyId: env('S3_ACCESS_KEY_ID'),
    secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
    publicBaseUrl: env('S3_PUBLIC_BASE_URL'),
  },

  postmark: { token: env('POSTMARK_TOKEN'), from: env('POSTMARK_FROM', 'leaks@localhost') },
  twilio: { sid: env('TWILIO_ACCOUNT_SID'), token: env('TWILIO_AUTH_TOKEN'), from: env('TWILIO_FROM') },

  outboxIntervalMs: Number(env('OUTBOX_INTERVAL_MS', '30000')),
  slaSweepMs: Number(env('SLA_SWEEP_MS', '300000')),
};

export const s3Enabled = Boolean(config.s3.bucket);
