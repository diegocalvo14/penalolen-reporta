/**
 * Pruebas de integración contra PostgreSQL + PostGIS reales (§10).
 *
 * Se ejecutan solo si TEST_DATABASE_URL está definida (en .env o en el entorno)
 * y su nombre contiene "test", porque BORRAN y recrean el esquema.
 * Con Docker:  docker compose -f infra/docker-compose.yml exec db createdb -U reporta reporta_test
 *              TEST_DATABASE_URL="postgresql://reporta:reporta@localhost:5432/reporta_test"
 */
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import * as schema from '@/db/schema';
import { NuevoReporteSchema } from '@/domain/reporte-input';
import { rutaAbsoluta } from '@/server/almacenamiento';
import { procesarImagen } from '@/server/imagenes';
import { crearBaseDePrueba, integracionHabilitada, sembrarBasico, type BaseDePrueba } from '@/test/db';
import { listarBandeja, listarMisReportes, obtenerDetalle } from './consultas';
import { crearReporte } from './crear';

describe.skipIf(!integracionHabilitada)('reportes contra PostGIS', () => {
  let base: BaseDePrueba;
  let db: Db;
  let uploads: string;
  let laFaena: number;
  let loHermida: number;
  let bache: number;
  let luminaria: number;
  let marta: { id: string; territorioId: number };
  let luis: { id: string; territorioId: number };

  const input = (extra: Record<string, unknown> = {}) =>
    NuevoReporteSchema.parse({
      categoriaId: luminaria,
      descripcion: 'Luminaria apagada en la esquina',
      lat: -33.4812,
      lng: -70.5785,
      origen: 'mapa',
      nVecinos: 3,
      canal: 'junta',
      ...extra,
    });

  beforeAll(async () => {
    base = await crearBaseDePrueba('registro');
    db = base.db;
    uploads = base.uploads;
    ({ laFaena, loHermida, bache, luminaria, marta, luis } = await sembrarBasico(db));
  });

  afterAll(async () => {
    await base?.cerrar();
  });

  it('crea un bache con foto: folio, respaldo inicial, imagen, análisis pendiente y evento', async () => {
    const foto = await procesarImagen(
      await sharp({ create: { width: 320, height: 240, channels: 3, background: '#555' } }).jpeg().toBuffer(),
    );
    const r = await crearReporte(db, marta, input({ categoriaId: bache, origen: 'gps', precision: 6, nVecinos: 6, canal: 'whatsapp' }), foto);

    expect(r.folio).toMatch(/^PR-\d{4}-00001$/);
    expect(r).toMatchObject({ estado: 'ingresado', territorioId: laFaena, fueraDeTerritorio: false, totalRespaldoVecinos: 6 });
    expect(r.analisis?.estado).toBe('pendiente');

    const d = await obtenerDetalle(db, r.id);
    expect(d?.respaldos).toHaveLength(1);
    expect(d?.respaldos[0]).toMatchObject({ nVecinos: 6, canal: 'whatsapp' });
    expect(d?.eventos.map((e) => e.tipo)).toEqual(['creado']);
    expect(d?.imagenes).toHaveLength(1);
    expect(d?.ubicacion.lat).toBeCloseTo(-33.4812, 6);
    expect(d?.precisionM).toBe(6);

    const [img] = await db.select().from(schema.imagenes).where(eq(schema.imagenes.reporteId, r.id));
    expect(existsSync(rutaAbsoluta(img.ruta))).toBe(true);
    expect(img.ruta).not.toMatch(/\\|\.\./); // nombre generado por el servidor
  });

  it('los folios son únicos y correlativos aunque se creen en paralelo', async () => {
    const creados = await Promise.all(Array.from({ length: 8 }, () => crearReporte(db, marta, input(), null)));
    const numeros = creados.map((c) => Number(c.folio.slice(-5))).sort((a, b) => a - b);
    expect(new Set(numeros).size).toBe(8);
    expect(numeros[7] - numeros[0]).toBe(7);
  });

  it('marca fuera de territorio cuando el punto está en otro barrio', async () => {
    const r = await crearReporte(db, marta, input({ lat: -33.4746, lng: -70.5656 }), null);
    expect(r).toMatchObject({ territorioId: loHermida, fueraDeTerritorio: true });
  });

  it('con ubicación aproximada usa el centroide guardado, no lo que envía el cliente', async () => {
    const r = await crearReporte(db, luis, input({ origen: 'centroide', lat: 0, lng: 0 }), null);
    const d = await obtenerDetalle(db, r.id);
    expect(d?.ubicacion).toEqual({ lat: -33.4745, lng: -70.5655 });
    expect(r).toMatchObject({ territorioId: loHermida, fueraDeTerritorio: false });
  });

  it('si la transacción falla, no deja la foto huérfana en disco', async () => {
    const foto = await procesarImagen(
      await sharp({ create: { width: 50, height: 50, channels: 3, background: '#111' } }).jpeg().toBuffer(),
    );
    const antes = await contarArchivos(uploads);
    const fantasma = { id: '00000000-0000-4000-8000-000000000000', territorioId: laFaena }; // usuario inexistente → FK
    await expect(crearReporte(db, fantasma, input({ categoriaId: bache }), foto)).rejects.toThrow();
    expect(await contarArchivos(uploads)).toBe(antes);
  });

  it('bandeja: orden por respaldos, filtros y "Mis reportes"', async () => {
    await crearReporte(db, luis, input({ nVecinos: 40, lat: -33.4744, lng: -70.5654 }), null);

    const porRespaldos = await listarBandeja(db, { orden: 'respaldos', pagina: 1, destacados: false });
    expect(porRespaldos.items[0].totalRespaldoVecinos).toBe(40);

    const soloLoHermida = await listarBandeja(db, { territorio: loHermida, orden: 'recientes', pagina: 1, destacados: false });
    expect(soloLoHermida.items.every((i) => i.territorio.id === loHermida)).toBe(true);

    const destacados = await listarBandeja(db, { orden: 'recientes', pagina: 1, destacados: true });
    expect(destacados.items.length).toBeGreaterThan(0);
    expect(destacados.items.every((i) => i.fueraDeTerritorio || i.analisis?.requiereRevision)).toBe(true);

    const baches = await listarBandeja(db, { categoria: bache, orden: 'recientes', pagina: 1, destacados: false });
    expect(baches.total).toBe(1);
    expect(baches.items[0].analisis).toMatchObject({ estado: 'pendiente' });

    const deLuis = await listarMisReportes(db, luis.id);
    expect(deLuis.length).toBe(2);
  });
});

async function contarArchivos(dir: string): Promise<number> {
  let total = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    total += e.isDirectory() ? await contarArchivos(path.join(dir, e.name)) : 1;
  }
  return total;
}
