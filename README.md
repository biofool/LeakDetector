# LeakDetector

LeakDetector is a mobile-first water-leak reporting application for New Zealand councils. Residents can locate a leak, check for nearby reports, add details and photos, and track its status. Council staff can triage reports, manage status, and monitor service-level deadlines.

## Components

| Path | Purpose |
|---|---|
| `frontend/` | React, Vite, Tailwind CSS, and Leaflet progressive web app |
| `backend/` | Express and TypeScript API, notification worker, migrations, and import scripts |
| `backend/migrations/` | PostgreSQL and PostGIS schema changes |
| `docs/` | Product brief, technical specification, decisions, and implementation gaps |
| `docker-compose.yml` | Local PostGIS and MinIO services |

## Requirements

- Node.js 20 or later
- npm
- Docker with Compose, or access to PostgreSQL 16 with PostGIS

## Local setup

1. Install dependencies.

```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Create local configuration files from the supplied examples. Do not commit the resulting `.env` files.

```bash
cd backend && cp .env.example .env
cd ../frontend && cp .env.example .env
```

The backend defaults to PostgreSQL at `127.0.0.1:5433`. The frontend defaults to the API at `http://127.0.0.1:8080`. Set a private `JWT_SECRET` outside local development.

3. Start the local backing services from the repository root.

```bash
docker compose up -d
```

This starts PostGIS on port `5433` and MinIO on ports `9000` and `9001`. MinIO provides local S3-compatible photo storage.

4. Apply migrations and load development data.

```bash
cd backend && npm run migrate && npm run seed
```

The seed creates a demonstration council, zone, and staff account. Use the seed credentials only in local development.

5. Start the API, worker, and frontend in three terminals.

```bash
cd backend && npm run dev
```

```bash
cd backend && npm run worker
```

```bash
cd frontend && npm run dev
```

Open the report form at http://127.0.0.1:5173/. The API is at http://127.0.0.1:8080/api/v1.

## Application routes

- `/` — submit a leak report
- `/map` — view the public report map
- `/r/:id` — track a submitted report
- `/reports/:id` — view a public report
- `/staff` — use the council staff dashboard
- `/welcome`, `/actions`, `/settings`, `/volunteer` — onboarding, water actions, settings, and volunteer signup

## Common commands

Run commands from the listed package directory.

| Directory | Command | Purpose |
|---|---|---|
| `backend/` | `npm run dev` | Run the API with file watching |
| `backend/` | `npm run worker` | Send queued notifications and check deadlines |
| `backend/` | `npm run migrate` | Apply SQL migrations |
| `backend/` | `npm run seed` | Load demonstration data |
| `backend/` | `npm run zones` | Import New Zealand territorial authority boundaries |
| `backend/` | `npm run contacts` | Import council contact data |
| `backend/` | `npm run build` | Compile TypeScript into `dist/` |
| `backend/` | `npm test` | Run Jest and Supertest tests against PostGIS |
| `frontend/` | `npm run dev` | Run the Vite development server |
| `frontend/` | `npm run build` | Type-check and build static files into `dist/` |
| `frontend/` | `npm test` | Run Vitest tests |
| `frontend/` | `npm run test:e2e` | Run Playwright end-to-end tests |
| `frontend/` | `npm run preview` | Serve the production build locally |

Backend tests need a live PostGIS server. They create a separate `leakdetector_test` database. Start `docker compose up -d` before running them.

## Production configuration

The backend reads configuration from environment variables. Required production values include `DATABASE_URL`, `JWT_SECRET`, `PUBLIC_BASE_URL`, and `API_PUBLIC_URL`. Set `CORS_ORIGIN` to the deployed web origin. Configure an S3-compatible bucket with the `S3_*` variables for durable photos.

The worker needs the same database configuration as the API. Configure Cloudflare Email Service or Postmark for email delivery. Configure `SMS_GATEWAY_URL` and its token only when a council uses SMS intake. If no delivery provider is available, queued messages remain pending.

The frontend reads `VITE_API_BASE_URL` and `VITE_PUBLIC_URL` at build time. Rebuild the frontend after either value changes.

## Deployment

The documented target is one Railway project with separate `web`, `api`, `worker`, and PostgreSQL services.

- Build `api` and `worker` from `backend/` with `npm run build`.
- Run `npm run start:migrate` before an API release.
- Start the API with `npm start`.
- Start the worker with `npm run start:worker`.
- Build `web` from `frontend/` with `npm run build`, then serve `frontend/dist/` as a single-page application.
- Enable PostGIS in the production database. Migration `001_init.sql` also requests the extension.
- Store all secrets in the deployment platform. Do not put secrets in repository files.

`backend/Dockerfile` can build the API image. The same image can run migrations or the worker with a command override.

## Important caveats

- Railway has no New Zealand region. Reporter contact details are personal information. Confirm offshore storage and Privacy Act 2020 obligations before launch.
- Local photo storage under `backend/data/uploads/` is not durable on Railway. Use S3-compatible storage in production.
- Uploaded JPEG, PNG, and WebP images are supported. HEIC is not supported by the current Sharp build.
- OpenStreetMap tiles are suitable for development. Review tile and basemap terms before production use.
- Public reporting endpoints use rate limits. Set proxy trust configuration correctly before placing the API behind another proxy.
- Staff authentication uses eight-hour JSON Web Tokens. Production refuses to start without `JWT_SECRET` when `NODE_ENV=production`.
- Reserved council channels such as form automation and vendor APIs currently fall back to email.

Read [`docs/README.md`](docs/README.md) for the document map. Treat [`docs/spec.md`](docs/spec.md) as the implementation contract, and check [`docs/decisions.md`](docs/decisions.md) for recorded design changes.
