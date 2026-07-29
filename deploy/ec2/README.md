# EC2 staging — https://staging.bld.online

- `/api/*` → Docker API `:4000`
- `/` → Cloudflare Worker (set hostname in `nginx-staging.conf`)

```bash
cd ~/BLD/stage
docker compose up -d
```

### Database permissions (one-time)

PostgreSQL 15+ blocks `CREATE` on `public` for non-owners. If deploy fails with
`permission denied for schema public`, grant once as the postgres superuser:

```bash
# Copy the script onto the box (or clone the repo), then:
sudo -u postgres psql -d surveylink -f ~/BLD/stage/grant-surveylink-schema.sql
# If your Postgres listens only via Docker:
# docker exec -i <postgres-container> psql -U postgres -d surveylink < grant-surveylink-schema.sql
```

Then apply migrations (also runs automatically on GitHub `deploy-api`):

```bash
docker run --rm --env-file .env --add-host=host.docker.internal:host-gateway bld-api:local \
  sh -c "cd /app/apps/api && npx prisma migrate deploy"
docker compose up -d --force-recreate api
# edit nginx REPLACE_ME → your *.workers.dev host, then:
sudo nginx -t && sudo systemctl reload nginx
curl -sS https://staging.bld.online/api/health
curl -sSI https://staging.bld.online/
```

### Google sign-in 500s

Check Auth0 + API logs:

```bash
docker logs bld-api --tail 100
```

Confirm on the EC2 `.env`:

- `WEB_APP_URL=https://staging.bld.online`
- `AUTH0_AUDIENCE` is your **custom API** identifier (e.g. `https://api.bld.online`), **not** `…/api/v2/`
- Auth0 Application → **APIs**: authorize that Regular Web App for the audience
- Auth0 Application → Allowed Callback URLs includes `https://staging.bld.online/auth/callback`
