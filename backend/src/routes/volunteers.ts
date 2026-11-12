// backend/src/routes/volunteers.ts — volunteer "power user" signup (#37).
// No accounts: email + token confirm/unsubscribe, matching the reporter
// model. Signup only stages the row — report alerts start after the owner
// clicks the emailed verify link (#51), and state changes are POST-only so
// mail scanners can't trigger them (#50).
// Privacy: volunteer contact details are staff-only — no public response
// returns names/emails, and signup answers identically whether the email is
// new or already registered.
// Route handlers live in sibling modules (issue #68, ≤250-line files):
//   volunteers_signup.ts     POST /
//   volunteers_tokens.ts     GET/POST /unsubscribe, /verify
//   volunteers_directory.ts  GET / (staff)
import { Router } from 'express';
import signup from './volunteers_signup.js';
import tokens from './volunteers_tokens.js';
import directory from './volunteers_directory.js';

const router = Router();
router.use(signup);
router.use(tokens);
router.use(directory);

export default router;
