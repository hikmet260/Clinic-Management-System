# Clinic Management System

A full-stack clinic front-office and clinical workflow system: patient registration, queue management with daily tokens, nurse triage, doctor SOAP consultations, lab orders, prescriptions (with printable PDF), cashier billing with thermal receipts, admin staff management, analytics, a live waiting-room monitor, and PWA offline support for vitals and consultations.

## Stack

| Layer    | Tech |
|----------|------|
| Backend  | NestJS 11, Drizzle ORM, Postgres (`postgres-js`), JWT, socket.io |
| Frontend | React 19, Vite 8, TypeScript (strict), Tailwind 4, Dexie (offline queue), socket.io-client, @react-pdf/renderer |
| Infra    | Docker Compose (Postgres 16), GitHub Actions (CI + deploy artifacts) |

## Repository layout

```
packages/
  server/   NestJS API  (port 3000, global /api prefix)
  client/   React PWA   (port 5173, proxies /api and /socket.io to :3000)
```

Run commands from inside a package directory (`pnpm -C packages/server …` / `pnpm -C packages/client …`). Root `pnpm dev` starts both.

## Quick start

Prerequisites: Node 22, pnpm 10, Docker.

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install dependencies
pnpm install                 # root convenience deps only
pnpm -C packages/server install
pnpm -C packages/client install

# 3. Create the schema and seed users
pnpm -C packages/server db:migrate
pnpm -C packages/server seed

# 4. Run both dev servers
pnpm dev                     # API on :3000, web on :5173
```

Open http://localhost:5173 and sign in with any account below.

### Seed accounts (password: `password123`)

| Email | Role |
|-------|------|
| `admin@clinic.com` | ADMIN |
| `doctor@clinic.com` | DOCTOR |
| `nurse@clinic.com` | NURSE |
| `receptionist@clinic.com` | RECEPTIONIST |
| `cashier@clinic.com` | CASHIER |
| `labtech@clinic.com` | LAB_TECH |

## Database workflow

`schema.ts` is the single source of truth. Migrations live in `packages/server/drizzle/`.

```bash
pnpm -C packages/server db:generate   # diff schema → new SQL migration
pnpm -C packages/server db:migrate    # apply migrations to DATABASE_URL
pnpm -C packages/server db:push       # (dev-only) push schema directly, no migration files
```

A fresh database only needs `db:migrate` + `seed`. The API does **not** auto-migrate on boot; run `db:migrate` as part of your deploy step. Env overrides: `DATABASE_URL` (default `postgres://clinic_user:clinic_password@localhost:5432/clinic_db`), plus `POSTGRES_*`/`POSTGRES_PORT` for `docker-compose.yml`.

## Testing

Server e2e tests (Vitest + supertest) cover auth, queue lifecycle, vitals, and billing against a real Postgres. They auto-create a dedicated `clinic_test` database, apply migrations, and seed the same six users.

```bash
docker compose up -d                  # Postgres must be running
pnpm -C packages/server test
```

- The test DB defaults to `postgres://clinic_user:clinic_password@localhost:5432/clinic_test`; override with `TEST_DATABASE_URL`. Creating the DB requires the `clinic_user` role to have `CREATEDB` (`ALTER ROLE clinic_user CREATEDB;`).
- The `clinic_user` created by the official Postgres Docker image is a superuser, so CI runs the same suite against a service container.
- Each test file boots a fresh Nest app and truncates all tables between tests.

The client is verified by typecheck + production build (no test framework).

## Features

- **Patients** — create, search, paginated directory, full per-visit history (vitals, consultation, invoice, lab orders, prescriptions).
- **Queue** — receptionist check-in with race-safe daily auto-incrementing tokens, today's queue with `hasVitals`/`hasConsultation`, cancel (active visits) and complete (billed visits only) with live socket broadcasts.
- **Triage** — nurse vitals (validated ranges, auto BMI), one row per visit, marks visit `TRIAGED`.
- **Consultations** — doctor SOAP notes (upsert, optional ICD-10), marks visit `IN_CONSULTATION`; order lab tests.
- **Lab** — doctor orders, lab tech records results/cancels, visit returns to `IN_CONSULTATION` when all orders resolve.
- **Prescriptions** — dynamic medication rows, one per consultation, printable/downloadable PDF.
- **Billing** — cashier itemized invoices (subtotal/discount/total, string money), mark paid, printable thermal receipt, completion gate.
- **Users** — ADMIN-only staff management (create/edit/delete, password reset, self-delete protection).
- **Analytics** — ADMIN dashboard: totals, revenue, daily trends, status/gender distributions, top ICD-10 and lab tests.
- **Monitor** — public waiting-room display (`/monitor`) with masked patient names.
- **Realtime** — socket.io `queue:changed` events drive live desk updates.
- **PWA / offline** — service worker (app-shell caching, offline fallback); vitals and consultation forms queue to IndexedDB (Dexie) when the network fails and auto-sync on reconnect.

## Security

- Every route requires a JWT by default; `@Public()` opts out, `@Roles(...)` gates by role.
- `helmet` headers, 16kb body limit, CORS allowlist, disabled `X-Powered-By`, global + login rate limits, fail-fast in production without a strong `JWT_SECRET`/`DATABASE_URL`.
- All passwords hashed with bcrypt; user list never returns hashes.

## Deployment

### Client (static PWA)

```bash
pnpm -C packages/client build   # outputs dist/ + dist/sw.js
```

Serve `dist/` from any static host (Nginx, S3+CloudFront, Vercel, etc.). The service worker is registered only in production builds, so it must be served from the same origin as `/api`. Add SPA fallback to `index.html` for client-side routes.

### Server (NestJS + Postgres)

```bash
pnpm -C packages/server install --prod
pnpm -C packages/server build
pnpm -C packages/server db:migrate   # apply migrations (also run `seed` on first boot)
node packages/server/dist/main.js
```

Required env: `DATABASE_URL`, a strong `JWT_SECRET` (server refuses to boot without them in production). Optional: `PORT` (default 3000), `CORS_ORIGIN`, `TRUST_PROXY`, `RATE_LIMIT_*`, `LOGIN_RATE_LIMIT`. Run behind a TLS-terminating reverse proxy (Nginx/Caddy/Traefik) with WebSocket upgrade support for `/socket.io`.

### CI/CD

- `.github/workflows/ci.yml` — typecheck + build both packages on every push/PR, plus a server e2e job with a Postgres service container.
- `.github/workflows/deploy.yml` — production build + artifact upload on `main` (wire the upload step to your hosting).

## Environment reference

Server `.env` (copy `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`, `TRUST_PROXY`, `RATE_LIMIT_MAX`, `RATE_LIMIT_TTL_MS`, `LOGIN_RATE_LIMIT`. Client: `VITE_*` variables are consumed by `vite.config.ts`/`src/main.tsx` if needed (none required by default).
