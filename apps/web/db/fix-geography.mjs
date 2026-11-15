/**
 * drizzle-kit escribe los tipos PostGIS entre comillas ("geography(Point, 4326)"),
 * y PostgreSQL los interpreta como un nombre de tipo literal. Este script quita
 * esas comillas en las migraciones. Se ejecuta solo con `npm run db:generate`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
const pattern = /"(geography|geometry)\(([^)"]+)\)"/g;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
  const full = path.join(dir, file);
  const sql = readFileSync(full, 'utf8');
  const fixed = sql.replace(pattern, '$1($2)');
  if (fixed !== sql) {
    writeFileSync(full, fixed);
    console.log(`[fix-geography] corregido ${file}`);
  }
}
