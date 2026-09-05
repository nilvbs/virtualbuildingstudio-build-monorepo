# SurveyLink

A **managed** US marketplace that connects **clients** (who need a site survey) with independent
**surveyors** (laser scanning, drone, topographic, measured-building, land, scan-to-BIM).

> **Phase 1 is a managed marketplace, not self-serve.** A human admin does all matching by hand
> and coordinates off-platform. No bidding, no payments, no automated matching. The database and
> status state machines are shaped so Phase 2 (bonds, offers, payments, automated matching) can be
> layered on without a rewrite.

## Monorepo layout

```
apps/
  web/          Next.js (App Router, TS) — client, surveyor, admin
  mobile/       React Native (Expo, TS) — client & surveyor apps
  api/          NestJS modular monolith
packages/
  types/        shared TS types (status enums, DTO shapes)
  api-client/   typed backend client
  validation/   shared zod schemas
```

**Backend modules:** `auth`, `profiles`, `projects`, `matching` (admin), `notifications`, `admin`.

## Tech stack

| Layer | Choice |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Web | Next.js (React, App Router, TypeScript) |
| Mobile | React Native (Expo, TypeScript) |
| Backend | NestJS (modular monolith), TypeScript |
| Database | PostgreSQL + PostGIS |
| ORM / migrations | Prisma (migrations from commit #1) |

Data model (what each table is for): [`apps/api/prisma/DATA_MODEL.md`](apps/api/prisma/DATA_MODEL.md).
| Logging / errors | pino (structured) + Sentry |

## Prerequisites

- Node.js >= 20 (tested on 22)
- pnpm 9 (`corepack enable pnpm`)
- PostgreSQL **with PostGIS** for local data (pgAdmin)
  - This repo’s local `.env` expects `localhost:5433`, user/db `surveylink` / `surveylink`
  - On Windows: install PostGIS via **Application Stack Builder** for your Postgres version
  - Optional: Docker (`pnpm db:up`) if you prefer a container DB on port **5432** instead

## Getting started (local Postgres / pgAdmin)

```bash
# 1. Install dependencies
pnpm install

# 2. Create your local env file
cp .env.example .env            # (PowerShell: Copy-Item .env.example .env)

# 3. Start Windows/macOS Postgres (e.g. service postgresql-x64-18).
#    Do NOT run Docker surveylink-db at the same time if both use 5433.
#    In pgAdmin (as postgres): create role + database surveylink (password surveylink),
#    then on DB surveylink: CREATE EXTENSION postgis; CREATE EXTENSION pgcrypto;
#    See scripts/setup-local-postgres.sql

# 4. Apply migrations (creates the Phase 1 schema)
pnpm db:migrate

# 5. Run the API
pnpm --filter @surveylink/api dev
# Health check: http://localhost:4000/health
```

Optional Docker DB instead of local install: set `DATABASE_URL` ports to `5432`, then `pnpm db:up` before migrate.

Run everything in parallel with `pnpm dev` (Turborepo).

## Health check

The API exposes `GET /health`, which reports process status and verifies database
connectivity (a `SELECT 1` through Prisma).

```json
{ "status": "ok", "info": { "database": { "status": "up" } } }
```

## Phase 1 build order

1. ✅ Monorepo + NestJS skeleton + Postgres schema (migrations) + health check
2. Managed auth: signup, email verification, phone OTP, sessions
3. Surveyor profile form + "mapping projects to you" screen
4. Client project form (map pin) + "finding someone for you" screen
5. Admin panel: queues, surveyor browser, manual match action
6. Notifications on match (in-app + email/SMS)
7. Polish status screens; seed demo data; soft-launch one region

See `docs/` / the founding brief for full scope and guardrails.
