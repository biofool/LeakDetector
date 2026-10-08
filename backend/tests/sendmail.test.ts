// backend/tests/sendmail.test.ts — email provider selection: Cloudflare
// Email Service preferred when CF_API_TOKEN is set, Postmark fallback,
// throw when neither is configured.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { config } from '../src/config.js';
import { emailConfigured, send } from '../src/services/outbox.js';

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
    await expect(send('to@x.nz', 's', 'b')).rejects.toThrow('cloudflare 403');
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
