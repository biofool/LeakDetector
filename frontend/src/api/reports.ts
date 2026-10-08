// frontend/src/api/reports.ts — typed client for the /api/v1 backend.
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8080';
const API = `${BASE.replace(/\/$/, '')}/api/v1`;

export type Location = 'footpath' | 'berm' | 'road' | 'water_meter' | 'outside_tap' | 'other_public';
export type Severity = 'major' | 'minor';
export type Status = 'received' | 'investigating' | 'contractor_assigned' | 'resolved' | 'closed_private';
export type SlaStatus = 'on_track' | 'due_soon' | 'breached' | 'met' | 'missed' | 'n/a';

export interface Report {
  id: number;
  ref: string;
  category: Location;
  location_type: Location;
  severity: Severity;
  status: Status;
  description: string;
  public_note: string | null;
  lat: number;
  lng: number;
  council_zone: { id: number; name: string; council: string };
  verified: boolean;
  is_duplicate_of: number | null;
  confirmation_count: number;
  sla_due_at: string;
  sla_status: SlaStatus;
  photos: { id: number; url: string; thumb_url: string }[];
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  status_history?: { from_status: string | null; to_status: string; at: string }[];
  // staff-only
  reporter_name?: string | null;
  reporter_contact?: string | null;
  gps_accuracy_m?: number | null;
  nearby_open_count?: number;
}

export interface NearbyResult {
  id: number;
  ref: string;
  category: Location;
  severity: Severity;
  status: Status;
  distance_m: number;
  confirmation_count: number;
  created_at: string;
  resolved_at: string | null;
  thumb_url: string | null;
}

export interface CreatedReport {
  id: number;
  ref: string;
  status: Status;
  council_zone: { id: number; name: string; council: string };
  sla_due_at: string;
  tracking_url: string;
  possible_duplicates: { id: number; distance_m: number; status: Status }[];
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'error', e.message ?? `request failed (${res.status})`);
  }
  return body as T;
}

export const createReport = (form: FormData) =>
  req<CreatedReport>('/reports', { method: 'POST', body: form });

export const nearby = (lat: number, lng: number, radiusM = 30, accuracyM?: number) => {
  const p = new URLSearchParams({ lat: String(lat), lng: String(lng), radius_m: String(radiusM) });
  if (accuracyM !== undefined) p.set('accuracy_m', String(accuracyM));
  return req<{ radius_m: number; results: NearbyResult[] }>(`/reports/nearby?${p}`);
};

export const getReport = (id: number | string, token?: string) =>
  req<Report>(`/reports/${id}`, {}, token);

export const confirmReport = (id: number | string) =>
  req<{ id: number; confirmation_count: number }>(`/reports/${id}/confirm`, { method: 'POST' });

export interface ListParams {
  status?: string;
  category?: string;
  severity?: string;
  council_zone_id?: number;
  sla?: 'on_track' | 'due_soon' | 'breached';
  updated_since?: string;
  include_duplicates?: boolean;
  sort?: 'sla_due_at' | '-created_at';
  page?: number;
  limit?: number;
}

export const listReports = (params: ListParams = {}, token?: string) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) p.set(k, String(v));
  }
  return req<{ page: number; limit: number; total: number; results: Report[] }>(`/reports?${p}`, {}, token);
};

export interface PatchBody {
  status?: Status;
  severity?: Severity;
  location_type?: Location;
  verified?: boolean;
  is_duplicate_of?: number | null;
  public_note?: string | null;
}

export const patchReport = (id: number | string, patch: PatchBody, token: string) =>
  req<Report>(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, token);

export const patchPhotoHidden = (reportId: number | string, photoId: number | string, hidden: boolean, token: string) =>
  req<{ id: number; is_hidden: boolean }>(`/reports/${reportId}/photos/${photoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_hidden: hidden }),
  }, token);

export interface StaffSession {
  token: string;
  user: { id: string; display_name: string; role: string; council_id: number | null };
}

export const login = (email: string, password: string) =>
  req<StaffSession>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

const TOKEN_KEY = 'ld_staff_token';
export const session = {
  get(): StaffSession | null {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null'); } catch { return null; }
  },
  set(s: StaffSession) { localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); },
  clear() { localStorage.removeItem(TOKEN_KEY); },
};
