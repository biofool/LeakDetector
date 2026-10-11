// backend/src/middleware/clientIp.ts — rate-limit client identity (#48).
// The origin is publicly reachable, so client-supplied X-Forwarded-For can
// never be trusted. Only the peec.biz PHP proxy may assert a client IP, and
// it proves itself with X-LD-Proxy-Secret (set via leak-proxy.local.php and
// PROXY_SHARED_SECRET on the VM). Everything else keys on the socket
// address, which a remote client cannot spoof.
import type { Request } from 'express';
import { config } from '../config.js';

const IPISH = /^[0-9a-fA-F.:]{3,45}$/;

export function clientIp(req: Request): string {
  if (
    config.proxySecret
    && req.headers['x-ld-proxy-secret'] === config.proxySecret
    && typeof req.headers['x-ld-client-ip'] === 'string'
    && IPISH.test(req.headers['x-ld-client-ip'].trim())
  ) {
    return req.headers['x-ld-client-ip'].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}
