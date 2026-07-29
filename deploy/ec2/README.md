# EC2 staging — https://staging.bld.online

- `/api/*` → Docker API `:4000`
- `/` → Cloudflare Worker (set hostname in `nginx-staging.conf`)

```bash
cd ~/BLD/stage
docker compose up -d
# Apply Prisma migrations (also runs automatically on GitHub deploy-api):
docker run --rm --env-file .env --add-host=host.docker.internal:host-gateway bld-api:local \
  sh -c "cd /app/apps/api && npx prisma migrate deploy"
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
