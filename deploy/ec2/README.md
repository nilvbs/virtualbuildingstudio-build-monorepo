# EC2 staging (API)

## Layout on the server

```text
~/BLD/stage/
  docker-compose.yml    ← from deploy/ec2/docker-compose.yml
  .env                  ← from deploy/ec2/.env.example (chmod 600)
  bld-api-local.tar     ← optional; docker load once
```

Image = code. `.env` = secrets on the host. They are not merged into the image.

## Commands

```bash
cd ~/BLD/stage
docker load -i bld-api-local.tar    # first time / new build
docker compose up -d
curl -sS http://127.0.0.1:4000/health
```

Update config: edit `.env` → `docker compose up -d --force-recreate`  
Update code: new tar → `docker load` → `docker compose up -d --force-recreate`

Migrate:

```bash
cd ~/BLD/stage
docker run --rm --env-file ./.env --add-host=host.docker.internal:host-gateway \
  bld-api:local \
  pnpm --filter @surveylink/api exec prisma migrate deploy
```

## Local Docker Desktop

Use root `docker-compose.yml` (Postgres + API + migrate). Not used on EC2 when Postgres is native on the host.
