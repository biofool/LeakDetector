// backend/tests/volunteers_access.test.ts — council listing + staff-token
// edge cases, split out of volunteers.test.ts (issue #68). Every test here
// is self-contained: none depends on volunteer rows created by other tests,
// so the file is safe under jest's parallel scheduling on the shared test DB.
import { afterAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app, pool } from './volunteerHelpers.js';

afterAll(() => pool.end());

describe('GET /api/v1/councils', () => {
  it('lists councils + zones, id/name only', async () => {
    const res = await request(app).get('/api/v1/councils');
    expect(res.status).toBe(200);
    const demo = res.body.results.find((c: { name: string }) => c.name === 'Demo City Council');
    expect(demo.zones.map((z: { name: string }) => z.name)).toContain('Citywide');
    expect(demo.alert_emails).toBeUndefined();
  });
});

describe('GET /api/v1/volunteers (staff only)', () => {
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
