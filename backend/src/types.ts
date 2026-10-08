// backend/src/types.ts — shared row shapes and enums (mirror of spec enums).
export const LOCATIONS = ['footpath', 'berm', 'road', 'water_meter', 'outside_tap', 'other_public'] as const;
export const SEVERITIES = ['major', 'minor'] as const;
export const STATUSES = ['received', 'investigating', 'contractor_assigned', 'resolved', 'closed_private'] as const;
export const OPEN_STATUSES = ['received', 'investigating', 'contractor_assigned'] as const;

export type Location = (typeof LOCATIONS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Status = (typeof STATUSES)[number];

export interface ReportRow {
  id: number | string;
  geom: unknown;
  gps_accuracy_m: number | null;
  category: Location;
  location_type: Location;
  severity: Severity;
  description: string;
  status: Status;
  public_note: string | null;
  reporter_name: string | null;
  reporter_contact: string | null;
  council_zone_id: number;
  sla_due_at: string;
  verified: boolean;
  is_duplicate_of: number | string | null;
  confirmation_count: number;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  zone_name?: string;
  council_id?: number;
  council_name?: string;
  entity?: string | null;
  contact_phone?: string | null;
  contact_form_url?: string | null;
  contact_app?: string | null;
  nearby_open_count?: number | string;
}

export interface PhotoRow {
  id: number | string;
  report_id: number | string;
  storage_key: string;
  thumb_key: string;
  content_type: string;
  is_hidden: boolean;
}

export interface StaffUser {
  id: string;
  role: 'council_staff' | 'council_admin' | 'platform_admin';
  council_id: number | null;
  display_name: string;
}
