# Deploying BLD on AWS

Reference for standing up **staging** and **production** on AWS ECS Fargate.
Repeat every step once per environment (own account/VPC or at least own
cluster, DB, secrets, and domains). Never let staging touch prod data.

## Architecture

```
Route53 ─▶ CloudFront (web, CDN) ─▶ S3 (Next.js static export)  [or Vercel]
Route53 ─▶ ALB (HTTPS, ACM cert) ─▶ ECS Fargate service (NestJS, 2..N tasks, autoscaled)
                                       │
                                       ├─▶ RDS Proxy ─▶ Aurora PostgreSQL (PostGIS) + read replica
                                       ├─▶ ElastiCache (Redis)
                                       ├─▶ S3 (portfolio uploads)
                                       └─▶ Auth0 / Twilio / SendGrid / Sentry
```

The API is **stateless** (auth = Auth0 JWTs), so it scales horizontally: add
tasks behind the ALB. All DB access goes through **RDS Proxy** so a burst of
tasks doesn't exhaust Postgres connections.

## One-time AWS resources (per environment)

1. **ECR** repository, e.g. `bld-api`.
2. **VPC** with 2+ private subnets (tasks + DB) and 2+ public subnets (ALB), NAT gateway.
3. **Aurora PostgreSQL** cluster (writer + 1 reader). Enable extensions the
   migrations need: `CREATE EXTENSION postgis; CREATE EXTENSION pgcrypto;`
4. **RDS Proxy** in front of Aurora. Use its endpoint for `DATABASE_URL`
   (pooled) and the cluster writer endpoint for `DIRECT_DATABASE_URL` (migrations).
5. **ElastiCache** (Redis) cluster — for distributed rate-limiting/caching.
6. **S3** bucket for uploads, e.g. `bld-uploads-prod` (block public access; serve via CloudFront/signed URLs).
7. **ACM** certificates for `api.bld.app` and `app.bld.app` (+ staging variants).
8. **ALB** (HTTPS:443) → target group (HTTP:4000), health check path **`/health`**,
   healthy threshold 2, interval 15s.
9. **ECS cluster** (Fargate) + **service** `bld-api` running `deploy/aws/task-definition.json`,
   desired count ≥ 2, spread across AZs.
10. **Application Auto Scaling** on the service: target-tracking on CPU ~60%
    (and/or ALB requests-per-target), min 2 / max e.g. 20.
11. **CloudWatch** log group `/ecs/bld-api`.
12. **Secrets Manager** entries under `bld/api/*` (see the `secrets` block in the task def).
13. **IAM**:
    - `bld-api-execution-role` (pull from ECR, read Secrets Manager, write logs).
    - `bld-api-task-role` (app permissions: S3 uploads, etc.).
    - `bld-api-deploy-role` — trusted by GitHub OIDC (`token.actions.githubusercontent.com`)
      for the deploy workflow (ECR push, ECS update, PassRole).
14. **Route53** records: `api.<env>.bld.app` → ALB, `app.<env>.bld.app` → CloudFront.

## Web (Next.js)

Two good options:
- **Vercel** (simplest for Next.js): connect the repo, root `apps/web`, set
  `NEXT_PUBLIC_API_URL`. `main` → staging, production branch/domain → prod.
- **AWS-native**: `next build` + static/SSR to **S3 + CloudFront** (or AWS
  Amplify Hosting). Add a `deploy-web` workflow mirroring `deploy-api`.

## GitHub setup (drives `.github/workflows/deploy-api.yml`)

Create two **Environments**: `staging` and `production`. In each:

- **Variables**: `AWS_REGION`, `ECR_REPOSITORY`, `ECS_CLUSTER`, `ECS_SERVICE`,
  `ECS_CONTAINER_NAME` (`api`).
- **Secrets**: `AWS_DEPLOY_ROLE_ARN`, `DATABASE_URL`, `DIRECT_DATABASE_URL`.
- Add **required reviewers** on `production` for a manual approval gate.

Then:
- Push to **`main`** → deploys **staging**.
- Push a tag **`vX.Y.Z`** → deploys **production**.

## Build the image locally (sanity check)

```bash
# from the repo root
docker build -f apps/api/Dockerfile -t bld-api:local .
docker run --rm -p 4000:4000 --env-file .env bld-api:local
curl localhost:4000/health
```

## Migrations

CI runs `prisma migrate deploy` (against `DIRECT_DATABASE_URL`) **before** the
new tasks roll out. Keep migrations backward-compatible so old + new tasks
coexist during the rolling deploy (zero downtime). Never `migrate dev` in CI.

## Scaling notes for millions/day

- **CDN absorbs web traffic**; cache aggressively.
- **RDS Proxy is mandatory** — set `DATABASE_URL` to the proxy endpoint.
- Route read-heavy/geo endpoints to the **Aurora reader**; cache hot reads in Redis.
- Ensure **GIST indexes** on the PostGIS `geography` columns (the SQL migration already creates them).
- Put **AWS WAF** on CloudFront/ALB for bot/DDoS protection; app-level throttling
  (`@nestjs/throttler`) is a backstop, not the front line.
