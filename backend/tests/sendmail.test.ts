// backend/tests/sendmail.test.ts — email provider selection: Cloudflare
// Email Service preferred when CF_API_TOKEN is set, Postmark fallback,
// throw when neither is configured.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { config } from '../src/config.js';
import { cfDiagnose, emailConfigured, send } from '../src/services/outbox.js';

const originalFetch = global.fetch;
const fetchMock = jest.fn<typeof fetch>();

afterEach(() => {
  global.fetch = originalFetch;
  fetchMock.mockReset();
  config.cloudflare.accountId = '';
  config.cloudflare.token = '';
  config.cloudflare.from = '';
  config.postmark.token = '';
  config.postmark.from = '';
});

const okJson = () =>
  new Response(JSON.stringify({ success: true, result: { delivered: ['to@x.nz'], queued: [] } }), { status: 200 });

describe('emailConfigured', () => {
  it('is false with no provider, true with either token', () => {
    expect(emailConfigured()).toBe(false);
    config.postmark.token = 'pm';
    expect(emailConfigured()).toBe(true);
    config.postmark.token = '';
    config.cloudflare.token = 'cf';
    expect(emailConfigured()).toBe(true);
  });
});

describe('send', () => {
  it('throws when no provider is configured', async () => {
    await expect(send('to@x.nz', 's', 'b')).rejects.toThrow('no email provider configured');
  });

  it('sends via Cloudflare Email Service with cc', async () => {
    config.cloudflare.accountId = 'acc123';
    config.cloudflare.token = 'cftok';
    config.cloudflare.from = 'leaks@peec.biz';
    fetchMock.mockResolvedValue(okJson());
    global.fetch = fetchMock;

    await send('duty@council.govt.nz', 'Leak WL-1', 'body', 'reporter@x.nz');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.cloudflare.com/client/v4/accounts/acc123/email/sending/send');
    expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer cftok');
    expect(JSON.parse(String(init?.body))).toEqual({
      to: 'duty@council.govt.nz', from: 'leaks@peec.biz', cc: 'reporter@x.nz',
      subject: 'Leak WL-1', text: 'body',
    });
  });

  it('throws on a Cloudflare API error', async () => {
    config.cloudflare.accountId = 'a';
    config.cloudflare.token = 't';
    config.cloudflare.from = 'f@x.nz';
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, errors: [{ code: 10105, message: 'not_entitled' }] }), { status: 403 }),
    );
    global.fetch = fetchMock;
    await expect(send('to@x.nz', 's', 'b')).rejects.toThrow('cloudflare 403 [not_entitled');
  });

  it('names the cause of a Cloudflare credential failure', async () => {
    config.cloudflare.accountId = 'a';
    config.cloudflare.token = 't';
    config.cloudflare.from = 'f@x.nz';
    // Real shape from the CloudManagement#111 audit: IP-filtered account token.
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: false, errors: [{ code: 9109, message: 'Cannot use the access token from location: 203.0.113.7' }],
    }), { status: 403 }));
    global.fetch = fetchMock;
    await expect(send('to@x.nz', 's', 'b')).rejects.toThrow('[ip_blocked');
  });

  it('falls back to Postmark when CF token is unset', async () => {
    config.postmark.token = 'pmtok';
    config.postmark.from = 'leaks@example.nz';
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock;

    await send('to@x.nz', 's', 'b', 'cc@x.nz');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.postmarkapp.com/email');
    expect((init?.headers as Record<string, string>)['X-Postmark-Server-Token']).toBe('pmtok');
    expect(JSON.parse(String(init?.body)).Cc).toBe('cc@x.nz');
  });
});

describe('cfDiagnose', () => {
  const err = (code: number, message: string) => ({ success: false, errors: [{ code, message }] });
  it.each([
    [403, err(9109, 'Cannot use the access token from location: 104.28.219.9'), 'ip_blocked'],
    [403, err(9109, 'Valid user-level authentication not found'), 'wrong_token_type'],
    [401, err(10000, 'Authentication error'), 'missing_scope'],
    [401, err(1000, 'Invalid API Token'), 'invalid_token'],
    [403, err(10105, 'not_entitled'), 'not_entitled'],
    [429, {}, 'rate_limited'],
    [502, {}, 'server_error'],
  ])('status %i -> %s', (status, body, want) => {
    expect(cfDiagnose(status, body).startsWith(want as string)).toBe(true);
  });
});
