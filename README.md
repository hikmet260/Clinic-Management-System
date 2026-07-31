# Clinic Management System

Full-stack clinic management system: NestJS + Drizzle + Postgres API and a React 19 + Vite + Tailwind 4 client.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- PostgreSQL running with database `clinic_db`, role `clinic_user`, password `clinic_password`

## Quick start

From the repo root:

```sh
pnpm install
pnpm dev
```

This starts both processes in one terminal:

- API: http://localhost:3000/api
- Web: http://localhost:5173

Open http://localhost:5173 and log in.

### Seeded logins

All users have password `password123`:

| Role        | Email                     |
| ----------- | ------------------------- |
| ADMIN       | admin@clinic.com          |
| RECEPTIONIST| receptionist@clinic.com   |
| NURSE       | nurse@clinic.com          |
| DOCTOR      | doctor@clinic.com         |
| LAB_TECH    | labtech@clinic.com        |
| CASHIER     | cashier@clinic.com        |

### Fresh database

If the database is empty, create the tables and seed users from inside `packages/server`:

```sh
pnpm exec drizzle-kit push   # creates tables from src/database/schema.ts
pnpm run seed                # seeds role users
```

## Manual run (two terminals)

```sh
# terminal 1 — API
cd packages/server && pnpm dev

# terminal 2 — web
cd packages/client && pnpm dev
```

## Structure

- `packages/server` — NestJS 11 API (`/api` prefix), JWT auth, role guards, Drizzle schema (8 tables)
- `packages/client` — React 19 SPA, role-guarded routes, receptionist desk (`/queue`), nurse triage (`/triage`)

Implemented flows: JWT login, patient registration/search, queue check-in with daily tokens, nurse vitals recording (marks visit `TRIAGED`).
