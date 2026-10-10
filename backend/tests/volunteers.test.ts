// backend/tests/volunteers.test.ts — volunteer signup, unsubscribe, staff list (#37).
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

const app = createApp();
afterAll(() => pool.end());

const WLG = { lat: -41.2924, lng: 174.7768 };

let zoneId: number;
let staffToken: string;

beforeAll(async () => {
  const { rows } = await pool.query(`SELECT id FROM council_zones WHERE name = 'Citywide'`);
  zoneId = rows[0].id;
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'staff@example.govt.nz', password: 'password123' });
  staffToken = login.body.token;
});

const signup = (body: Record<string, unknown>) =>
  request(app).post('/api/v1/volunteers').send(body);

describe('GET /api/v1/councils', () => {
  it('lists councils + zones, id/name only', async () => {
    const res = await request(app).get('/api/v1/councils');
    expect(res.status).toBe(200);
    const demo = res.body.results.find((c: { name: string }) => c.name === 'Demo City Council');
    expect(demo.zones.map((z: { name: string }) => z.name)).toContain('Citywide');
    expect(demo.alert_emails).toBeUndefined();
  });
});

describe('POST /api/v1/volunteers', () => {
  it('signs up by zone id — generic response, row persisted', async () => {
    const res = await signup({
      name: 'Rangi Volunteer', email: 'rangi@example.nz',
      council_zone_id: zoneId, help_types: ['hands_on', 'routing'],
      note: 'plumber', consent: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.council_zone.name).toBe('Citywide');
    const { rows } = await pool.query(
      `SELECT *, help_types::text[] AS ht FROM volunteers WHERE lower(email) = 'rangi@example.nz'`, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].active).toBe(true);
    expect(rows[0].ht).toEqual(['hands_on', 'routing']);
    expect(rows[0].consent_staff_only).toBe(true);
  });

  it('repeat signup upserts — still one row, still generic response', async () => {
    const res = await signup({
      name: 'Rangi V', email: 'Rangi@example.nz',
      council_zone_id: zoneId, help_types: ['routing'], consent: true,
    });
    expect(res.status).toBe(201);
    const { rows } = await pool.query(
      `SELECT help_types::text[] AS ht FROM volunteers WHERE lower(email) = 'rangi@example.nz'`, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].ht).toEqual(['routing']);
  });

  it('resolves the zone from a point', async () => {
    const res = await signup({
      name: 'Point Person', email: 'point@example.nz',
      lat: WLG.lat, lng: WLG.lng, help_types: ['routing'], consent: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.council_zone.id).toBe(zoneId);
  });

  it('rejects missing consent, bad help type, unknown zone, outside point', async () => {
    expect((await signup({ name: 'x', email: 'x@x.nz', council_zone_id: zoneId, help_types: ['hands_on'] })).status).toBe(400);
    expect((await signup({ name: 'x', email: 'x@x.nz', council_zone_id: zoneId, help_types: ['cooking'], consent: true })).status).toBe(400);
    expect((await signup({ name: 'x', email: 'x@x.nz', council_zone_id: 99999, help_types: ['hands_on'], consent: true })).status).toBe(422);
    expect((await signup({ name: 'x', email: 'x@x.nz', lat: -36.85, lng: 174.76, help_types: ['hands_on'], consent: true })).status).toBe(422);
    expect((await signup({ name: 'x', email: 'x@x.nz', help_types: ['hands_on'], consent: true })).status).toBe(400);
    expect((await signup({ name: 'x', email: 'not-an-email', council_zone_id: zoneId, help_types: ['hands_on'], consent: true })).status).toBe(400);
  });
});

describe('GET /api/v1/volunteers (staff only)', () => {
  it('rejects anonymous and returns the directory to staff', async () => {
    const anon = await request(app).get('/api/v1/volunteers');
    expect(anon.status).toBe(401);

    const res = await request(app)
      .get('/api/v1/volunteers')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    const rangi = res.body.results.find((v: { email: string }) => v.email === 'rangi@example.nz');
    expect(rangi.name).toBe('Rangi V');
    expect(rangi.help_types).toEqual(['routing']);
    expect(rangi.council_zone.council).toBe('Demo City Council');
  });
});

describe('volunteer_new_report outbox', () => {
  it('queues one email per active zone volunteer on report create', async () => {
    const create = await request(app)
      .post('/api/v1/reports')
      .field('category', 'berm').field('severity', 'minor')
      .field('lat', String(WLG.lat)).field('lng', String(WLG.lng));
    expect(create.status).toBe(201);
    const { rows } = await pool.query(
      `SELECT recipient, payload, dedupe_key FROM notification_outbox
       WHERE report_id = $1 AND template = 'volunteer_new_report'`,
      [create.body.id],
    );
    const emails = rows.map((r) => r.recipient).sort();
    expect(emails).toEqual(['point@example.nz', 'rangi@example.nz']);
    expect(rows[0].payload.tracking_url).toContain(`/r/${create.body.id}`);
    expect(rows[0].payload.unsubscribe_url).toContain('/api/v1/volunteers/unsubscribe?token=');
    expect(rows[0].dedupe_key).toMatch(/^volunteer_new_report:\d+:\d+$/);
  });

  it('never carries the reporter contact (#44)', async () => {
    const create = await request(app)
      .post('/api/v1/reports')
      .field('category', 'berm').field('severity', 'minor')
      .field('lat', String(WLG.lat)).field('lng', String(WLG.lng))
      .field('reporter_name', 'Secret Person')
      .field('reporter_contact', 'secret.reporter@example.nz');
    expect(create.status).toBe(201);
    const { rows } = await pool.query(
      `SELECT payload FROM notification_outbox
       WHERE report_id = $1 AND template = 'volunteer_new_report'`,
      [create.body.id],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.payload.cc).toBeUndefined();
      expect(JSON.stringify(r.payload)).not.toMatch(/secret\.reporter|Secret Person/);
    }
  });
});

describe('GET /api/v1/volunteers/unsubscribe', () => {
  it('deactivates by token; bogus token is a harmless 404 page', async () => {
    const { rows } = await pool.query(
      `SELECT unsubscribe_token FROM volunteers WHERE lower(email) = 'point@example.nz'`);
    const res = await request(app).get(`/api/v1/volunteers/unsubscribe?token=${rows[0].unsubscribe_token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('unsubscribed');
    const { rows: after } = await pool.query(
      `SELECT active FROM volunteers WHERE lower(email) = 'point@example.nz'`);
    expect(after[0].active).toBe(false);

    const bogus = await request(app).get('/api/v1/volunteers/unsubscribe?token=not-a-uuid');
    expect(bogus.status).toBe(404);
  });

  it('unsubscribed volunteers get no further report emails', async () => {
    const create = await request(app)
      .post('/api/v1/reports')
      .field('category', 'road').field('severity', 'minor')
      .field('lat', String(WLG.lat)).field('lng', String(WLG.lng));
    const { rows } = await pool.query(
      `SELECT recipient FROM notification_outbox
       WHERE report_id = $1 AND template = 'volunteer_new_report'`,
      [create.body.id],
    );
    expect(rows.map((r) => r.recipient)).toEqual(['rangi@example.nz']);
  });
});
