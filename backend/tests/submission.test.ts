// backend/tests/submission.test.ts — council submission channels (#35):
// 'sms' routes the authority alert to channel_config.sms_number with the
// compact authority_sms template; unimplemented channels fall back to email.
import { afterAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

const app = createApp();
afterAll(() => pool.end());

// Whangarei — outside every other test's points on a shared test DB.
const SPOT = { lat: -35.7275, lng: 174.3166 };
const TINY = 'SRID=4326;MULTIPOLYGON(((174.3 -35.8, 174.4 -35.8, 174.4 -35.7, 174.3 -35.7, 174.3 -35.8)))';

async function makeCouncil(name: string, channel: string, cfg: object, emails: string[] = []) {
  const { rows } = await pool.query(
    `INSERT INTO councils (name, submission_channel, channel_config)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (name) DO UPDATE
       SET submission_channel = EXCLUDED.submission_channel,
           channel_config = EXCLUDED.channel_config
     RETURNING id`,
    [name, channel, JSON.stringify(cfg)],
  );
  await pool.query(
    `INSERT INTO council_zones (council_id, name, boundary, alert_emails)
     VALUES ($1, 'All areas', ST_GeomFromEWKT($2), $3::text[])
     ON CONFLICT (council_id, name) DO UPDATE SET alert_emails = EXCLUDED.alert_emails`,
    [rows[0].id, TINY, emails],
  );
  return rows[0].id as number;
}

const report = () => request(app).post('/api/v1/reports')
  .field('category', 'road').field('severity', 'minor')
  .field('lat', String(SPOT.lat)).field('lng', String(SPOT.lng));

const outboxFor = (id: number) => pool.query(
  `SELECT channel, recipient, template, payload FROM notification_outbox
   WHERE report_id = $1 AND template IN ('new_report','authority_sms') ORDER BY id`,
  [id],
);

describe('submission channels', () => {
  it('sms council queues an authority_sms row to the configured number', async () => {
    await makeCouncil('SMSville District', 'sms', { sms_number: '3130' });
    const create = await report();
    expect(create.status).toBe(201);
    const { rows } = await outboxFor(create.body.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe('sms');
    expect(rows[0].recipient).toBe('3130');
    expect(rows[0].template).toBe('authority_sms');
    expect(Number(rows[0].payload.lat)).toBeCloseTo(SPOT.lat, 4);
    expect(Number(rows[0].payload.lng)).toBeCloseTo(SPOT.lng, 4);
    expect(rows[0].payload.tracking_url).toContain('/r/');
  });

  it('sms council without sms_number falls back to email', async () => {
    await makeCouncil('SMSville District', 'sms', {}, ['duty@smsville.govt.nz']);
    const create = await report();
    const { rows } = await outboxFor(create.body.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe('email');
    expect(rows[0].recipient).toBe('duty@smsville.govt.nz');
  });

  it('unimplemented channel falls back to email', async () => {
    await makeCouncil('SMSville District', 'form_automation', {}, ['duty@smsville.govt.nz']);
    const create = await report();
    const { rows } = await outboxFor(create.body.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe('email');
    expect(rows[0].recipient).toBe('duty@smsville.govt.nz');
  });

  it('contact registry can set sms channel via importer', async () => {
    const { applyContacts } = await import('../scripts/import-contacts.js');
    await pool.query(`INSERT INTO councils (name) VALUES ('Importville') ON CONFLICT (name) DO NOTHING`);
    const { applied } = await applyContacts(pool, {
      Importville: { submission_channel: 'sms', channel_config: { sms_number: '3130' } },
    });
    expect(applied).toEqual(['Importville']);
    const { rows } = await pool.query(
      `SELECT submission_channel, channel_config FROM councils WHERE name = 'Importville'`,
    );
    expect(rows[0].submission_channel).toBe('sms');
    expect(rows[0].channel_config.sms_number).toBe('3130');
  });
});
