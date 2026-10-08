// backend/tests/contacts.test.ts — council contact registry (#34): import
// applies council fields + zone alert_emails; report API surfaces contact.
import { afterAll, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { applyContacts } from '../scripts/import-contacts.js';

const app = createApp();
afterAll(() => pool.end());
// Invercargill — outside the seeded Wellington zone and every other test's
// points, so this zone never steals their reports (test DB is shared).
const SPOT = { lat: -46.413, lng: 168.354 };
const TINY = 'SRID=4326;MULTIPOLYGON(((168.3 -46.5, 168.4 -46.5, 168.4 -46.4, 168.3 -46.4, 168.3 -46.5)))';

describe('council contacts', () => {
  it('applies registry data and surfaces contact on report endpoints', async () => {
    const { rows } = await pool.query(
      `INSERT INTO councils (name) VALUES ('Contactsville District')
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    );
    await pool.query(
      `INSERT INTO council_zones (council_id, name, boundary)
       VALUES ($1, 'All areas', ST_GeomFromEWKT($2))`,
      [rows[0].id, TINY],
    );

    const { applied, missing } = await applyContacts(pool, {
      'Contactsville District': {
        entity: 'Test Water',
        emails: ['duty@test.govt.nz'],
        phone: '0800 111 222',
        form_url: 'https://test.govt.nz/leak',
        app: 'TestApp',
      },
      'Not A Real Council': { emails: ['x@y.nz'] },
    });
    expect(applied).toEqual(['Contactsville District']);
    expect(missing).toEqual(['Not A Real Council']);

    const create = await request(app)
      .post('/api/v1/reports')
      .field('category', 'road').field('severity', 'minor')
      .field('lat', String(SPOT.lat)).field('lng', String(SPOT.lng));
    expect(create.status).toBe(201);
    expect(create.body.council_zone.contact).toEqual({
      entity: 'Test Water',
      phone: '0800 111 222',
      form_url: 'https://test.govt.nz/leak',
      app: 'TestApp',
    });

    const got = await request(app).get(`/api/v1/reports/${create.body.id}`);
    expect(got.body.council_zone.contact.entity).toBe('Test Water');
    expect(got.body.council_zone.contact.phone).toBe('0800 111 222');

    // alert_emails became the outbox send target for the authority alert.
    const { rows: out } = await pool.query(
      `SELECT recipient FROM notification_outbox
       WHERE report_id = $1 AND template = 'new_report'`,
      [create.body.id],
    );
    expect(out.map((r) => r.recipient)).toContain('duty@test.govt.nz');
  });

  it('registry file covers only councils present in Stats NZ TA names', () => {
    const contacts = JSON.parse(readFileSync('data/council-contacts.json', 'utf8'));
    const wlg = contacts['Wellington City'];
    expect(wlg.entity).toBe('Tiaki Wai');
    expect(wlg.emails).toContain('customer@wellingtonwater.co.nz');
    expect(contacts['Auckland'].emails).toContain('faults@water.co.nz');
  });
});
