/**
 * Aplica las migraciones SQL de /drizzle sobre DATABASE_URL.
 * Uso: npm run db:migrate   (también lo ejecuta el contenedor web al iniciar)
 */
import 'dotenv/config';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL');

  const pool = new Pool({ connectionString, max: 1 });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '..', 'drizzle') });
    console.log('[db:migrate] Migraciones aplicadas.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[db:migrate] Error:', err);
  process.exit(1);
});
