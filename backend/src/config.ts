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
  // Comma-separated allowed origins for CORS; '*' (default) suits the public
  // API + Bearer auth. Set to the deployed web origin for tighter posture.
  corsOrigin: env('CORS_ORIGIN', '*'),

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
  // Cloudflare Email Service (REST) — preferred provider when CF_API_TOKEN is
  // set. POST /accounts/{id}/email/sending/send. From domain must be onboarded
  // to Email Sending in the Cloudflare dashboard (cf-bounce records).
  cloudflare: {
    accountId: env('CF_ACCOUNT_ID'),
    token: env('CF_API_TOKEN'),
    from: env('CF_EMAIL_FROM', 'leaks@localhost'),
  },
  // Generic HTTPS SMS gateway for councils on the 'sms' submission channel
  // (#35) — POST {to, text}. Unset → sms rows defer like missing Postmark.
  smsGateway: { url: env('SMS_GATEWAY_URL'), token: env('SMS_GATEWAY_TOKEN') },
  // Receives authority alerts when a zone's alert_emails is empty (real TA
  // boundaries import with none until councils supply duty addresses) [#25].
  alertFallbackEmail: env('ALERT_FALLBACK_EMAIL'),

  outboxIntervalMs: Number(env('OUTBOX_INTERVAL_MS', '30000')),
  slaSweepMs: Number(env('SLA_SWEEP_MS', '300000')),
};

export const s3Enabled = Boolean(config.s3.bucket);
