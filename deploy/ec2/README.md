# EC2 staging — https://staging.bld.online

- `/api/*` → Docker API `:4000`
- `/` → Cloudflare Worker (`nginx-snippets/bld-staging-proxy.conf`)
- **DB → AWS Aurora PostgreSQL only** (encrypted, `sslmode=require`)  
  Host comes from Secrets Manager `bld/api/DATABASE_URL` / EC2 `~/BLD/stage/.env`.  
  **No local Docker Postgres.** Do not start a `db` service or use volume `bld_pgdata`.

### Keep Nginx up (do not overwrite Certbot)

Jul 2026 outage: Nginx stayed **failed for 12 days** because `nginx -t` resolved a
`*.workers.dev` host at startup (`host not found in upstream`). Fixes:

1. Proxy uses **request-time DNS** (`resolver` + `$cf_worker`) so a DNS blip cannot stop Nginx.
2. Deploy copies **only** `nginx-snippets/bld-staging-proxy.conf` — never the 443 site file.
3. `monitor-staging.yml` curls the public site every 30 minutes.

One-time on the box (after Certbot), both the `:80` and `:443` server blocks should contain:

```nginx
location /.well-known/acme-challenge/ { root /var/www/html; }
include /etc/nginx/snippets/bld-staging-proxy.conf;
```

Remove duplicated `location /` and `location /api/` from the site file so they live only in the snippet.

```bash
sudo mkdir -p /etc/nginx/snippets
sudo cp ~/BLD/stage/nginx-snippets/bld-staging-proxy.conf /etc/nginx/snippets/ 2>/dev/null || true
sudo nginx -t && sudo systemctl enable --now nginx && sudo systemctl reload nginx
sudo systemctl enable --now certbot.timer
```

If the Worker `*.workers.dev` URL changes, update `$cf_worker` in the snippet and push — deploy reloads Nginx.

Use the **stable** hostname `bld-web-staging.<account-subdomain>.workers.dev` (matches `wrangler.jsonc` `name`).
Never pin an OpenNext preview host (`<hash>-bld-web-staging.…`) — deploys update the stable name, not the preview URL.

### Database (Aurora only)

Staging API **must** use Aurora with TLS. Example (secrets, not committed):

```env
DATABASE_URL=postgresql://USER:PASSWORD@bld-aurora-pg.….rds.amazonaws.com:5432/surveylink?schema=public&sslmode=require
DIRECT_DATABASE_URL=postgresql://USER:PASSWORD@bld-aurora-pg.….rds.amazonaws.com:5432/surveylink?schema=public&sslmode=require
```

```bash
cd ~/BLD/stage
docker compose up -d api
curl http://127.0.0.1:4000/health
```

Deploy (`deploy-api.yml`) refuses `DATABASE_URL` pointing at `db` / `localhost` and deletes any leftover `bld_pgdata` volume.

On boot (production) the API checks `pg_stat_ssl` and **refuses to start** if the live DB connection is not TLS. Look for `[db-tls] Database connection encrypted` in `docker logs bld-api`.

Confirm Aurora storage encryption (KMS) with an AWS profile that can read RDS:

```bash
aws rds describe-db-clusters --region us-east-2 \
  --query 'DBClusters[].{id:DBClusterIdentifier,encrypted:StorageEncrypted,kms:KmsKeyId}'
```

No local AWS keys? Run **Verify staging security** (`verify-staging-security.yml`, also runs after every API deploy). It makes the same read-only call from the EC2 box using the **instance role** — no access keys are stored in GitHub. If the step reports `no_instance_role` or `denied`, attach a role to the instance with `rds:DescribeDBClusters` + `rds:DescribeDBInstances`.

`encrypted` must be `true`.

**Least-privilege DB role.** The API connects as `bld_app` (SELECT/INSERT/UPDATE/DELETE + sequences, no DDL, no `_prisma_migrations`). The original owner user is kept in `DIRECT_DATABASE_URL` and used only by `prisma migrate deploy`. `.env` carries `DB_APP_ROLE=bld_app`; while it is set, deploys refresh only `DIRECT_DATABASE_URL` from GitHub secrets and leave `DATABASE_URL` alone. Run **Staging DB app role (create / rotate)** to rotate the `bld_app` password (also quarterly on a schedule). If the API is not healthy on the new credential, the workflow switches `.env` back to the owner URL and removes `DB_APP_ROLE`.

**Restore drill.** **Staging restore drill** (monthly) dumps Aurora on the EC2 box, restores into a throwaway PostGIS container, compares per-table row counts, then deletes the container, dump and image. This checks logical recovery only; Aurora snapshot / PITR restore still needs AWS console access. Storage encryption cannot be turned on in place: snapshot → restore an encrypted copy with a KMS key → repoint the secrets. For certificate pinning, move from `sslmode=require` to `sslmode=verify-full&sslrootcert=/path/global-bundle.pem` (RDS CA bundle mounted into the container).

### Security layers outside the app

- **Shared rate-limit store (live):** `bld-redis` runs next to the API in `docker-compose.yml` — no host port, password-protected, memory-only (limits are ephemeral by design). Deploy generates `REDIS_PASSWORD` on the box and sets `REDIS_URL=redis://:…@redis:6379` **only if `REDIS_URL` is empty**. To move to ElastiCache (multi-host), set `REDIS_URL=rediss://…` (same VPC / SG as EC2) in `.env` and redeploy — no code change. Check: `docker logs bld-api | grep 'Rate limiting backed by Redis'`.
- **Edge rate limit (live):** Nginx per-client-IP limits, zones in `nginx-conf.d/bld-rate-limits.conf` (copied to `/etc/nginx/conf.d/`):
  - `/api/auth/(login|signup|forgot-password|reset-password|refresh|oauth/*)`: 20 req/min, burst 20, max 20 concurrent → `429`
  - all other `/api/*`: 20 req/s, burst 100, max 50 concurrent → `429`
  - Deploy backs up the live snippet/zones and **restores them if `nginx -t` fails**, so a bad config never takes Nginx down.
- **Managed WAF (not yet):** `bld.online` DNS is on Hostinger (`dns-parking.com`), so Cloudflare WAF needs the nameservers moved to Cloudflare first (then proxy `staging`, add managed rules + a rate-limit rule on `/api/auth/*`, and restore real client IPs in Nginx with `set_real_ip_from` Cloudflare ranges + `real_ip_header CF-Connecting-IP`, otherwise the Nginx per-IP limits would see Cloudflare IPs). AWS WAF needs an ALB or CloudFront in front of EC2. Nginx already forwards `X-Forwarded-For`; the API trusts one proxy hop.
- **Sessions:** set a dedicated `SESSION_SIGNING_SECRET` (rotating it signs everyone out).

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sS https://staging.bld.online/api/health
curl -sSI https://staging.bld.online/
```

### Google sign-in 500s

```bash
docker logs bld-api --tail 100
```

Confirm on the EC2 `.env`:

- `WEB_APP_URL=https://staging.bld.online`
- `AUTH0_AUDIENCE` is your **custom API** identifier (e.g. `https://api.bld.online`), **not** `…/api/v2/`
- Auth0 Application → **APIs**: authorize that Regular Web App for the audience
- Auth0 Application → Allowed Callback URLs includes `https://staging.bld.online/auth/callback`
