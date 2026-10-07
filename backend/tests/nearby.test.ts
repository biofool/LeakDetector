// backend/tests/nearby.test.ts — GET /reports/nearby (ST_DWithin).
import { afterAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

const app = createApp();
afterAll(() => pool.end());
const SPOT = { lat: -41.2865, lng: 174.7762 };

async function makeReport(overrides: Record<string, string> = {}) {
  const res = await request(app)
    .post('/api/v1/reports')
    .field('category', 'footpath')
    .field('severity', 'minor')
    .field('lat', String(SPOT.lat))
    .field('lng', String(SPOT.lng))
    .field('description', overrides.description ?? 'test leak');
  expect(res.status).toBe(201);
  return res.body;
}

describe('GET /api/v1/reports/nearby', () => {
  it('finds a report inside 30 m, nearest first', async () => {
    const r = await makeReport();
    const res = await request(app)
      .get('/api/v1/reports/nearby')
      .query({ lat: SPOT.lat + 0.0001, lng: SPOT.lng, radius_m: 30 });
    expect(res.status).toBe(200);
    expect(res.body.results.some((d: { id: number }) => d.id === r.id)).toBe(true);
    const hit = res.body.results.find((d: { id: number }) => d.id === r.id);
    expect(hit.distance_m).toBeGreaterThan(5);
    expect(hit.distance_m).toBeLessThan(20);
    expect(hit.ref).toBe(r.ref);
  });

  it('does not return reports outside the radius', async () => {
    await makeReport();
    const res = await request(app)
      .get('/api/v1/reports/nearby')
      .query({ lat: -41.0, lng: 174.9, radius_m: 30 });
    expect(res.body.results).toEqual([]);
  });

  it('excludes reports marked as duplicates', async () => {
    const a = await makeReport();
    const b = await makeReport();
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.govt.nz', password: 'password123' });
    const dup = await request(app)
      .patch(`/api/v1/reports/${b.id}`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ is_duplicate_of: a.id });
    expect(dup.status).toBe(200);
    const res = await request(app)
      .get('/api/v1/reports/nearby')
      .query({ lat: SPOT.lat, lng: SPOT.lng, radius_m: 30 });
    expect(res.body.results.some((d: { id: number }) => d.id === b.id)).toBe(false);
  });
});

describe('POST /api/v1/reports/:id/confirm', () => {
  it('increments confirmation_count', async () => {
    const r = await makeReport();
    const res = await request(app).post(`/api/v1/reports/${r.id}/confirm`);
    expect(res.status).toBe(200);
    expect(res.body.confirmation_count).toBe(1);
  });
});
