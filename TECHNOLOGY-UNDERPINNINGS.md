# Technology Underpinnings

## System structure

LeakDetector is a TypeScript monorepo with separate frontend and backend packages. The target architecture and API contract are in `docs/spec.md`. Design changes are recorded in `docs/decisions.md`.

## Public and staff web application

`frontend/src/App.tsx` defines the public report, map, tracking, volunteer, and staff routes. React 18 renders the interface. React Router handles client-side routing. Vite builds the application, and Tailwind CSS provides styling.

`frontend/src/components/LeakReportForm.tsx` implements the reporting flow. `frontend/src/components/LeafletMap.tsx` uses Leaflet for location selection and map display. `frontend/src/api/reports.ts` contains the API client. The files under `frontend/src/pages/` implement the public and staff screens.

`frontend/vite.config.ts` configures the Vite server, Tailwind plugin, and `vite-plugin-pwa`. The generated web app manifest supports installation as a progressive web app. `VITE_API_BASE_URL` selects the API, and `VITE_PUBLIC_URL` supplies absolute social preview URLs at build time.

## API and data storage

`backend/src/app.ts` assembles the Express application and its middleware. Routes under `backend/src/routes/` provide staff login, reports, councils, and volunteer operations. Zod validates request data. Helmet adds standard HTTP security headers.

PostgreSQL stores application data. PostGIS provides council-zone lookup, map bounding-box queries, and distance-based duplicate detection. `backend/migrations/001_init.sql` creates the initial schema and spatial indexes. Later files in `backend/migrations/` add status history, council contacts, submission channels, and volunteers. `backend/src/migrate.ts` applies these migrations.

`backend/src/services/zones.ts` finds the council zone for a point. `backend/src/services/duplicates.ts` searches for nearby open reports. `backend/src/services/sla.ts` calculates deadlines and status. Staff passwords use Argon2, and `backend/src/middleware/staffAuth.ts` verifies council-scoped JSON Web Tokens.

## Reports and photos

`backend/src/routes/reports.ts` accepts multipart reports, applies validation and rate limits, and returns public or staff-specific fields. The API writes the report and related notification rows through database transactions.

`backend/src/services/photos.ts` uses Sharp to apply image orientation, resize images, convert them to WebP, and remove EXIF metadata. It stores a full image and thumbnail in an S3-compatible bucket. Local disk storage is the development fallback. Hidden photos receive new storage keys so old URLs stop identifying the active object.

## Notifications and council routing

`backend/src/worker.ts` runs separately from the API. It drains the transactional notification outbox and performs periodic service-level deadline checks. Database row locks reduce duplicate delivery between workers. Failed sends retry with backoff and stop after five attempts.

`backend/src/services/outbox.ts` provides email delivery. The configuration in `backend/src/config.ts` supports Cloudflare Email Service and Postmark. `backend/src/services/submission.ts` routes council alerts to email or a generic HTTPS SMS gateway. Reserved form and vendor API channels fall back to email.

## Local and production runtime

`docker-compose.yml` starts PostGIS and MinIO for local development. The API and worker run on the host as separate Node.js processes. `backend/Dockerfile` builds TypeScript in one stage and installs production dependencies in a smaller Node.js runtime stage.

The documented production layout uses separate web, API, worker, and PostgreSQL services on Railway. The frontend builds to static files. The API and worker use the same backend build with different start commands. Production photos require durable S3-compatible storage because Railway local disks are ephemeral.

## Testing and repository checks

Backend tests use Jest and Supertest with a live PostGIS test database. Frontend unit tests use Vitest. Playwright provides frontend end-to-end testing through `npm run test:e2e`.

`.github/workflows/secret-scan.yml` scans tracked content for credential patterns. `.github/workflows/dependency-review.yml` and `.github/workflows/dependency-audit.yml` check dependency changes and known vulnerabilities. `scripts/scan_secrets.py` and `.githooks/pre-commit` provide local secret checks.
