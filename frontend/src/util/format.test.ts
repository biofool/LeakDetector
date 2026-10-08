import { describe, expect, it } from 'vitest';
import { timeAgo } from './format.js';
import { messages } from '../i18n/messages.js';

const t = messages.en.time;

describe('timeAgo', () => {
  const now = new Date('2026-10-07T12:00:00Z').getTime();
  it('renders minutes, hours, days', () => {
    expect(timeAgo('2026-10-07T11:55:00Z', t, now)).toBe('5 min ago');
    expect(timeAgo('2026-10-07T09:00:00Z', t, now)).toBe('3 hours ago');
    expect(timeAgo('2026-10-05T12:00:00Z', t, now)).toBe('2 days ago');
    expect(timeAgo('2026-10-07T12:00:00Z', t, now)).toBe('just now');
  });
  it('renders te reo', () => {
    expect(timeAgo('2026-10-07T11:55:00Z', messages.mi.time, now)).toBe('5 meneti ki mua');
  });
});

describe('location labels', () => {
  it('uses NZ council terminology', () => {
    expect(messages.en.labels.location.berm).toContain('Berm');
    expect(messages.en.labels.location.water_meter).toContain('meter');
  });
  it('mi tree mirrors en keys', () => {
    expect(Object.keys(messages.mi.labels.location)).toEqual(
      Object.keys(messages.en.labels.location),
    );
  });
});
