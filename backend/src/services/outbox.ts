// backend/src/services/outbox.ts — notification outbox [D-04].
// API queues rows in the same tx as the report change; worker sends them.
import type pg from 'pg';
import { config } from '../config.js';

export type Template =
  | 'new_report' | 'sla_due_soon' | 'sla_breached'
  | 'reporter_receipt' | 'reporter_resolved' | 'reporter_private';

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

// --- providers (worker side) -------------------------------------------------

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!config.postmark.token) throw new Error('POSTMARK_TOKEN not configured');
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { 'X-Postmark-Server-Token': config.postmark.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ From: config.postmark.from, To: to, Subject: subject, TextBody: text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`postmark ${res.status}: ${await res.text()}`);
}

async function sendSms(to: string, body: string): Promise<void> {
  if (!config.twilio.sid || !config.twilio.token) throw new Error('TWILIO_* not configured');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilio.sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.twilio.sid}:${config.twilio.token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: config.twilio.from, To: to, Body: body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`);
}

export async function send(channel: 'email' | 'sms', recipient: string, subject: string, text: string): Promise<void> {
  if (channel === 'email') return sendEmail(recipient, subject, text);
  return sendSms(recipient, text);
}
