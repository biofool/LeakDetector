// backend/tests/volunteerHelpers.ts — shared app instance + helpers for the
// volunteers test files (split out of volunteers.test.ts, issue #68). Jest
// gives each test file its own module registry, so `app`/`pool` here are
// per-file singletons — each importer must still call pool.end() in afterAll.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

export const app = createApp();
export { pool };

export const WLG = { lat: -41.2924, lng: 174.7768 };

export const signup = (body: Record<string, unknown>) =>
  request(app).post('/api/v1/volunteers').send(body);

export const tokenFor = async (email: string): Promise<string> => {
  const { rows } = await pool.query(
    `SELECT unsubscribe_token FROM volunteers WHERE lower(email) = lower($1)`, [email]);
  return rows[0].unsubscribe_token;
};

export const verifyViaPost = (token: string) =>
  request(app).post('/api/v1/volunteers/verify').type('form').send({ token });
