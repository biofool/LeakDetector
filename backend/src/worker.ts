// backend/src/worker.ts — drains notification_outbox every 30 s and runs
// the SLA sweep every 5 min [D-04]. Separate Railway service: `npm run worker`.
import { pool } from './db.js';
import { config } from './config.js';
import { queue, send } from './services/outbox.js';
import { toRef } from './util/ref.js';

const TEMPLATES: Record<string, (p: Record<string, unknown>) => { subject: string; text: string }> = {
  new_report: (p) => ({
    subject: `[LeakDetector] New ${p.category} leak — ${p.ref}`,
    text: `A new ${p.severity} ${p.category} leak was reported in ${p.zone}.\nSLA due: ${p.sla_due_at}\n${p.tracking_url}`,
  }),
  sla_due_soon: (p) => ({
    subject: `[LeakDetector] SLA due soon — ${p.ref}`,
    text: `${p.ref} (${p.severity} ${p.category}) is due at ${p.sla_due_at}.\n${p.tracking_url}`,
  }),
  sla_breached: (p) => ({
    subject: `[LeakDetector] SLA BREACHED — ${p.ref}`,
    text: `${p.ref} (${p.severity} ${p.category}) breached its SLA at ${p.sla_due_at}.\n${p.tracking_url}`,
  }),
  reporter_receipt: (p) => ({
    subject: `We’ve logged your leak report ${p.ref}`,
    text: `Thanks — ${p.ref} is now with the council. Track it here: ${p.tracking_url}`,
  }),
  reporter_resolved: (p) => ({
    subject: `${p.ref} has been marked fixed`,
    text: `Good news — ${p.ref} has been marked resolved.${p.parent_ref ? ` (It was a duplicate of ${p.parent_ref}.)` : ''}`,
  }),
  reporter_private: (p) => ({
    subject: `${p.ref} is on private property`,
    text: `${p.ref} was checked and the leak is on the owner’s side — please contact the owner or a plumber.`,
  }),
};

// NOTE: row locks are held while sends are in flight (correctness — a second
// worker can't double-send the same row). Bounded to 20 rows per cycle;
// revisit if multiple workers run at scale (e.g. a claimed_at column).
let draining = false;
async function drainOutbox(): Promise<void> {
  if (draining) return; // previous cycle still running — don't overlap
  draining = true;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM notification_outbox
       WHERE status = 'pending' AND send_after <= now()
       ORDER BY id LIMIT 20
       FOR UPDATE SKIP LOCKED`,
    );
    const providerMissing = (ch: string) =>
      ch === 'email' ? !config.postmark.token : !(config.twilio.sid && config.twilio.token);
    let deferred = 0;
    for (const row of rows) {
      // Unknown template is a permanent failure — mark failed, never defer.
      if (!TEMPLATES[row.template]) {
        await client.query(
          `UPDATE notification_outbox SET status = 'failed', last_error = $1 WHERE id = $2`,
          [`unknown template ${row.template}`, row.id],
        );
        console.error(`[worker] outbox ${row.id} failed permanently: unknown template ${row.template}`);
        continue;
      }
      // Missing provider config is not a delivery failure — don't burn
      // attempts; defer and leave the row pending (see .env.example).
      if (providerMissing(row.channel)) {
        await client.query(
          `UPDATE notification_outbox SET send_after = now() + interval '10 minutes' WHERE id = $1`,
          [row.id],
        );
        deferred++;
        continue;
      }
      const msg = TEMPLATES[row.template](row.payload ?? {});
      try {
        await send(row.channel, row.recipient, msg.subject, msg.text);
        await client.query(
          `UPDATE notification_outbox SET status = 'sent', sent_at = now() WHERE id = $1`,
          [row.id],
        );
      } catch (e) {
        const attempts = row.attempts + 1;
        const err = e instanceof Error ? e.message : String(e);
        if (attempts >= 5) {
          await client.query(
            `UPDATE notification_outbox SET status = 'failed', attempts = $1, last_error = $2 WHERE id = $3`,
            [attempts, err, row.id],
          );
          console.error(`[worker] outbox ${row.id} failed permanently: ${err}`);
        } else {
          await client.query(
            `UPDATE notification_outbox SET attempts = $1, last_error = $2,
               send_after = now() + (interval '1 minute' * $3) WHERE id = $4`,
            [attempts, err, 2 ** attempts, row.id],
          );
          console.warn(`[worker] outbox ${row.id} attempt ${attempts} failed: ${err}`);
        }
      }
    }
    if (deferred) console.warn(`[worker] ${deferred} outbox row(s) deferred — notification provider not configured`);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[worker] drain failed:', e);
  } finally {
    client.release();
    draining = false;
  }
}

async function slaSweep(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT r.id, r.category, r.severity, r.sla_due_at, z.name AS zone_name,
              z.alert_emails, z.alert_sms,
              CASE WHEN r.sla_due_at < now() THEN 'sla_breached' ELSE 'sla_due_soon' END AS tpl
       FROM reports r
       JOIN council_zones z ON z.id = r.council_zone_id
       WHERE r.status IN ('received','investigating','contractor_assigned')
         AND r.is_duplicate_of IS NULL
         AND ( r.sla_due_at < now()
               OR r.sla_due_at - now() <= LEAST(interval '2 hours', (r.sla_due_at - r.created_at) * 0.25) )`,
    );
    for (const r of rows) {
      const payload = {
        ref: toRef(r.id), category: r.category, severity: r.severity,
        zone: r.zone_name, sla_due_at: r.sla_due_at,
        tracking_url: `${config.publicBaseUrl}/r/${r.id}`,
      };
      for (const email of r.alert_emails) {
        await queue(client, { report_id: Number(r.id), channel: 'email', recipient: email, template: r.tpl, payload, dedupe_key: `${r.tpl}:${r.id}:${email}` });
      }
      if (r.tpl === 'sla_breached' && r.severity === 'major') {
        for (const sms of r.alert_sms) {
          await queue(client, { report_id: Number(r.id), channel: 'sms', recipient: sms, template: r.tpl, payload, dedupe_key: `${r.tpl}:${r.id}:${sms}` });
        }
      }
    }
  } catch (e) {
    console.error('[worker] SLA sweep failed:', e);
  } finally {
    client.release();
  }
}

console.log(`worker started: outbox every ${config.outboxIntervalMs}ms, SLA sweep every ${config.slaSweepMs}ms`);
setInterval(drainOutbox, config.outboxIntervalMs);
setInterval(slaSweep, config.slaSweepMs);
void drainOutbox();
void slaSweep();
