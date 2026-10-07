// backend/tests/reports.test.ts — POST /reports.
import { afterAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { tinyPng } from './helpers.js';

const PNG = tinyPng();

const app = createApp();
afterAll(() => pool.end());
const WLG = { lat: -41.2924, lng: 174.7768 };
const AKL = { lat: -36.85, lng: 174.76 }; // outside the test zone

describe('POST /api/v1/reports', () => {
  it('creates a report: 201, ref, zone, SLA', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .field('category', 'road')
      .field('severity', 'major')
      .field('description', 'water gushing from a crack in the seal')
      .field('lat', String(WLG.lat))
      .field('lng', String(WLG.lng))
      .field('reporter_contact', '021 555 0199');
    expect(res.status).toBe(201);
    expect(res.body.ref).toMatch(/^WL-\d{6}$/);
    expect(res.body.status).toBe('received');
    expect(res.body.council_zone.name).toBe('Citywide');
    // major/road → 12 h SLA
    const hours = (new Date(res.body.sla_due_at).getTime() - Date.now()) / 3.6e6;
    expect(hours).toBeGreaterThan(11);
    expect(hours).toBeLessThanOrEqual(12);
    expect(res.body.tracking_url).toContain(`/r/${res.body.id}`);
    expect(res.body.possible_duplicates).toEqual([]);
  });

  it('normalises NZ mobiles to E.164 (staff view)', async () => {
    const create = await request(app)
      .post('/api/v1/reports')
      .field('category', 'berm').field('severity', 'minor')
      .field('lat', '-41.3').field('lng', '174.78')
      .field('reporter_contact', '0215550199');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.govt.nz', password: 'password123' });
    const got = await request(app)
      .get(`/api/v1/reports/${create.body.id}`)
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(got.body.reporter_contact).toBe('+64215550199');
  });

  it('rejects bad category / out-of-range coords with 400', async () => {
    const bad = await request(app)
      .post('/api/v1/reports')
      .field('category', 'nonsense').field('severity', 'minor')
      .field('lat', '-41.3').field('lng', '174.78');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('validation_failed');

    const london = await request(app)
      .post('/api/v1/reports')
      .field('category', 'road').field('severity', 'minor')
      .field('lat', '51.5').field('lng', '-0.12');
    expect(london.status).toBe(400);
  });

  it('returns 422 outside_service_area beyond every zone [D-11]', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .field('category', 'road').field('severity', 'minor')
      .field('lat', String(AKL.lat)).field('lng', String(AKL.lng));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('outside_service_area');
  });

  it('public GET strips reporter contact [D-12]', async () => {
    const create = await request(app)
      .post('/api/v1/reports')
      .field('category', 'footpath').field('severity', 'minor')
      .field('lat', '-41.31').field('lng', '174.79')
      .field('reporter_contact', 'reporter@example.nz');
    const pub = await request(app).get(`/api/v1/reports/${create.body.id}`);
    expect(pub.status).toBe(200);
    expect(pub.body.reporter_contact).toBeUndefined();
    expect(pub.body.sla_status).toBe('on_track');
  });

  it('accepts a real photo and returns absolute webp URLs', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .field('category', 'berm').field('severity', 'minor')
      .field('lat', '-41.29').field('lng', '174.78')
      .attach('photos', PNG, { filename: 'leak.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const got = await request(app).get(`/api/v1/reports/${res.body.id}`);
    expect(got.body.photos).toHaveLength(1);
    expect(got.body.photos[0].url).toMatch(/^https?:\/\/.+\.webp$/);
    expect(got.body.photos[0].thumb_url).toMatch(/_t\.webp$/);
  });

  it('rejects a non-image file labelled as jpeg with 415', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .field('category', 'berm').field('severity', 'minor')
      .field('lat', '-41.29').field('lng', '174.78')
      .attach('photos', Buffer.from('not an image'), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('unsupported_type');
  });

  it('returns 400 for bad list params, geojson for format=geojson', async () => {
    for (const qs of ['limit=abc', 'page=-1', 'council_zone_id=x', 'sort=wrong', 'sla=wrong', 'updated_since=banana']) {
      const res = await request(app).get(`/api/v1/reports?${qs}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation_failed');
    }
    const geo = await request(app).get('/api/v1/reports?format=geojson');
    expect(geo.status).toBe(200);
    expect(geo.body.type).toBe('FeatureCollection');
    expect(Array.isArray(geo.body.features)).toBe(true);
  });
});
