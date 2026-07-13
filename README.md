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
| Logging / errors | pino (structured) + Sentry |

## Prerequisites

- Node.js >= 20 (tested on 22)
- pnpm 9 (`corepack enable pnpm`)
- Docker (for local Postgres + PostGIS)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Create your local env file
cp .env.example .env            # (PowerShell: Copy-Item .env.example .env)

# 3. Start Postgres + PostGIS
pnpm db:up

# 4. Apply migrations (creates the Phase 1 schema)
pnpm db:migrate

# 5. Run the API
pnpm --filter @surveylink/api dev
# Health check: http://localhost:4000/health
```

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
