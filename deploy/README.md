# Deploy & CI

| Area | CI | Deploy |
|------|-----|--------|
| Packages | `ci-packages.yml` | Rebuilt with apps when `packages/**` changes |
| API | `ci-api.yml` | `deploy-api.yml` — main→EC2, `v*`→ECS |
| Web | `ci-web.yml` | `deploy-web.yml` — Cloudflare Workers |
| Mobile | `ci-mobile.yml` | `deploy-mobile.yml` |

## Staging — one hostname

| URL | Backend |
|-----|---------|
| `https://staging.bld.online/` | Web (Cloudflare Worker, proxied by Nginx) |
| `https://staging.bld.online/api/*` | API (Nest on EC2) |

DNS: `A` `staging` → EC2 Elastic IP.  
Nginx: `deploy/ec2/nginx-staging.conf` (`/api` → :4000, `/` → `*.workers.dev`).

Web env: `NEXT_PUBLIC_API_URL=https://staging.bld.online/api`  
API env: `WEB_APP_URL` + `CORS_ORIGINS` = `https://staging.bld.online`  
Auth0: callbacks/origins = `https://staging.bld.online`

## GitHub secrets (staging)

`deploy-web` and `deploy-api` use **`environment: staging`**. Add secrets/vars on that environment
(Settings → Environments → **staging**), not only as repo-wide secrets — otherwise wrangler
sees an empty `CLOUDFLARE_API_TOKEN`.

| Name | Pipeline |
|------|----------|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | deploy-web (secrets) |
| `NEXT_PUBLIC_API_URL` = `https://staging.bld.online/api` | deploy-web (variable) |
| `EC2_HOST`, `EC2_SSH_KEY` | deploy-api (secrets) |
| `EC2_USER`, `EC2_APP_DIR` | deploy-api (variables) |

Cloudflare token: [Create Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
with **Edit Cloudflare Workers** (or Workers Scripts Edit + Account Read).  
Account ID: `7a66fc4a13891644ca38d505601864b1` (Workers dashboard).

See `deploy/ec2/` for host files.
