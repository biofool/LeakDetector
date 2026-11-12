// backend/src/routes/reports.ts — spec §3. Route handlers live in sibling
// modules by endpoint domain (issue #68, ≤250-line files):
//   reports_create.ts  POST /                    (intake, photos, outbox)
//   reports_public.ts  GET /nearby, /:id, / · POST /:id/confirm
//   reports_staff.ts   PATCH /:id, /:id/photos/:photoId
// reports_shared.ts holds the shared SELECT fragment + photo lookup.
// Mount order matters: /nearby is registered before /:id (in reports_public).
import { Router } from 'express';
import create from './reports_create.js';
import pub from './reports_public.js';
import staff from './reports_staff.js';

const router = Router();
router.use(create);
router.use(pub);
router.use(staff);

export default router;
