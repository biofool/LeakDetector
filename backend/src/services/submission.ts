// backend/src/services/submission.ts — council submission channels (#35).
// Each council picks one intake channel for the authority alert; 'email' is
// the universal baseline (every council publishes a mailbox). 'sms' covers
// SMS-intake utilities like Watercare (3130). 'form_automation' and
// 'vendor_api' are reserved — they need council consent / a partnership and
// fall back to email until implemented.
import { config } from '../config.js';

export type SubmissionChannel = 'email' | 'sms' | 'form_automation' | 'vendor_api';

export interface ChannelConfig {
  sms_number?: string;        // e.g. "3130" for Watercare
  email_to?: string[];        // channel-specific mailboxes (falls back to zone.alert_emails)
  form_url?: string;
  field_map?: Record<string, string>;
  api_creds_ref?: string;     // Secret Manager reference — never a value
}

export interface AlertTarget {
  channel: 'email' | 'sms';
  recipient: string;
}

const UNIMPLEMENTED: SubmissionChannel[] = ['form_automation', 'vendor_api'];

/** Resolve the council's authority-alert destination(s) for one report.
 *  Unimplemented channels fall back to email so alerts never silently drop. */
export function alertTargets(
  channel: SubmissionChannel,
  cfg: ChannelConfig,
  alertEmails: string[],
  fallbackEmail: string,
): AlertTarget[] {
  if (channel === 'sms' && cfg.sms_number) {
    return [{ channel: 'sms', recipient: cfg.sms_number }];
  }
  if (UNIMPLEMENTED.includes(channel)) {
    console.warn(`[submission] channel ${channel} not implemented — falling back to email`);
  }
  const to = cfg.email_to?.length ? cfg.email_to
    : alertEmails.length ? alertEmails
    : fallbackEmail ? [fallbackEmail] : [];
  return to.map((recipient) => ({ channel: 'email' as const, recipient }));
}

/** Compact SMS body — one 160-char segment where possible. Lat/long + the
 *  public report URL (photos can't ride an SMS, so the link carries them). */
export function smsBody(p: {
  category: string; lat: number; lng: number; tracking_url: string;
}): string {
  return `Water leak, ${p.category}. Lat ${p.lat.toFixed(5)}, long ${p.lng.toFixed(5)}. Photos: ${p.tracking_url}`;
}

/** Provider send — generic HTTPS SMS gateway (ClickSend/MessageMedia/etc.).
 *  POST {to, text} with a bearer token; defer behaviour matches Postmark. */
export async function sendSms(to: string, text: string): Promise<void> {
  if (!config.smsGateway.url) throw new Error('SMS_GATEWAY_URL not configured');
  const res = await fetch(config.smsGateway.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.smsGateway.token ? { Authorization: `Bearer ${config.smsGateway.token}` } : {}),
    },
    body: JSON.stringify({ to, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`sms gateway ${res.status}: ${await res.text()}`);
}
