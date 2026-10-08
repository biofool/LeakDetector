// backend/tests/patch.test.ts — PATCH /reports/:id staff flow.
import { afterAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { tinyPng } from './helpers.js';

const app = createApp();
afterAll(() => pool.end());
const SPOT = { lat: -41.28, lng: 174.77 };

async function makeReport() {
  const res = await request(app)
    .post('/api/v1/reports')
    .field('category', 'road').field('severity', 'minor')
    .field('lat', String(SPOT.lat)).field('lng', String(SPOT.lng));
  expect(res.status).toBe(201);
  return res.body;
}

async function staffToken() {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'staff@example.govt.nz', password: 'password123' });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe('PATCH /api/v1/reports/:id', () => {
  it('requires a staff token', async () => {
    const r = await makeReport();
    const res = await request(app).patch(`/api/v1/reports/${r.id}`).send({ status: 'investigating' });
    expect(res.status).toBe(401);
  });

  it('advances status and sets resolved_at', async () => {
    const token = await staffToken();
    const r = await makeReport();
    const inv = await request(app)
      .patch(`/api/v1/reports/${r.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'investigating', verified: true });
    expect(inv.status).toBe(200);
    expect(inv.body.status).toBe('investigating');
    expect(inv.body.verified).toBe(true);
    expect(inv.body.reporter_name).toBeDefined(); // staff view

    const done = await request(app)
      .patch(`/api/v1/reports/${r.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved' });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('resolved');
    expect(done.body.resolved_at).not.toBeNull();
    expect(['met', 'missed']).toContain(done.body.sla_status);
  });

  it('rejects invalid transitions with 409', async () => {
    const token = await staffToken();
    const r = await makeReport();
    const res = await request(app)
      .patch(`/api/v1/reports/${r.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'investigating' });
    expect(res.status).toBe(200);
    const back = await request(app)
      .patch(`/api/v1/reports/${r.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'received' });
    expect(back.status).toBe(409);
    expect(back.body.error.code).toBe('invalid_transition');
  });

  it('rejects duplicate chains with 422', async () => {
    const token = await staffToken();
    const a = await makeReport();
    const b = await makeReport();
    const c = await makeReport();
    await request(app)
      .patch(`/api/v1/reports/${b.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_duplicate_of: a.id });
    const chain = await request(app)
      .patch(`/api/v1/reports/${c.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_duplicate_of: b.id }); // b is itself a duplicate → chain
    expect(chain.status).toBe(422);
    expect(chain.body.error.code).toBe('invalid_duplicate_target');
  });

  it('returns 401 for an invalid staff token — not a silent public view', async () => {
    const r = await makeReport();
    const res = await request(app)
      .get(`/api/v1/reports/${r.id}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_token');
  });

  it('rejects a duplicate link that would form a chain via children', async () => {
    const token = await staffToken();
    const a = await makeReport();
    const b = await makeReport();
    const c = await makeReport();
    const ok = await request(app)
      .patch(`/api/v1/reports/${a.id}`).set('Authorization', `Bearer ${token}`)
      .send({ is_duplicate_of: b.id });
    expect(ok.status).toBe(200);
    // B now has a child (A) — B→C would create chain A→B→C
    const chain = await request(app)
      .patch(`/api/v1/reports/${b.id}`).set('Authorization', `Bearer ${token}`)
      .send({ is_duplicate_of: c.id });
    expect(chain.status).toBe(422);
    expect(chain.body.error.code).toBe('invalid_duplicate_target');
  });

  it('does not re-notify when resolved is PATCHed twice', async () => {
    const token = await staffToken();
    const create = await request(app)
      .post('/api/v1/reports')
      .field('category', 'road').field('severity', 'minor')
      .field('lat', String(SPOT.lat)).field('lng', String(SPOT.lng))
      .field('reporter_contact', 'repeat@example.nz');
    const id = create.body.id;
    await request(app).patch(`/api/v1/reports/${id}`).set('Authorization', `Bearer ${token}`).send({ status: 'resolved' });
    // second PATCH with another field — must not queue a second notification
    await request(app).patch(`/api/v1/reports/${id}`).set('Authorization', `Bearer ${token}`).send({ status: 'resolved', public_note: 'still done' });
    const { rows } = await pool.query(
      `SELECT count(*) AS n FROM notification_outbox WHERE report_id = $1 AND template = 'reporter_resolved'`,
      [id],
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  it('staff can hide a photo; public view omits it', async () => {
    const token = await staffToken();
    const create = await request(app)
      .post('/api/v1/reports')
      .field('category', 'berm').field('severity', 'minor')
      .field('lat', String(SPOT.lat)).field('lng', String(SPOT.lng))
      .attach('photos', tinyPng(), { filename: 'face.png', contentType: 'image/png' });
    const got = await request(app)
      .get(`/api/v1/reports/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    const photoId = got.body.photos[0].id;
    const hide = await request(app)
      .patch(`/api/v1/reports/${create.body.id}/photos/${photoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_hidden: true });
    expect(hide.status).toBe(200);
    expect(hide.body.is_hidden).toBe(true);
    const pub = await request(app).get(`/api/v1/reports/${create.body.id}`);
    expect(pub.body.photos).toHaveLength(0);
  });

  it('recalculates SLA when severity changes', async () => {
    const token = await staffToken();
    const r = await makeReport(); // minor/road → 48 h
    const res = await request(app)
      .patch(`/api/v1/reports/${r.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ severity: 'major' }); // major/road → 12 h
    expect(res.status).toBe(200);
    const hours = (new Date(res.body.sla_due_at).getTime() - new Date(res.body.created_at).getTime()) / 3.6e6;
    expect(hours).toBeCloseTo(12, 0);
  });
});

describe('status history + confirm rules (D11/D15)', () => {
  it('records create + transition rows in status_history', async () => {
    const token = await staffToken();
    const r = await makeReport();
    const inv = await request(app)
      .patch(`/api/v1/reports/${r.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'investigating' });
    expect(inv.status).toBe(200);

    const detail = await request(app).get(`/api/v1/reports/${r.id}`);
    expect(detail.status).toBe(200);
    const hist = detail.body.status_history as { from_status: string | null; to_status: string }[];
    expect(hist.map((h) => [h.from_status, h.to_status])).toEqual([
      [null, 'received'],
      ['received', 'investigating'],
    ]);
  });

  it('rejects confirm on a marked duplicate with 422', async () => {
    const token = await staffToken();
    const parent = await makeReport();
    const child = await makeReport();
    const link = await request(app)
      .patch(`/api/v1/reports/${child.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_duplicate_of: parent.id });
    expect(link.status).toBe(200);

    const res = await request(app).post(`/api/v1/reports/${child.id}/confirm`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('is_duplicate');
    // Parent still confirms fine.
    const ok = await request(app).post(`/api/v1/reports/${parent.id}/confirm`);
    expect(ok.status).toBe(200);
  });

  it('serves security headers (helmet)', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
