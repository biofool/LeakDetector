// backend/tests/leakreportcopy.test.ts — ops-copy outbox row (D-27).
import { afterAll, afterEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { pool } from '../src/db.js';

const app = createApp();
afterAll(() => pool.end());
afterEach(() => { config.leakReportsEmail = ''; });

const WLG = { lat: -41.2924, lng: 174.7768 };

const createReport = () =>
  request(app)
    .post('/api/v1/reports')
    .field('category', 'footpath').field('severity', 'major')
    .field('lat', String(WLG.lat)).field('lng', String(WLG.lng))
    .field('description', 'water bubbling under the footpath')
    .field('reporter_name', 'Secret Person')
    .field('reporter_contact', 'secret.reporter@example.nz');

const copyRows = async (id: number) => (await pool.query(
  `SELECT recipient, channel, payload, dedupe_key FROM notification_outbox
   WHERE report_id = $1 AND template = 'leak_report_copy'`,
  [id],
)).rows;

describe('leak_report_copy outbox', () => {
  it('queues nothing when LEAK_REPORTS_EMAIL is empty', async () => {
    const create = await createReport();
    expect(create.status).toBe(201);
    expect(await copyRows(create.body.id)).toEqual([]);
  });

  it('queues one ops email with an authority routing note', async () => {
    config.leakReportsEmail = 'leakreports@example.nz';
    const create = await createReport();
    expect(create.status).toBe(201);
    const rows = await copyRows(create.body.id);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.recipient).toBe('leakreports@example.nz');
    expect(row.channel).toBe('email');
    expect(row.dedupe_key).toBe(`leak_report_copy:${create.body.id}`);
    // Routing note matches the zone's real alert target, not a second source.
    expect(row.payload.authority_note).toBe('duty@example.govt.nz');
    expect(row.payload.council).toBe('Demo City Council');
    expect(row.payload.zone).toBe('Citywide');
    expect(row.payload.description).toBe('water bubbling under the footpath');
    const raw = JSON.stringify(row.payload);
    expect(raw).not.toContain('secret.reporter');
    expect(raw).not.toContain('Secret Person');
  });
});
