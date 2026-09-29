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

`encrypted` must be `true`. Storage encryption cannot be turned on in place: snapshot → restore an encrypted copy with a KMS key → repoint the secrets. For certificate pinning, move from `sslmode=require` to `sslmode=verify-full&sslrootcert=/path/global-bundle.pem` (RDS CA bundle mounted into the container).

### Security layers outside the app

- **Rate limiting:** set `REDIS_URL` (ElastiCache Redis, `rediss://` for in-transit TLS, same VPC / security group as EC2) so limits are shared across API instances. Without it limits are per-process.
- **WAF / edge:** put Cloudflare (proxied DNS + WAF managed rules + rate-limit rule on `/api/auth/*`) or AWS WAF (on an ALB / CloudFront in front of EC2) ahead of Nginx. Nginx already forwards `X-Forwarded-For`; the API trusts one proxy hop.
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
