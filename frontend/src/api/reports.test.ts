// frontend/src/api/reports.test.ts — api client request shapes (fetch stubbed).
import { describe, expect, it, vi, beforeEach, type MockInstance } from 'vitest';
import { nearby, patchReport, createReport, listReports } from './reports.js';

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

let fetchMock: MockInstance;

beforeEach(() => {
  vi.restoreAllMocks();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('api client', () => {
  it('nearby() builds the spec query', async () => {
    fetchMock.mockResolvedValue(ok({ radius_m: 30, results: [] }));
    await nearby(-41.29, 174.78, 30, 12);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/reports/nearby?');
    expect(url).toContain('lat=-41.29');
    expect(url).toContain('lng=174.78');
    expect(url).toContain('radius_m=30');
    expect(url).toContain('accuracy_m=12');
  });

  it('patchReport() sends Bearer token + JSON body', async () => {
    fetchMock.mockResolvedValue(ok({ id: 1 }));
    await patchReport(1, { status: 'investigating', verified: true }, 'tok123');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/reports/1');
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'investigating', verified: true });
  });

  it('createReport() posts FormData without a JSON content-type', async () => {
    fetchMock.mockResolvedValue(ok({ id: 7, ref: 'WL-000007' }));
    const fd = new FormData();
    fd.set('category', 'berm');
    const r = await createReport(fd);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(fd);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(r.ref).toBe('WL-000007');
  });

  it('listReports() serialises filters', async () => {
    fetchMock.mockResolvedValue(ok({ page: 1, limit: 50, total: 0, results: [] }));
    await listReports({ status: 'received,investigating', council_zone_id: 3, sla: 'breached' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('status=received%2Cinvestigating');
    expect(url).toContain('council_zone_id=3');
    expect(url).toContain('sla=breached');
  });

  it('throws ApiError with the spec error shape', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'outside_service_area', message: 'no zone' } }), { status: 422 }),
    );
    await expect(listReports({})).rejects.toMatchObject({ status: 422, code: 'outside_service_area' });
  });
});
