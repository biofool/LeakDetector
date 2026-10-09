// backend/tests/storygraph.test.ts — story_graph export outbox row (#43).
import { afterAll, afterEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { pool } from '../src/db.js';

const app = createApp();
afterAll(() => pool.end());
afterEach(() => { config.storyGraphIngestEmail = ''; });

const WLG = { lat: -41.2924, lng: 174.7768 };

const createReport = () =>
  request(app)
    .post('/api/v1/reports')
    .field('category', 'footpath').field('severity', 'major')
    .field('lat', String(WLG.lat)).field('lng', String(WLG.lng))
    .field('reporter_name', 'Secret Person')
    .field('reporter_contact', 'secret.reporter@example.nz');

const exportRows = async (id: number) => (await pool.query(
  `SELECT recipient, channel, payload, dedupe_key FROM notification_outbox
   WHERE report_id = $1 AND template = 'story_graph_export'`,
  [id],
)).rows;

describe('story_graph_export outbox', () => {
  it('queues nothing when STORY_GRAPH_INGEST_EMAIL is empty', async () => {
    const create = await createReport();
    expect(create.status).toBe(201);
    expect(await exportRows(create.body.id)).toEqual([]);
  });

  it('queues one public-fields-only email per new report', async () => {
    config.storyGraphIngestEmail = 'corpus@example.nz';
    const create = await createReport();
    expect(create.status).toBe(201);
    const rows = await exportRows(create.body.id);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.recipient).toBe('corpus@example.nz');
    expect(row.channel).toBe('email');
    expect(row.dedupe_key).toBe(`story_graph:${create.body.id}`);
    expect(Object.keys(row.payload).sort()).toEqual(
      ['api_url', 'category', 'created_at', 'ref', 'severity', 'tracking_url', 'zone']);
    expect(row.payload.api_url).toBe(`${config.apiPublicUrl}/api/v1/reports/${create.body.id}`);
    expect(row.payload.tracking_url).toBe(`${config.publicBaseUrl}/r/${create.body.id}`);
    const raw = JSON.stringify(row.payload);
    expect(raw).not.toContain('secret.reporter');
    expect(raw).not.toContain('Secret Person');
  });
});
