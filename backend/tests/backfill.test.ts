// backend/tests/backfill.test.ts — migration 006 backfills status history
// for pre-003 reports (#36). globalSetup runs migrations on an empty DB so
// the backfill is exercised inline: wipe a report's history, re-run the
// migration SQL, assert the bookend rows come back.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

const app = createApp();
afterAll(() => pool.end());
const SPOT = { lat: -41.28, lng: 174.77 };
const BACKFILL_SQL = readFileSync(join(process.cwd(), 'migrations', '006_backfill_status_history.sql'), 'utf8');

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

async function detail(id: number) {
  const res = await request(app).get(`/api/v1/reports/${id}`);
  expect(res.status).toBe(200);
  return res.body as {
    created_at: string;
    status_history: { from_status: string | null; to_status: string; at: string }[];
  };
}

describe('006_backfill_status_history (#36)', () => {
  it('rebuilds the received bookend for a report with no history', async () => {
    const r = await makeReport();
    const before = await detail(r.id);
    expect(before.status_history.map((h) => [h.from_status, h.to_status])).toEqual([[null, 'received']]);

    // Simulate a pre-003 report: no history rows at all.
    await pool.query('DELETE FROM report_status_history WHERE report_id = $1', [r.id]);
    await pool.query(BACKFILL_SQL);

    const hist = (await detail(r.id)).status_history;
    expect(hist.map((h) => [h.from_status, h.to_status])).toEqual([[null, 'received']]);
    expect(new Date(hist[0].at).getTime()).toBe(new Date(before.created_at).getTime());
  });

  it('rebuilds both bookends for a resolved report and is idempotent', async () => {
    const token = await staffToken();
    const r = await makeReport();
    const done = await request(app)
      .patch(`/api/v1/reports/${r.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved' });
    expect(done.status).toBe(200);

    await pool.query('DELETE FROM report_status_history WHERE report_id = $1', [r.id]);
    await pool.query(BACKFILL_SQL);
    await pool.query(BACKFILL_SQL); // second run must be a no-op

    const hist = (await detail(r.id)).status_history;
    expect(hist.map((h) => [h.from_status, h.to_status])).toEqual([
      [null, 'received'],
      ['received', 'resolved'],
    ]);
    expect(new Date(hist[1].at).getTime()).toBe(new Date(done.body.resolved_at).getTime());
  });
});
