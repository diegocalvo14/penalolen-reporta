/**
 * Carga los datos de ejemplo. Se puede ejecutar varias veces: actualiza lo que
 * ya existe en vez de duplicarlo. Uso: npm run db:seed
 *
 * La contraseña de los usuarios demo se toma de SEED_PASSWORD (por defecto Demo2026!).
 * Los usuarios que ya existen no se modifican; para restaurarlos a los valores
 * demo (incluida la contraseña): npm run db:seed -- --reset-usuarios
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { hashPassword } from '../src/server/auth/password';
import { CATEGORIAS, TERRITORIOS, USUARIOS } from './seed-data';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL');
  const password = process.env.SEED_PASSWORD || 'Demo2026!';
  const resetear = process.argv.includes('--reset-usuarios');

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    // Configuración (una sola fila)
    await db
      .insert(schema.configuracion)
      .values({ id: 1, umbralMedia: 8, umbralCritica: 20, umbralAlertaRespaldos: 10, visionTimeoutMs: 10000 })
      .onConflictDoNothing();

    // Territorios
    for (const t of TERRITORIOS) {
      await db
        .insert(schema.territorios)
        .values({ nombre: t.nombre, centroide: { lat: t.lat, lng: t.lng } })
        .onConflictDoUpdate({ target: schema.territorios.nombre, set: { centroide: { lat: t.lat, lng: t.lng } } });
    }
    const territorios = await db.select().from(schema.territorios);
    const idTerritorio = new Map(territorios.map((t) => [t.nombre, t.id]));

    // Categorías
    for (const c of CATEGORIAS) {
      await db
        .insert(schema.categorias)
        .values(c)
        .onConflictDoUpdate({
          target: schema.categorias.slug,
          set: {
            nombre: c.nombre,
            usaIa: c.usaIa,
            radioDuplicadoM: c.radioDuplicadoM,
            unidadResponsable: c.unidadResponsable,
            color: c.color,
          },
        });
    }

    // Usuarios
    const passwordHash = await hashPassword(password);
    for (const u of USUARIOS) {
      const territorioId = u.territorio ? idTerritorio.get(u.territorio) : undefined;
      if (u.territorio && !territorioId) throw new Error(`Territorio no encontrado: ${u.territorio}`);
      const valores = {
        nombre: u.nombre,
        email: u.email,
        passwordHash,
        rol: u.rol,
        unidad: u.unidad ?? null,
        territorioId: territorioId ?? null,
        activo: true,
      };
      const existe = await db
        .select({ id: schema.usuarios.id })
        .from(schema.usuarios)
        .where(eq(schema.usuarios.email, u.email));
      if (existe.length === 0) {
        await db.insert(schema.usuarios).values(valores);
      } else if (resetear) {
        await db.update(schema.usuarios).set(valores).where(eq(schema.usuarios.email, u.email));
      }
      // Si ya existe y no se pidió reset, se respeta (no se pisa su contraseña ni sus datos)
    }

    console.log('\n[db:seed] Datos de ejemplo cargados.');
    console.log(`  ${TERRITORIOS.length} territorios · ${CATEGORIAS.length} categorías · ${USUARIOS.length} usuarios\n`);
    console.log('  Usuarios demo (contraseña: ' + (process.env.SEED_PASSWORD ? 'la de SEED_PASSWORD' : password) + ')');
    for (const u of USUARIOS) {
      const detalle = u.unidad ?? u.territorio ?? '';
      console.log(`   - ${u.rol.padEnd(11)} ${u.email.padEnd(36)} ${detalle}`);
    }
    console.log('');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[db:seed] Error:', err);
  process.exit(1);
});
