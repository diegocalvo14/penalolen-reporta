import 'server-only';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

/**
 * Conexión única a PostgreSQL, creada recién en la primera consulta. Así
 * `next build` (por ejemplo dentro de Docker) no necesita DATABASE_URL.
 * En desarrollo se guarda en globalThis porque Next.js recarga módulos en caliente.
 */
const globalForDb = globalThis as unknown as { pgPool?: Pool; drizzleDb?: Db };

function obtenerDb(): Db {
  if (globalForDb.drizzleDb) return globalForDb.drizzleDb;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL en el archivo .env');
  }
  const pool = new Pool({ connectionString, max: 10 });
  const instancia = drizzle(pool, { schema });
  globalForDb.pgPool = pool;
  globalForDb.drizzleDb = instancia;
  return instancia;
}

export const db: Db = new Proxy({} as Db, {
  get(_objetivo, prop) {
    const real = obtenerDb();
    const valor = Reflect.get(real, prop, real);
    return typeof valor === 'function' ? valor.bind(real) : valor;
  },
});

export { schema };
