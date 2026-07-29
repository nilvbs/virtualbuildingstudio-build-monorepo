# EC2 staging — https://staging.bld.online

- `/api/*` → Docker API `:4000`
- `/` → Cloudflare Worker (set hostname in `nginx-staging.conf`)
- DB → PostGIS container `bld-db` (compose service `db`)

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
