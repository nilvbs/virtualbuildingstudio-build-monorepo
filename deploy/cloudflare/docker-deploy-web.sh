#!/usr/bin/env bash
set -euo pipefail

mkdir -p /work
tar -C /src \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.open-next \
  --exclude=.git \
  --exclude='apps/web/.env.local' \
  --exclude='apps/mobile' \
  -cf - . | tar -C /work -xf -

cd /work

# Staging public API URL (do not use local .env.local)
cat > apps/web/.env.production <<'EOF'
NEXT_PUBLIC_API_URL=https://staging.bld.online/api
NEXT_PUBLIC_AUTH_DEV_MODE=false
EOF

# Avoid mobile React 19.1.0 colliding with web 19.2.7 under hoisted linker
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/web"
  - "apps/api"
  - "packages/*"
EOF

corepack enable
corepack prepare pnpm@9.15.0 --activate
CI=true pnpm install --filter @surveylink/web...

# Force matching React versions for Next (hoist can leave 19.1.0 at root)
pnpm add -w react@19.2.7 react-dom@19.2.7 --filter @surveylink/web...

# Collapse any remaining nested copies
find node_modules -type d -path '*/node_modules/react' ! -path 'node_modules/react' -prune -exec rm -rf {} +

echo "React resolves:"
node -e "console.log('react', require('react/package.json').version, require.resolve('react')); console.log('dom', require('react-dom/package.json').version); console.log('via-dom', require.resolve('react',{paths:[require.resolve('react-dom')]}));"

pnpm --filter @surveylink/web run deploy
