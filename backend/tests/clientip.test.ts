// backend/tests/clientip.test.ts — rate-limit client identity (#48).
// No DB needed — pure middleware behaviour.
import { describe, expect, it } from '@jest/globals';
import type { Request } from 'express';
import { clientIp } from '../src/middleware/clientIp.js';

const req = (headers: Record<string, string>, remote = '203.0.113.9'): Request =>
  ({ headers, socket: { remoteAddress: remote } }) as unknown as Request;

// setup.ts sets PROXY_SHARED_SECRET=test-proxy-secret.
const SECRET = 'test-proxy-secret';

describe('clientIp (#48)', () => {
  it('uses the socket address when the proxy secret is absent or wrong', () => {
    // A direct-origin request may carry a spoofed X-Forwarded-For — never trust it.
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4' }))).toBe('203.0.113.9');
    expect(clientIp(req({ 'x-ld-client-ip': '1.2.3.4' }))).toBe('203.0.113.9');
    expect(clientIp(req({
      'x-ld-client-ip': '1.2.3.4', 'x-ld-proxy-secret': 'wrong',
    }))).toBe('203.0.113.9');
  });

  it('trusts the asserted client IP only with the proxy secret', () => {
    expect(clientIp(req({
      'x-ld-client-ip': '1.2.3.4', 'x-ld-proxy-secret': SECRET,
    }))).toBe('1.2.3.4');
    expect(clientIp(req({
      'x-ld-client-ip': '2001:db8::1', 'x-ld-proxy-secret': SECRET,
    }))).toBe('2001:db8::1');
  });

  it('rejects a non-IP asserted value even with the secret', () => {
    expect(clientIp(req({
      'x-ld-client-ip': 'evil.host/name', 'x-ld-proxy-secret': SECRET,
    }))).toBe('203.0.113.9');
  });
});
