// backend/src/services/outbox.ts — notification outbox [D-04].
// API queues rows in the same tx as the report change; worker sends them.
import type pg from 'pg';
import { config } from '../config.js';

export type Template =
  | 'new_report' | 'sla_due_soon' | 'sla_breached'
  | 'reporter_receipt' | 'reporter_resolved' | 'reporter_private'
  | 'authority_sms' | 'volunteer_new_report';

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

async function sendViaCloudflare(to: string, subject: string, text: string, cc?: string): Promise<void> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.accountId}/email/sending/send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.cloudflare.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, from: config.cloudflare.from, cc, subject, text }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; errors?: unknown };
  if (!res.ok || body.success === false) {
    throw new Error(`cloudflare ${res.status}: ${JSON.stringify(body.errors ?? body)}`);
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
