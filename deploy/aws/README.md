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
                                       └─▶ Auth0 / SES / SNS / Sentry
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
    - `bld-api-task-role` (app permissions: S3 uploads, SES send, SNS SMS publish).
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

## Email & SMS (Amazon SES + SNS)

The API sends verification and notification messages through:

| Channel | AWS service | App code |
|---------|-------------|----------|
| Email OTP + transactional email | **SES** (SESv2) | `SesEmailSender` |
| Phone OTP + transactional SMS | **SNS** `Publish` to phone | `SnsSmsSender` + `LocalPhoneVerifier` |

OTP codes are generated and stored hashed in Postgres (`contact_otps`). SNS/SES only deliver the message. No Twilio/SendGrid.

Phone numbers must be **E.164** (e.g. `+14155552671`, `+919876543210`).

### Env vars

```env
AWS_REGION=us-east-2          # must match the region where SMS/SES are configured
# Local only — on ECS use the task IAM role instead of keys:
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_PROFILE=

SES_FROM_EMAIL=noreply@yourdomain.com
SES_FROM_NAME=BLD
# SES_CONFIGURATION_SET=

# Optional alphanumeric Sender ID (supported countries only):
# SNS_SMS_SENDER_ID=
```

If `AWS_REGION` / `SES_FROM_EMAIL` are missing, senders log `[stub email]` / `[stub sms]` and do not call AWS (local/CI safe).

### IAM (task role / local IAM user)

Minimum for SMS OTP testing and production publish:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish",
        "sns:SetSMSAttributes"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

Attach this to `bld-api-task-role` in ECS. Locally, grant the same on the IAM user behind `aws configure`.

### One-time: default SMS type = Transactional

OTP traffic should be **Transactional**. The app also sets
`AWS.SNS.SMS.SMSType=Transactional` on every `Publish`. Optionally set the
account default once (CLI):

```bash
aws sns set-sms-attributes \
  --attributes DefaultSMSType=Transactional \
  --region "$AWS_REGION"
```

### Testing SMS while still in the SNS Sandbox

In sandbox, SNS can only deliver to **verified destination phone numbers**.

1. Open **AWS End User Messaging SMS** (same region as `AWS_REGION`).
2. Go to **Verified destination phone numbers** → **Add**.
3. Enter the number in E.164 (e.g. `+91xxxxxxxxxx`).
4. Enter the verification code AWS texts you.
5. Put credentials + region in `.env` (or `aws configure`).
6. Start the API and trigger phone OTP from web/mobile onboarding.

Sandbox checklist:

- [ ] Destination number verified in that region  
- [ ] IAM allows `sns:Publish`  
- [ ] `AWS_REGION` set (otherwise the app stubs SMS)  
- [ ] Number in the app is E.164 and matches the verified number  

CLI smoke test (optional):

```bash
aws sns publish \
  --phone-number "+919876543210" \
  --message "Your BLD verification code is 123456" \
  --message-attributes '{"AWS.SNS.SMS.SMSType":{"DataType":"String","StringValue":"Transactional"}}' \
  --region "$AWS_REGION"
```

### SES (email) quick path

1. SES → verify domain or from-address in `AWS_REGION`.
2. Leave SES sandbox (or verify recipient addresses while still in sandbox).
3. Set `SES_FROM_EMAIL` / `SES_FROM_NAME` (Secrets Manager in ECS).

### Production (exit SMS sandbox)

After AWS approves **production SMS access**:

- Any E.164 destination can receive messages (no per-number verify step).
- Raise the monthly SMS spend limit if needed.
- **No application code changes** — same `PublishCommand` path.
- Keep message type **Transactional** for OTPs.

### OTP flow (already implemented)

```
Generate 6-digit OTP
       │
       ▼
Hash + store in contact_otps (10 min TTL)
       │
       ▼
SNS Publish (Transactional SMS)
       │
       ▼
User enters code → verify hash → mark consumed
```

Provider swap stays behind `SmsSender` / `EmailSender` / `PhoneVerifier` interfaces
under `apps/api/src/notifications/delivery` and `apps/api/src/auth/phone`.

