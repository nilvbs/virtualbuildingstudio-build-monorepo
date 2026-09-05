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
                                       └─▶ Auth0 / Twilio (SMS + SendGrid email) / Sentry / S3
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
6. **S3** bucket `bld-build` for media (folders: `avatar/`, `portfolio/`, `document/`, `logo/`, `cover/`, `certificate/`; serve via CloudFront or public prefix policy).
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
    - `bld-api-task-role` (app permissions: S3 uploads).
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

## Email & SMS (Twilio SendGrid + Twilio Messaging)

The API sends verification and notification messages through:

| Channel | Provider | App code |
|---------|----------|----------|
| Email OTP + match email | **Twilio SendGrid** | `TwilioEmailSender` + `EmailOtpService` |
| Phone OTP + match SMS | **Twilio** Messaging | `TwilioSmsSender` + `LocalPhoneVerifier` |

OTP codes are generated and stored hashed in Postgres (`contact_otps`). Twilio only delivers the message.

Phone numbers must be **E.164** (e.g. `+14155552671`, `+919876543210`).

### Env vars

```env
AWS_REGION=us-east-2
# Local only — on ECS use the task IAM role instead of keys:
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=

# Twilio Console → Account SID + Auth Token + a From number (E.164)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+1xxxxxxxxxx

# Twilio SendGrid (Mail Send) — API key starts with SG.
SENDGRID_API_KEY=SG.xxxxx
TWILIO_EMAIL_FROM=noreply@yourdomain.com
TWILIO_EMAIL_FROM_NAME=BLD

# Public web URL — used in match SMS/email deep links
WEB_APP_URL=https://staging.bld.online

# Media uploads — S3 only; DB stores public HTTPS URLs
S3_BUCKET=bld-build
```

If SendGrid is unset, email logs a stub and does not call the API.
SMS requires Twilio credentials (phone OTP fails closed; match SMS is best-effort).

### IAM (task role / local IAM user)

S3 only for media (email/SMS are Twilio, not SES/SNS):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::bld-build/*"
    }
  ]
}
```

### Testing SMS on a Twilio trial

Trial accounts can only SMS **verified** destination numbers in the Twilio console.

1. Open [Twilio Console](https://console.twilio.com) → Phone Numbers → buy or use a trial number.
2. Verify your personal mobile under Verified Caller IDs (trial).
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` in `.env`.
4. Restart the API and trigger phone OTP or create an admin match.

### Testing email via SendGrid

1. Open [SendGrid](https://app.sendgrid.com) (Twilio) → create an API key with **Mail Send**.
2. Verify a Single Sender or authenticate your domain.
3. Set `SENDGRID_API_KEY`, `TWILIO_EMAIL_FROM`, `TWILIO_EMAIL_FROM_NAME` in `.env`.
4. Restart the API and trigger email OTP or create an admin match.

### Match notifications

When an admin creates a match, both the client and surveyor receive:

- In-app notification (web toast bottom-right)
- Email via SendGrid (with deep link)
- SMS via Twilio (with deep link), when a phone is on the account

### OTP flow (already implemented)

```
Generate 6-digit OTP
       │
       ▼
Hash + store in contact_otps (10 min TTL)
       │
       ▼
Email → SendGrid Mail Send
SMS   → Twilio Messages.create
       │
       ▼
User enters code → verify hash → mark consumed
```

Provider swap stays behind `SmsSender` / `EmailSender` / `PhoneVerifier` interfaces
under `apps/api/src/notifications/delivery` and `apps/api/src/auth/phone`.

