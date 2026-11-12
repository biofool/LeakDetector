// backend/src/routes/volunteers_tokens.ts — token action pages (GET/POST
// /unsubscribe, /verify). Public, token-based — linked from every volunteer
// email. GET renders a confirm page and never mutates (mail scanners
// prefetch links, #50); the form POST performs the change. Both return small
// bilingual HTML pages because the click lands in a browser.
import { Router } from 'express';
import { query } from '../db.js';
import { originCheck } from '../middleware/originCheck.js';

const router = Router();

// ------------------------------------------- token action pages (GET/POST)
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = (en: string, mi: string, form = '') =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${en}</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#0f172a">
<h1 style="font-size:1.25rem">${en}</h1><p>${mi}</p>${form}</body></html>`;

const confirmForm = (action: 'verify' | 'unsubscribe', token: string, label: string) =>
  `<form method="post" action="${action}"><input type="hidden" name="token" value="${esc(token)}">
<button type="submit" style="border:1px solid #0e7490;border-radius:.75rem;padding:.6rem 1rem;color:#155e75;font-weight:600;background:#fff;cursor:pointer;font-size:.9rem">${label}</button></form>`;

interface VolunteerTokenRow { id: number; active: boolean; verified: boolean }

async function byToken(raw: unknown): Promise<VolunteerTokenRow | null> {
  const token = String(raw ?? '');
  const { rows } = await query(
    'SELECT id, active, verified FROM volunteers WHERE unsubscribe_token = $1::uuid',
    [token],
  ).catch((e) => {
    // invalid uuid literal → cast error, not a 500
    if (String((e as { code?: string }).code) === '22P02') return { rows: [] };
    throw e;
  });
  return rows[0] ?? null;
}

const tokenFromBody = (req: { body: unknown }): string => {
  const b = req.body as Record<string, unknown> | undefined;
  return String(b?.token ?? '');
};

router.get('/unsubscribe', async (req, res, next) => {
  try {
    const v = await byToken(req.query.token);
    res.type('html').status(v ? 200 : 404).send(
      !v
        ? page('Link not found', 'Kāore i kitea — this unsubscribe link is invalid or already used.')
        : !v.active
          ? page('Already unsubscribed', 'Kua mutu kē — this address is already unsubscribed.')
          : page(
            'Unsubscribe from volunteer emails?',
            'Click the button to stop volunteer alert emails for this address.',
            confirmForm('unsubscribe', String(req.query.token), 'Unsubscribe'),
          ),
    );
  } catch (e) {
    next(e);
  }
});

router.post('/unsubscribe', originCheck, async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'UPDATE volunteers SET active = false WHERE unsubscribe_token = $1::uuid AND active',
      [tokenFromBody(req)],
    ).catch((e) => {
      if (String((e as { code?: string }).code) === '22P02') return { rowCount: 0 };
      throw e;
    });
    res.type('html').status(rowCount ? 200 : 404).send(
      rowCount
        ? page('You’re unsubscribed', 'Kua mutu tō whai muri — you will not get any more volunteer emails.')
        : page('Link not found', 'Kāore i kitea — this unsubscribe link is invalid or already used.'),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const v = await byToken(req.query.token);
    res.type('html').status(v ? 200 : 404).send(
      !v
        ? page('Link not found', 'Kāore i kitea — this confirmation link is invalid.')
        : v.verified && v.active
          ? page('Already confirmed', 'Kua whakaū kē — this volunteer signup is already active.')
          : page(
            'Confirm your volunteer signup',
            'Click the button to start getting volunteer alert emails for your zone.',
            confirmForm('verify', String(req.query.token), 'Confirm signup'),
          ),
    );
  } catch (e) {
    next(e);
  }
});

router.post('/verify', originCheck, async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'UPDATE volunteers SET verified = true, active = true WHERE unsubscribe_token = $1::uuid',
      [tokenFromBody(req)],
    ).catch((e) => {
      if (String((e as { code?: string }).code) === '22P02') return { rowCount: 0 };
      throw e;
    });
    res.type('html').status(rowCount ? 200 : 404).send(
      rowCount
        ? page('Signup confirmed', 'Ka rawe — you will now get volunteer alert emails for your zone.')
        : page('Link not found', 'Kāore i kitea — this confirmation link is invalid.'),
    );
  } catch (e) {
    next(e);
  }
});

export default router;
