/**
 * Base de datos aislada para pruebas de integración. Cada archivo de pruebas
 * crea su propia base (a partir de TEST_DATABASE_URL), así pueden correr en
 * paralelo sin pisarse. Requiere un usuario con permiso CREATEDB (el de Docker lo tiene).
 */
import 'dotenv/config';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';
import type { Db } from '@/db';
import * as schema from '@/db/schema';

export const URL_TEST = process.env.TEST_DATABASE_URL;
export const integracionHabilitada = Boolean(URL_TEST && /test/i.test(URL_TEST));

export interface BaseDePrueba {
  db: Db;
  pool: Pool;
  uploads: string;
  cerrar: () => Promise<void>;
}

export async function crearBaseDePrueba(nombre: string): Promise<BaseDePrueba> {
  if (!URL_TEST) throw new Error('Falta TEST_DATABASE_URL');
  const base = new URL(URL_TEST);
  const nombreDb = `${base.pathname.slice(1)}_${nombre}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();

  // Se conecta a la base de mantenimiento "postgres" para crear/borrar: así la
  // base nombrada en TEST_DATABASE_URL no necesita existir (solo da el prefijo).
  const urlAdmin = new URL(URL_TEST);
  urlAdmin.pathname = '/postgres';
  const admin = new Client({ connectionString: urlAdmin.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${nombreDb}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${nombreDb}"`);
  await admin.end();

  const url = new URL(URL_TEST);
  url.pathname = `/${nombreDb}`;
  const pool = new Pool({ connectionString: url.toString(), max: 6 });
  await migrate(drizzle(pool), { migrationsFolder: path.resolve(__dirname, '../../drizzle') });

  const uploads = await mkdtemp(path.join(os.tmpdir(), `reporta-${nombre}-`));
  process.env.UPLOAD_DIR = uploads;

  return {
    db: drizzle(pool, { schema }) as unknown as Db,
    pool,
    uploads,
    cerrar: async () => {
      await pool.end();
      await rm(uploads, { recursive: true, force: true });
    },
  };
}

/** Datos mínimos: 2 territorios, 2 categorías, 2 encargados y 1 funcionario. */
export async function sembrarBasico(db: Db) {
  const [laFaena, loHermida] = await db
    .insert(schema.territorios)
    .values([
      { nombre: 'La Faena', centroide: { lat: -33.4815, lng: -70.579 } },
      { nombre: 'Lo Hermida', centroide: { lat: -33.4745, lng: -70.5655 } },
    ])
    .returning();
  const [bache, luminaria] = await db
    .insert(schema.categorias)
    .values([
      { nombre: 'Bache', slug: 'bache', usaIa: true, radioDuplicadoM: 15, unidadResponsable: 'DOM' },
      { nombre: 'Luminaria en falla', slug: 'luminaria', radioDuplicadoM: 25, unidadResponsable: 'DOM' },
    ])
    .returning();
  const [marta, luis, carolina] = await db
    .insert(schema.usuarios)
    .values([
      { nombre: 'Marta', email: 'marta@test', passwordHash: 'x', rol: 'encargado', territorioId: laFaena.id },
      { nombre: 'Luis', email: 'luis@test', passwordHash: 'x', rol: 'encargado', territorioId: loHermida.id },
      { nombre: 'Carolina', email: 'carolina@test', passwordHash: 'x', rol: 'funcionario', unidad: 'DOM' },
    ])
    .returning();
  await db.insert(schema.configuracion).values({ id: 1 });
  return {
    laFaena: laFaena.id,
    loHermida: loHermida.id,
    bache: bache.id,
    luminaria: luminaria.id,
    marta: { id: marta.id, territorioId: laFaena.id },
    luis: { id: luis.id, territorioId: loHermida.id },
    carolina: { id: carolina.id },
  };
}
