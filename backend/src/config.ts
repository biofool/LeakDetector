// backend/src/config.ts — env-driven config; .env is dev-only.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Node >=20.6 can load .env natively; ignore failure when absent.
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  try { process.loadEnvFile(envPath); } catch { /* malformed .env — rely on real env */ }
}

const env = (key: string, fallback = ''): string => process.env[key] ?? fallback;

// Canonical CF token order (biofool/CloudManagement#154) — thin TS port of
// biofool_secrets.resolve_token: first non-empty cleaned value wins
// (whitespace and one pair of surrounding quotes stripped).
const cleanToken = (raw: string | undefined): string => {
  let v = (raw ?? '').trim();
  if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) {
    v = v.slice(1, -1).trim();
  }
  return v;
};
const resolveCft = (...names: string[]): string => {
  for (const name of names) {
    const v = cleanToken(process.env[name]);
    if (v) return v;
  }
  return '';
};

// #49 — a missing JWT_SECRET must never fall back to a public value in
// production: anyone could sign staff tokens. Dev/test keep the default.
const jwtSecret = env('JWT_SECRET');
if (!jwtSecret && env('NODE_ENV') === 'production') {
  throw new Error('JWT_SECRET is required when NODE_ENV=production — refusing insecure default');
}

export const config = {
  port: Number(env('PORT', '8080')),
  databaseUrl: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5433/leakdetector'),
  publicBaseUrl: env('PUBLIC_BASE_URL', 'http://127.0.0.1:5173'),
  apiPublicUrl: env('API_PUBLIC_URL', 'http://127.0.0.1:8080'),
  // Comma-separated allowed origins for CORS; '*' (default) suits the public
  // API + Bearer auth. Set to the deployed web origin for tighter posture.
  corsOrigin: env('CORS_ORIGIN', '*'),

  jwtSecret: jwtSecret || 'dev-insecure-secret',
  jwtTtlHours: Number(env('JWT_TTL_HOURS', '8')),

  // #48 — shared secret between the peec.biz PHP proxy and this API. When
  // set, only requests carrying `X-LD-Proxy-Secret: <value>` get their
  // rate-limit IP from `X-LD-Client-Ip`; everything else (including direct
  // origin hits with a spoofed X-Forwarded-For) keys on the socket address.
  // Unset → never trust client-supplied IP headers.
  proxySecret: env('PROXY_SHARED_SECRET'),

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
  // Cloudflare Email Service (REST) — preferred provider when a CF token is
  // set. POST /accounts/{id}/email/sending/send. From domain must be onboarded
  // to Email Sending in the Cloudflare dashboard (cf-bounce records).
  // CF_API_TOKEN (dedicated Email Sending token) wins, then the shared chain
  // LEAK_CFT → LEAK_CFT_dup → CLOUDFLARE_API_TOKEN → CFT (#154).
  cloudflare: {
    accountId: env('CF_ACCOUNT_ID'),
    token: resolveCft('CF_API_TOKEN', 'LEAK_CFT', 'LEAK_CFT_dup', 'CLOUDFLARE_API_TOKEN', 'CFT'),
    from: env('CF_EMAIL_FROM', 'leaks@localhost'),
  },
  // Generic HTTPS SMS gateway for councils on the 'sms' submission channel
  // (#35) — POST {to, text}. Unset → sms rows defer like missing Postmark.
  smsGateway: { url: env('SMS_GATEWAY_URL'), token: env('SMS_GATEWAY_TOKEN') },
  // Receives authority alerts when a zone's alert_emails is empty (real TA
  // boundaries import with none until councils supply duty addresses) [#25].
  alertFallbackEmail: env('ALERT_FALLBACK_EMAIL'),
  // One public-fields-only export email per new report to the story_graph
  // corpus ingest mailbox (#43). Empty → export disabled.
  storyGraphIngestEmail: env('STORY_GRAPH_INGEST_EMAIL'),
  // Ops copy of every new report — a human forwards it to the correct
  // authority using the routing note in the body. Empty → disabled.
  leakReportsEmail: env('LEAK_REPORTS_EMAIL'),

  outboxIntervalMs: Number(env('OUTBOX_INTERVAL_MS', '30000')),
  slaSweepMs: Number(env('SLA_SWEEP_MS', '300000')),
};

export const s3Enabled = Boolean(config.s3.bucket);
