# EC2 staging — API image + `.env` in the same folder

## How it works

```text
/opt/bld/                              ← your EC2 folder
  docker-compose.api.staging.yml
  .env                                 ← secrets (host only)
         │
         │  docker compose up
         ▼
  container bld-api  ← image bld-api:local + env vars from .env
```

- The **image** has code only (no `.env` baked in — `.dockerignore` excludes it).
- The **`.env` file** stays on the server next to compose.
- Compose `env_file: .env` injects those variables into the process when the container starts.

You never pass `-e DATABASE_URL=...` on the CLI.

---

## Setup on EC2

```bash
sudo mkdir -p /opt/bld
sudo chown "$USER:$USER" /opt/bld
cd /opt/bld

# put compose here (scp/git)
# scp docker-compose.api.staging.yml ubuntu@EC2:/opt/bld/

# create .env in THIS same folder
cp /path/to/deploy/ec2/.env.api.example .env
nano .env
chmod 600 .env
```

Load the image (image is stored by Docker; tar can also live in this folder):

```bash
# optional: keep the tar here too
# /opt/bld/bld-api-local.tar.gz

gunzip -c bld-api-local.tar.gz | docker load
# → creates/updates Docker image tag bld-api:local

docker compose -f docker-compose.api.staging.yml up -d
docker compose -f docker-compose.api.staging.yml logs -f api
curl -sS http://127.0.0.1:4000/health
```

### Change config later

Edit `/opt/bld/.env`, then:

```bash
cd /opt/bld
docker compose -f docker-compose.api.staging.yml up -d --force-recreate api
```

No image rebuild.

### New code

```bash
docker load …          # new bld-api:local
cd /opt/bld
docker compose -f docker-compose.api.staging.yml up -d --force-recreate api
```

`.env` unchanged.

### Migrations

```bash
cd /opt/bld
docker run --rm \
  --env-file ./.env \
  --add-host=host.docker.internal:host-gateway \
  bld-api:local \
  pnpm --filter @surveylink/api exec prisma migrate deploy
```

### Reboot persistence

```bash
sudo cp deploy/ec2/bld-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bld-api.service
```

(`WorkingDirectory=/opt/bld` so compose finds `./.env`.)

---

## Deploy split (web → Cloudflare, API → EC2)

Keep the monorepo; deploy targets separately. See previous notes: web uses `NEXT_PUBLIC_API_URL`, API uses this folder + `.env`.
