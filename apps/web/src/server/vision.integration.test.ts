/** Integración: creación de reporte con visión simulada — ok, error y timeout (§10). */
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import * as schema from '@/db/schema';
import { NuevoReporteSchema } from '@/domain/reporte-input';
import { crearBaseDePrueba, integracionHabilitada, sembrarBasico, type BaseDePrueba } from '@/test/db';
import { obtenerDetalle } from './reportes/consultas';
import { crearReporte } from './reportes/crear';
import { nuevoIntentoAnalisis } from './reportes/analisis';
import { procesarAnalisis } from './vision';
import { procesarImagen } from './imagenes';

const responder = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const caja = (conf: number) => ({ x1: 0.1, y1: 0.1, x2: 0.6, y2: 0.6, confidence: conf, label: 'bache' });

describe.skipIf(!integracionHabilitada)('visión contra PostGIS', () => {
  let base: BaseDePrueba;
  let db: Db;
  let s: Awaited<ReturnType<typeof sembrarBasico>>;

  async function bache() {
    const foto = await procesarImagen(await sharp({ create: { width: 200, height: 150, channels: 3, background: '#444' } }).jpeg().toBuffer());
    const input = NuevoReporteSchema.parse({
      categoriaId: s.bache, descripcion: 'Bache profundo', lat: -33.48, lng: -70.57, origen: 'mapa', nVecinos: 6, canal: 'whatsapp',
    });
    return crearReporte(db, s.marta, input, foto);
  }

  beforeAll(async () => {
    base = await crearBaseDePrueba('vision');
    db = base.db;
    s = await sembrarBasico(db);
  });
  afterAll(async () => base?.cerrar());

  it('ok: guarda cajas y recalcula la severidad con los umbrales de la BD (no la del servicio)', async () => {
    const r = await bache();
    // El servicio dice "media", pero 25 % > 20 % → crítica con los umbrales por defecto
    const res = await procesarAnalisis(db, r.analisis!.id, { fetchImpl: responder({ boundingBoxes: [caja(0.8)], ratioCobertura: 25, severidad: 'media', engineUsed: 'ensemble' }) });
    expect(res).toEqual({ estado: 'listo', severidad: 'critica', error: null });
    const d = await obtenerDetalle(db, r.id);
    expect(d?.analisis).toMatchObject({ estado: 'listo', severidad: 'critica', ratioCobertura: 25, requiereRevision: false, engine: 'ensemble' });
    expect(d?.analisis?.boundingBoxes).toHaveLength(1);
    expect(d?.eventos.at(-1)).toMatchObject({ tipo: 'analisis', usuario: null });
  });

  it('el admin cambia los umbrales y el reanálisis usa los nuevos', async () => {
    await db.update(schema.configuracion).set({ umbralMedia: 5, umbralCritica: 30 }).where(eq(schema.configuracion.id, 1));
    const r = await bache();
    await procesarAnalisis(db, r.analisis!.id, { fetchImpl: responder({ boundingBoxes: [caja(0.8)], ratioCobertura: 25 }) });
    expect((await obtenerDetalle(db, r.id))?.analisis?.severidad).toBe('media');
    await db.update(schema.configuracion).set({ umbralMedia: 8, umbralCritica: 20 }).where(eq(schema.configuracion.id, 1));
  });

  it('sin detección o baja confianza → requiere revisión', async () => {
    const r1 = await bache();
    await procesarAnalisis(db, r1.analisis!.id, { fetchImpl: responder({ boundingBoxes: [], ratioCobertura: 0 }) });
    expect((await obtenerDetalle(db, r1.id))?.analisis).toMatchObject({ severidad: 'sin_deteccion', requiereRevision: true });
    const r2 = await bache();
    await procesarAnalisis(db, r2.analisis!.id, { fetchImpl: responder({ boundingBoxes: [caja(0.25)], ratioCobertura: 12 }) });
    expect((await obtenerDetalle(db, r2.id))?.analisis).toMatchObject({ severidad: 'media', requiereRevision: true });
  });

  it('error del servicio: el reporte queda guardado, el análisis en "error" y se puede reintentar', async () => {
    const r = await bache();
    const res = await procesarAnalisis(db, r.analisis!.id, { fetchImpl: responder({ detail: 'boom' }, 500) });
    expect(res.estado).toBe('error');
    const d = await obtenerDetalle(db, r.id);
    expect(d?.estado).toBe('ingresado');
    expect(d?.analisis).toMatchObject({ estado: 'error' });

    const nuevo = await nuevoIntentoAnalisis(db, r.id);
    await procesarAnalisis(db, nuevo, { fetchImpl: responder({ boundingBoxes: [caja(0.9)], ratioCobertura: 10 }) });
    expect((await obtenerDetalle(db, r.id))?.analisis).toMatchObject({ estado: 'listo', severidad: 'media' });
  });

  it('timeout (> tiempo límite configurado) → error con mensaje claro', async () => {
    const r = await bache();
    const lento = ((_u: string, init?: RequestInit) =>
      new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('abort'))))) as unknown as typeof fetch;
    const res = await procesarAnalisis(db, r.analisis!.id, { fetchImpl: lento, timeoutMs: 100 });
    expect(res.estado).toBe('error');
    expect(res.error).toContain('no respondió');
  });

  it('no se reintenta en categorías sin IA', async () => {
    const input = NuevoReporteSchema.parse({
      categoriaId: s.luminaria, descripcion: 'Luminaria apagada', lat: -33.48, lng: -70.57, origen: 'mapa', nVecinos: 1, canal: 'otro',
    });
    const r = await crearReporte(db, s.marta, input, null);
    await expect(nuevoIntentoAnalisis(db, r.id)).rejects.toMatchObject({ status: 409 });
  });
});
