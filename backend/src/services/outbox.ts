// backend/src/services/outbox.ts — notification outbox [D-04].
// API queues rows in the same tx as the report change; worker sends them.
import type pg from 'pg';
import { config } from '../config.js';

export type Template =
  | 'new_report' | 'sla_due_soon' | 'sla_breached'
  | 'reporter_receipt' | 'reporter_resolved' | 'reporter_private'
  | 'authority_sms' | 'volunteer_new_report' | 'volunteer_verify' | 'story_graph_export'
  | 'leak_report_copy';

export interface OutboxItem {
  report_id?: number | null;
  channel: 'email' | 'sms';
  recipient: string;
  template: Template;
  payload?: Record<string, unknown>;
  dedupe_key?: string;
}

export async function queue(client: pg.PoolClient | pg.Pool, item: OutboxItem): Promise<void> {
  await client.query(
    `INSERT INTO notification_outbox (report_id, channel, recipient, template, payload, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [item.report_id ?? null, item.channel, item.recipient, item.template,
     JSON.stringify(item.payload ?? {}), item.dedupe_key ?? null],
  );
}

// --- provider (worker side) --------------------------------------------------
// Email only — the SMS/Twilio path was removed (#24); the reporter is CC'd on
// the authority alert instead. `cc` rides in the outbox payload.

export function emailConfigured(): boolean {
  return Boolean(config.cloudflare.token || config.postmark.token);
}

async function sendViaPostmark(to: string, subject: string, text: string, cc?: string): Promise<void> {
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { 'X-Postmark-Server-Token': config.postmark.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ From: config.postmark.from, To: to, Cc: cc, Subject: subject, TextBody: text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`postmark ${res.status}: ${await res.text()}`);
}

/**
 * Name the cause of a failed Cloudflare call (CloudManagement#111). Uses the
 * error code + message, never the status alone: 9109 means an IP filter, an
 * account token on a /user endpoint, or a missing permission.
 */
export function cfDiagnose(status: number, body: unknown): string {
  const errors = (body as { errors?: Array<{ code?: number; message?: string }> } | null)?.errors;
  const first = Array.isArray(errors) && errors.length ? errors[0] : {};
  const code = first.code;
  const msg = String(first.message ?? '').toLowerCase();
  if (status === 0) return 'network_error';
  if (code === 9109 && msg.includes('location')) return 'ip_blocked: CF_API_TOKEN IP filter rejects this host';
  if (code === 9109 && msg.includes('user-level authentication')) return 'wrong_token_type: account token on a /user endpoint';
  if (code === 10105) return 'not_entitled: account or CF_EMAIL_FROM domain not onboarded to Email Sending';
  if (code === 9109 || code === 10000 || status === 403) return 'missing_scope: CF_API_TOKEN lacks Account > Email Sending:Send';
  if ((code !== undefined && [1000, 6003, 6111].includes(code)) || status === 401) {
    return 'invalid_token: CF_API_TOKEN revoked, wrong value, or stray whitespace';
  }
  if (status === 429) return 'rate_limited';
  if (status >= 500) return `server_error (${status})`;
  return `unknown (HTTP ${status})`;
}

async function sendViaCloudflare(to: string, subject: string, text: string, cc?: string): Promise<void> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.accountId}/email/sending/send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.cloudflare.token.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, from: config.cloudflare.from, cc, subject, text }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; errors?: unknown };
  if (!res.ok || body.success === false) {
    throw new Error(`cloudflare ${res.status} [${cfDiagnose(res.status, body)}]: ${JSON.stringify(body.errors ?? body)}`);
  }
}

async function sendEmail(to: string, subject: string, text: string, cc?: string): Promise<void> {
  if (config.cloudflare.token) return sendViaCloudflare(to, subject, text, cc);
  if (config.postmark.token) return sendViaPostmark(to, subject, text, cc);
  throw new Error('no email provider configured (CF_API_TOKEN or POSTMARK_TOKEN)');
}

export async function send(recipient: string, subject: string, text: string, cc?: string): Promise<void> {
  return sendEmail(recipient, subject, text, cc);
}
