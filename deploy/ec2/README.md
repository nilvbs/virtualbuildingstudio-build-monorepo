# EC2 staging — https://staging.bld.online

- `/api/*` → Docker API `:4000`
- `/` → Cloudflare Worker (`nginx-snippets/bld-staging-proxy.conf`)
- DB → PostGIS container `bld-db` (compose service `db`)

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

### First-time / fix PostGIS

The API **requires PostGIS**. Do **not** point staging at a plain host Postgres
without the extension (that causes `extension "postgis" is not available`).

1. Deploy syncs `docker-compose.yml` + `postgres-init/` to `~/BLD/stage` automatically.
2. In `~/BLD/stage/.env` (compose overrides DB host to `db` for api/migrate anyway):

```env
DATABASE_URL=postgresql://surveylink:surveylink@db:5432/surveylink?schema=public
DIRECT_DATABASE_URL=postgresql://surveylink:surveylink@db:5432/surveylink?schema=public
```

3. PostGIS is published on host **5436** (not 5435) so an older host Postgres on 5435 does not block deploy.
4. Start DB + migrate + API (or wait for GitHub deploy):

```bash
cd ~/BLD/stage
docker compose up -d db
docker compose run --rm migrate
docker compose up -d api
```

If a previous migrate left a failed `20260711000000_init` on the **old**
non-PostGIS database, either switch to the new `bld_pgdata` volume (default
above — clean DB) or, on that same DB after installing PostGIS:

```bash
docker compose run --rm migrate sh -c \
  "cd /app/apps/api && npx prisma migrate resolve --rolled-back 20260711000000_init && npx prisma migrate deploy"
```

GitHub `deploy-api` brings up `db`, runs `migrate`, then recreates `api`.

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
