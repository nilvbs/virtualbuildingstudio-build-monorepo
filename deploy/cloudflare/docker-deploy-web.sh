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

# Exclude mobile so Expo's react@19.1.0 cannot hoist over Next's react@19.2.7
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/web"
  - "apps/api"
  - "packages/*"
EOF

# Default everyone (including root Next) to web's React; mobile is not in this build.
python3 - <<'PY'
import json
from pathlib import Path
p = Path("package.json")
data = json.loads(p.read_text())
overrides = data.setdefault("pnpm", {}).setdefault("overrides", {})
overrides["react"] = "19.2.7"
overrides["react-dom"] = "19.2.7"
overrides.pop("@surveylink/mobile>react", None)
overrides.pop("@surveylink/mobile>react-dom", None)
p.write_text(json.dumps(data, indent=2) + "\n")
PY

corepack enable
corepack prepare pnpm@9.15.0 --activate
# CI=true would freeze the lockfile; we rewrote overrides above for a mobile-free tree.
pnpm install --no-frozen-lockfile --filter @surveylink/web...

# Single physical React copy at the repo root (what Next resolves)
pnpm add -w react@19.2.7 react-dom@19.2.7
rm -rf apps/web/node_modules/react apps/web/node_modules/react-dom
find node_modules -type d -path '*/node_modules/react' ! -path 'node_modules/react' -prune -exec rm -rf {} + 2>/dev/null || true
find node_modules -type d -path '*/node_modules/react-dom' ! -path 'node_modules/react-dom' -prune -exec rm -rf {} + 2>/dev/null || true

echo "React resolves:"
node <<'NODE'
const assert = require('node:assert');
const path = require('node:path');
const rootReact = require.resolve('react/package.json');
const rootDom = require.resolve('react-dom/package.json');
const viaNext = require.resolve('react/package.json', { paths: [require.resolve('next/package.json')] });
const viaDom = require.resolve('react/package.json', { paths: [rootDom] });
const v = require(rootReact).version;
console.log({ version: v, rootReact, viaNext, viaDom });
assert.strictEqual(v, '19.2.7', `expected react 19.2.7, got ${v}`);
assert.strictEqual(path.dirname(rootReact), path.dirname(viaNext), 'Next must resolve the same react as root');
assert.strictEqual(path.dirname(rootReact), path.dirname(viaDom), 'react-dom must resolve the same react as root');
NODE

pnpm --filter @surveylink/web run deploy
