#!/bin/sh
set -e

echo "⏳ Waiting for database..."
until node -e "
import('pg').then(({ default: pkg }) => {
  const { Client } = pkg;
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));
}).catch(() => process.exit(1));
" --input-type=module 2>/dev/null; do
  echo "  not ready, retrying in 2s..."
  sleep 2
done
echo "✅ Database ready"

echo "🔄 Running migrations..."
pnpm --filter @workspace/db run push-force
echo "✅ Migrations done"

exec node --enable-source-maps /app/dist/index.mjs
