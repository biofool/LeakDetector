// backend/tests/volunteers.test.ts — volunteer signup, verify, unsubscribe,
// staff list (#37, #50, #51).
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

const tokenFor = async (email: string): Promise<string> => {
  const { rows } = await pool.query(
    `SELECT unsubscribe_token FROM volunteers WHERE lower(email) = lower($1)`, [email]);
  return rows[0].unsubscribe_token;
};

const verifyViaPost = (token: string) =>
  request(app).post('/api/v1/volunteers/verify').type('form').send({ token });

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
  it('signs up unverified — generic response, verify email queued (#51)', async () => {
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
    expect(rows[0].verified).toBe(false); // no report alerts until verified
    expect(rows[0].ht).toEqual(['hands_on', 'routing']);
    expect(rows[0].consent_staff_only).toBe(true);
    const { rows: outbox } = await pool.query(
      `SELECT template, payload, dedupe_key FROM notification_outbox
       WHERE template = 'volunteer_verify' AND recipient = 'rangi@example.nz'`, []);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].payload.verify_url).toContain('/api/v1/volunteers/verify?token=');
    expect(outbox[0].payload.unsubscribe_url).toContain('/api/v1/volunteers/unsubscribe?token=');
    expect(outbox[0].dedupe_key).toMatch(/^volunteer_verify:\d+:\d{4}-\d{2}-\d{2}$/);
  });

  it('verify link: GET renders a confirm page (no mutation), POST activates', async () => {
    const token = await tokenFor('rangi@example.nz');
    const get = await request(app).get(`/api/v1/volunteers/verify?token=${token}`);
    expect(get.status).toBe(200);
    expect(get.text).toContain('Confirm your volunteer signup');
    // GET must not have verified the row (mail scanners prefetch links, #50).
    const { rows: mid } = await pool.query(
      `SELECT verified FROM volunteers WHERE lower(email) = 'rangi@example.nz'`, []);
    expect(mid[0].verified).toBe(false);

    const post = await verifyViaPost(token);
    expect(post.status).toBe(200);
    expect(post.text).toContain('Signup confirmed');
    const { rows } = await pool.query(
      `SELECT verified, active FROM volunteers WHERE lower(email) = 'rangi@example.nz'`, []);
    expect(rows[0]).toEqual({ verified: true, active: true });

    // Second click → "already confirmed" page.
    const again = await request(app).get(`/api/v1/volunteers/verify?token=${token}`);
    expect(again.text).toContain('Already confirmed');
  });

  it('unverified volunteers get no report emails', async () => {
    const res = await signup({
      name: 'Unverified Person', email: 'unverified@example.nz',
      council_zone_id: zoneId, help_types: ['routing'], consent: true,
    });
    expect(res.status).toBe(201);
    const create = await request(app)
      .post('/api/v1/reports')
      .field('category', 'berm').field('severity', 'minor')
      .field('lat', String(WLG.lat)).field('lng', String(WLG.lng));
    const { rows } = await pool.query(
      `SELECT recipient FROM notification_outbox
       WHERE report_id = $1 AND template = 'volunteer_new_report'`, [create.body.id]);
    expect(rows.map((r) => r.recipient)).not.toContain('unverified@example.nz');
  });

  it('repeat signup upserts — still one row, still generic response', async () => {
    const res = await signup({
      name: 'Rangi V', email: 'Rangi@example.nz',
      council_zone_id: zoneId, help_types: ['routing'], consent: true,
    });
    expect(res.status).toBe(201);
    const { rows } = await pool.query(
      `SELECT help_types::text[] AS ht, verified FROM volunteers WHERE lower(email) = 'rangi@example.nz'`, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].ht).toEqual(['routing']);
    expect(rows[0].verified).toBe(true); // verified survives re-signup
  });

  it('resolves the zone from a point', async () => {
    const res = await signup({
      name: 'Point Person', email: 'point@example.nz',
      lat: WLG.lat, lng: WLG.lng, help_types: ['routing'], consent: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.council_zone.id).toBe(zoneId);
    await verifyViaPost(await tokenFor('point@example.nz'));
  });

  it('rejects missing consent, bad help type, unknown zone, outside point', async () => {
    expect((await signup({ name: 'x', email: 'x@x.nz', council_zone_id: zoneId, help_types: ['hands_on'] })).status).toBe(400);
    expect((await signup({ name: 'x', email: 'x@x.nz', council_zone_id: zoneId, help_types: ['cooking'], consent: true })).status).toBe(400);
    expect((await signup({ name: 'x', email: 'x@x.nz', council_zone_id: 99999, help_types: ['hands_on'], consent: true })).status).toBe(422);
    expect((await signup({ name: 'x', email: 'x@x.nz', lat: -36.85, lng: 174.76, help_types: ['hands_on'], consent: true })).status).toBe(422);
    expect((await signup({ name: 'x', email: 'x@x.nz', help_types: ['hands_on'], consent: true })).status).toBe(400);
    expect((await signup({ name: 'x', email: 'not-an-email', council_zone_id: zoneId, help_types: ['hands_on'], consent: true })).status).toBe(400);
  });

  it('rejects cross-site form posts (#55)', async () => {
    const res = await request(app)
      .post('/api/v1/volunteers')
      .set('Origin', 'https://evil.example')
      .send({ name: 'x', email: 'x@x.nz', council_zone_id: zoneId, help_types: ['hands_on'], consent: true });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('bad_origin');
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
    expect(rangi.verified).toBe(true);
    expect(rangi.council_zone.council).toBe('Demo City Council');
  });

  it('rejects a token whose account was deactivated after issue (#53)', async () => {
    await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role, council_id)
       SELECT 'gone@example.govt.nz', password_hash, 'Gone Staff', 'council_staff', council_id
       FROM users WHERE lower(email) = 'staff@example.govt.nz'`,
    );
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'gone@example.govt.nz', password: 'password123' });
    expect(login.status).toBe(200);
    const ok = await request(app)
      .get('/api/v1/volunteers')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(ok.status).toBe(200);

    await pool.query(`UPDATE users SET is_active = false WHERE email = 'gone@example.govt.nz'`);
    const res = await request(app)
      .get('/api/v1/volunteers')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_token');
    await pool.query(`DELETE FROM users WHERE email = 'gone@example.govt.nz'`);
  });
});

describe('volunteer_new_report outbox', () => {
  it('queues one email per verified+active zone volunteer on report create', async () => {
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

describe('volunteer unsubscribe', () => {
  it('GET renders a confirm page without mutating; POST unsubscribes (#50)', async () => {
    const token = await tokenFor('point@example.nz');
    const get = await request(app).get(`/api/v1/volunteers/unsubscribe?token=${token}`);
    expect(get.status).toBe(200);
    expect(get.text).toContain('Unsubscribe from volunteer emails?');
    // The GET alone must not have unsubscribed (mail scanners prefetch).
    const { rows: mid } = await pool.query(
      `SELECT active FROM volunteers WHERE lower(email) = 'point@example.nz'`, []);
    expect(mid[0].active).toBe(true);

    const post = await request(app)
      .post('/api/v1/volunteers/unsubscribe').type('form').send({ token });
    expect(post.status).toBe(200);
    expect(post.text).toContain('unsubscribed');
    const { rows } = await pool.query(
      `SELECT active FROM volunteers WHERE lower(email) = 'point@example.nz'`, []);
    expect(rows[0].active).toBe(false);

    // Repeat GET → "already unsubscribed"; bogus token → harmless 404.
    const again = await request(app).get(`/api/v1/volunteers/unsubscribe?token=${token}`);
    expect(again.text).toContain('Already unsubscribed');
    const bogus = await request(app).get('/api/v1/volunteers/unsubscribe?token=not-a-uuid');
    expect(bogus.status).toBe(404);
    const badPost = await request(app)
      .post('/api/v1/volunteers/unsubscribe').type('form').send({ token: 'not-a-uuid' });
    expect(badPost.status).toBe(404);
  });

  it('re-signup does not re-activate an unsubscribed address', async () => {
    const res = await signup({
      name: 'Point P', email: 'point@example.nz',
      council_zone_id: zoneId, help_types: ['routing'], consent: true,
    });
    expect(res.status).toBe(201);
    const { rows } = await pool.query(
      `SELECT active FROM volunteers WHERE lower(email) = 'point@example.nz'`, []);
    expect(rows[0].active).toBe(false); // still unsubscribed until verify link
    // Clicking the emailed verify link is the way back in.
    await verifyViaPost(await tokenFor('point@example.nz'));
    const { rows: after } = await pool.query(
      `SELECT active, verified FROM volunteers WHERE lower(email) = 'point@example.nz'`, []);
    expect(after[0]).toEqual({ active: true, verified: true });
  });

  it('unsubscribed volunteers get no further report emails', async () => {
    await pool.query(`UPDATE volunteers SET active = false WHERE lower(email) = 'point@example.nz'`);
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
