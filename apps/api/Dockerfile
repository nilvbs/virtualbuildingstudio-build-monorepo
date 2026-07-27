# syntax=docker/dockerfile:1
#
# Multi-stage image for the NestJS API in this pnpm + Turborepo monorepo.
# Build from the REPO ROOT so the whole workspace is in context:
#
#   docker build -f apps/api/Dockerfile -t bld-api:latest .
#
# Stages: prune the workspace to just what @surveylink/api needs, install +
# build, then ship a slim runtime that runs the compiled server.

# ---- base: node + pnpm -----------------------------------------------------
FROM node:22-alpine AS base
# libc6-compat + openssl are required by Prisma's query engine on Alpine (musl).
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

# ---- pruner: isolate the api package + its workspace deps ------------------
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @surveylink/api --docker

# ---- installer: install deps, generate Prisma client, build ---------------
FROM base AS installer
# 1) Install against the pruned lockfile (better layer caching).
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
# 2) Bring in the pruned source + shared root configs that prune omits.
#    packages/types & validation extend ../../tsconfig.base.json.
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
# Re-link after full copy (pnpm node-linker=hoisted; keeps root node_modules intact).
RUN pnpm install --frozen-lockfile
# Prisma client must be generated before the TypeScript build (it imports it).
RUN pnpm --filter @surveylink/api run prisma:generate
# Build API and its workspace deps (types, validation).
RUN pnpm exec turbo run build --filter=@surveylink/api...

# ---- runner: slim runtime --------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache wget
# Copy the whole built workspace in one layer so pnpm's symlinked node_modules
# (and the generated Prisma client) stay intact.
COPY --from=installer /app .
# Run as the built-in non-root node user.
USER node
EXPOSE 4000
# Container-level health check (ECS/ALB also probe GET /health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${API_PORT:-4000}/health" >/dev/null 2>&1 || exit 1
CMD ["node", "apps/api/dist/main.js"]
