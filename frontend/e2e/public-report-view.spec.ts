// frontend/e2e/public-report-view.spec.ts — /reports/:id happy path + 404.
// API is stubbed via page.route; the vite dev server serves the app.
import { test, expect } from '@playwright/test';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const REPORT = {
  id: 42,
  ref: 'WL-000042',
  category: 'road',
  location_type: 'road',
  severity: 'major',
  status: 'investigating',
  description: 'Water bubbling up through the road surface.',
  public_note: 'Contractor booked for Thursday.',
  lat: -36.8485,
  lng: 174.7633,
  council_zone: { id: 1, name: 'Citywide', council: 'Demo City Council' },
  verified: true,
  is_duplicate_of: null,
  confirmation_count: 3,
  sla_due_at: '2026-10-10T00:00:00Z',
  sla_status: 'on_track',
  photos: [
    {
      id: 7,
      url: 'http://127.0.0.1:8080/uploads/reports/42/aaaa1111.webp',
      thumb_url: 'http://127.0.0.1:8080/uploads/reports/42/aaaa1111_t.webp',
    },
  ],
  resolved_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-02T00:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/uploads/**', (route) =>
    route.fulfill({ body: PNG_1PX, contentType: 'image/webp' }),
  );
});

test('valid report id shows the read-only report view', async ({ page }) => {
  await page.route('**/api/v1/reports/42', (route) => route.fulfill({ json: REPORT }));

  await page.goto('/reports/42');

  await expect(page.getByRole('heading', { name: 'WL-000042' })).toBeVisible();
  await expect(page.getByText('Investigating').first()).toBeVisible();
  await expect(page.getByText('Water bubbling up through the road surface.')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(4); // status timeline
  await expect(page.locator('main a img')).toHaveCount(1); // photo gallery (excludes leaflet tiles)
});

test('invalid report id shows a 404 message', async ({ page }) => {
  await page.route('**/api/v1/reports/**', (route) =>
    route.fulfill({
      status: 404,
      json: { error: { code: 'not_found', message: 'report not found' } },
    }),
  );

  await page.goto('/reports/999999');

  await expect(page.getByRole('heading', { name: 'Report not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: '← View the map' })).toBeVisible();
});
