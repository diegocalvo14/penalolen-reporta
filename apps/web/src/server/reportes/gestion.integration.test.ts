/** Integración (PostGIS real): duplicados, respaldo, estados y notificaciones (Hito 3, §10). */
import { and, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import * as schema from '@/db/schema';
import { NuevoReporteSchema } from '@/domain/reporte-input';
import { procesarImagen } from '@/server/imagenes';
import { listarNotificaciones, marcarLeida } from '@/server/notificaciones';
import { crearBaseDePrueba, integracionHabilitada, sembrarBasico, type BaseDePrueba } from '@/test/db';
import { listarMisReportes, listarParaMapa, obtenerDetalle } from './consultas';
import { crearReporte } from './crear';
import { buscarDuplicados } from './duplicados';
import { cambiarEstado, comentar, sumarRespaldo } from './gestion';

// Desplazamientos aproximados en Santiago: 1 m ≈ 0.000009° de latitud
const P = { lat: -33.4812, lng: -70.5785 };
const aMetrosAlNorte = (m: number) => ({ lat: P.lat + m * 0.000009, lng: P.lng });

describe.skipIf(!integracionHabilitada)('gestión de reportes contra PostGIS', () => {
  let base: BaseDePrueba;
  let db: Db;
  let s: Awaited<ReturnType<typeof sembrarBasico>>;

  const nuevo = (extra: Record<string, unknown> = {}) =>
    NuevoReporteSchema.parse({
      categoriaId: s.luminaria,
      descripcion: 'Luminaria apagada en la esquina',
      lat: P.lat,
      lng: P.lng,
      origen: 'mapa',
      nVecinos: 6,
      canal: 'whatsapp',
      ...extra,
    });

  beforeAll(async () => {
    base = await crearBaseDePrueba('gestion');
    db = base.db;
    s = await sembrarBasico(db);
  });
  afterAll(async () => base?.cerrar());

  describe('duplicados (RF-4.1)', () => {
    it('encuentra un reporte abierto de la misma categoría dentro del radio, con su distancia', async () => {
      const r = await crearReporte(db, s.marta, nuevo(), null);
      const q = await buscarDuplicados(db, { categoriaId: s.luminaria, punto: aMetrosAlNorte(10), origen: 'mapa' });
      expect(q.aplica).toBe(true);
      expect(q.cercanos.map((c) => c.id)).toContain(r.id);
      const c = q.cercanos.find((x) => x.id === r.id)!;
      expect(c.distanciaM).toBeGreaterThan(8);
      expect(c.distanciaM).toBeLessThan(12);
    });

    it('no sugiere fuera del radio de la categoría ni de otra categoría', async () => {
      const lejos = await buscarDuplicados(db, { categoriaId: s.luminaria, punto: aMetrosAlNorte(40), origen: 'mapa' });
      expect(lejos.cercanos).toHaveLength(0);
      const otraCategoria = await buscarDuplicados(db, { categoriaId: s.bache, punto: P, origen: 'mapa' });
      expect(otraCategoria.cercanos).toHaveLength(0);
    });

    it('no se aplica con ubicación aproximada ni con GPS menos preciso que el radio', async () => {
      expect((await buscarDuplicados(db, { categoriaId: s.luminaria, punto: P, origen: 'centroide' })).aplica).toBe(false);
      expect((await buscarDuplicados(db, { categoriaId: s.luminaria, punto: P, origen: 'gps', precision: 60 })).aplica).toBe(false);
      expect((await buscarDuplicados(db, { categoriaId: s.luminaria, punto: P, origen: 'gps', precision: 10 })).aplica).toBe(true);
    });
  });

  describe('respaldo vecinal (RF-4.3) — guion de la demo: 6 + 3 = 9', () => {
    it('otro encargado suma respaldo: total, evento, notificación y "Mis reportes"', async () => {
      const r = await crearReporte(db, s.marta, nuevo({ lat: -33.49, lng: -70.57 }), null);
      const res = await sumarRespaldo(db, s.luis, r.id, { nVecinos: 3, canal: 'presencial' });
      expect(res.totalRespaldoVecinos).toBe(9);

      const d = await obtenerDetalle(db, r.id);
      expect(d?.totalRespaldoVecinos).toBe(9);
      expect(d?.respaldos.map((x) => x.nVecinos)).toEqual([6, 3]);
      expect(d?.eventos.map((e) => e.tipo)).toEqual(['creado', 'respaldo']);

      const notifs = await listarNotificaciones(db, s.marta.id);
      expect(notifs.items[0].mensaje).toContain('sumó 3 vecinos');

      const deLuis = await listarMisReportes(db, s.luis.id);
      expect(deLuis.find((x) => x.id === r.id)?.propio).toBe(false);
    });
  });

  describe('ciclo de estados (§6)', () => {
    it('Ingresado → En revisión → En gestión → Resuelto con foto de cierre; avisa al encargado', async () => {
      const r = await crearReporte(db, s.marta, nuevo({ lat: -33.495, lng: -70.56 }), null);
      await cambiarEstado(db, s.carolina, r.id, { estado: 'en_revision' });
      await cambiarEstado(db, s.carolina, r.id, { estado: 'en_gestion', comentario: 'Cuadrilla asignada' });
      const foto = await procesarImagen(await sharp({ create: { width: 60, height: 40, channels: 3, background: '#0a0' } }).jpeg().toBuffer());
      await cambiarEstado(db, s.carolina, r.id, { estado: 'resuelto', comentario: 'Luminaria reemplazada' }, foto);

      const d = await obtenerDetalle(db, r.id);
      expect(d?.estado).toBe('resuelto');
      expect(d?.cerradoEn).not.toBeNull();
      expect(d?.imagenes.map((i) => i.tipo)).toEqual(['cierre']);
      expect(d?.eventos.map((e) => [e.tipo, e.estadoAnterior, e.estadoNuevo])).toEqual([
        ['creado', null, 'ingresado'],
        ['estado', 'ingresado', 'en_revision'],
        ['estado', 'en_revision', 'en_gestion'],
        ['cierre', 'en_gestion', 'resuelto'],
      ]);

      const avisos = await db
        .select()
        .from(schema.notificaciones)
        .where(and(eq(schema.notificaciones.reporteId, r.id), eq(schema.notificaciones.tipo, 'estado')));
      expect(avisos).toHaveLength(3);
    });

    it('rechaza transiciones no permitidas (409) y datos faltantes (400)', async () => {
      const r = await crearReporte(db, s.marta, nuevo({ lat: -33.5, lng: -70.55 }), null);
      await expect(cambiarEstado(db, s.carolina, r.id, { estado: 'resuelto', comentario: 'x' })).rejects.toMatchObject({ status: 409 });
      await cambiarEstado(db, s.carolina, r.id, { estado: 'en_revision' });
      await cambiarEstado(db, s.carolina, r.id, { estado: 'en_gestion' });
      await expect(cambiarEstado(db, s.carolina, r.id, { estado: 'derivado' })).rejects.toMatchObject({ status: 400 });
      await cambiarEstado(db, s.carolina, r.id, { estado: 'derivado', organismo: 'Empresa eléctrica (Enel)' });
      const d = await obtenerDetalle(db, r.id);
      expect(d?.organismoDerivado).toBe('Empresa eléctrica (Enel)');
      expect(d?.eventos.at(-1)).toMatchObject({ tipo: 'derivado', organismoDerivado: 'Empresa eléctrica (Enel)' });
    });

    it('Duplicado (por folio): los respaldos pasan al original (RF-4.4)', async () => {
      const original = await crearReporte(db, s.marta, nuevo({ lat: -33.47, lng: -70.58, nVecinos: 5 }), null);
      const dup = await crearReporte(db, s.luis, nuevo({ lat: -33.4701, lng: -70.58, nVecinos: 4 }), null);
      await cambiarEstado(db, s.carolina, dup.id, { estado: 'en_revision' });
      await cambiarEstado(db, s.carolina, dup.id, { estado: 'duplicado', duplicadoDe: original.folio });

      const o = await obtenerDetalle(db, original.id);
      const d = await obtenerDetalle(db, dup.id);
      expect(o?.totalRespaldoVecinos).toBe(9);
      expect(o?.respaldos).toHaveLength(2);
      expect(d?.estado).toBe('duplicado');
      expect(d?.totalRespaldoVecinos).toBe(0);
      expect(d?.eventos.at(-1)?.estadoNuevo).toBe('duplicado');
      // Luis ahora sigue el original en "Mis reportes" porque su respaldo pasó allí
      expect((await listarMisReportes(db, s.luis.id)).some((x) => x.id === original.id)).toBe(true);
    });

    it('no se puede marcar duplicado de sí mismo ni de un folio inexistente; rechazo exige motivo', async () => {
      const r = await crearReporte(db, s.marta, nuevo({ lat: -33.46, lng: -70.59 }), null);
      await cambiarEstado(db, s.carolina, r.id, { estado: 'en_revision' });
      await expect(cambiarEstado(db, s.carolina, r.id, { estado: 'duplicado', duplicadoDe: r.folio })).rejects.toMatchObject({ status: 400 });
      await expect(cambiarEstado(db, s.carolina, r.id, { estado: 'duplicado', duplicadoDe: 'PR-2026-99999' })).rejects.toMatchObject({ status: 400 });
      await expect(cambiarEstado(db, s.carolina, r.id, { estado: 'rechazado' })).rejects.toMatchObject({ status: 400 });
      await cambiarEstado(db, s.carolina, r.id, { estado: 'rechazado', motivo: 'Fuera de la comuna' });
      expect((await obtenerDetalle(db, r.id))?.motivoRechazo).toBe('Fuera de la comuna');
    });

    it('no se suma respaldo a un reporte cerrado (409)', async () => {
      const r = await crearReporte(db, s.marta, nuevo({ lat: -33.455, lng: -70.595 }), null);
      await cambiarEstado(db, s.carolina, r.id, { estado: 'en_revision' });
      await cambiarEstado(db, s.carolina, r.id, { estado: 'rechazado', motivo: 'No corresponde' });
      await expect(sumarRespaldo(db, s.luis, r.id, { nVecinos: 1, canal: 'otro' })).rejects.toMatchObject({ status: 409 });
    });
  });

  it('comentario y notificaciones: marcar una y todas como leídas', async () => {
    const r = await crearReporte(db, s.luis, nuevo({ lat: -33.45, lng: -70.6 }), null);
    await comentar(db, s.carolina, r.id, 'Se agenda visita técnica');
    const antes = await listarNotificaciones(db, s.luis.id);
    expect(antes.noLeidas).toBeGreaterThan(0);
    expect(await marcarLeida(db, s.luis.id, antes.items[0].id)).toBe(1);
    expect(await marcarLeida(db, s.marta.id, antes.items[0].id)).toBe(0); // no puede marcar las de otro
    await marcarLeida(db, s.luis.id, 'todas');
    expect((await listarNotificaciones(db, s.luis.id)).noLeidas).toBe(0);
  });

  it('mapa: devuelve coordenadas y respeta el filtro de abiertos', async () => {
    const abiertos = await listarParaMapa(db, { estado: 'abiertos', orden: 'recientes', pagina: 1, destacados: false });
    expect(abiertos.length).toBeGreaterThan(0);
    expect(abiertos.every((p) => ['ingresado', 'en_revision', 'en_gestion', 'derivado'].includes(p.estado))).toBe(true);
    expect(abiertos.every((p) => p.lat < -33 && p.lng < -70)).toBe(true);
  });
});
