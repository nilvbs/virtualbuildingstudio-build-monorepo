const { Client } = require('pg');

async function main() {
  let connectionString = process.env.DBURL;
  if (!connectionString) {
    throw new Error('DBURL env required');
  }
  // Avoid pg v8 treating sslmode=require as verify-full against RDS CA.
  connectionString = connectionString
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/\?&/, '?')
    .replace(/\?$/, '');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  const r = await client.query(
    "SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis','pgcrypto') ORDER BY 1",
  );
  console.log(JSON.stringify(r.rows));
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
