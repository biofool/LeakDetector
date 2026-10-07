import { describe, expect, it } from 'vitest';
import { timeAgo, LOCATION_LABELS } from './format.js';

describe('timeAgo', () => {
  const now = new Date('2026-10-07T12:00:00Z').getTime();
  it('renders minutes, hours, days', () => {
    expect(timeAgo('2026-10-07T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-10-07T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-10-05T12:00:00Z', now)).toBe('2 days ago');
    expect(timeAgo('2026-10-07T12:00:00Z', now)).toBe('just now');
  });
});

describe('location labels', () => {
  it('uses NZ council terminology', () => {
    expect(LOCATION_LABELS.berm).toContain('Berm');
    expect(LOCATION_LABELS.water_meter).toContain('meter');
  });
});
