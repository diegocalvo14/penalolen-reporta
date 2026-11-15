/** Integración: /api/metricas calculado desde Reporte y EventoHistorial (§10). */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import * as schema from '@/db/schema';
import { NuevoReporteSchema } from '@/domain/reporte-input';
import { crearBaseDePrueba, integracionHabilitada, sembrarBasico, type BaseDePrueba } from '@/test/db';
import { calcularMetricas } from './metricas';
import { crearReporte } from './reportes/crear';
import { cambiarEstado } from './reportes/gestion';

describe.skipIf(!integracionHabilitada)('métricas contra PostGIS', () => {
  let base: BaseDePrueba;
  let db: Db;
  let s: Awaited<ReturnType<typeof sembrarBasico>>;

  beforeAll(async () => {
    base = await crearBaseDePrueba('metricas');
    db = base.db;
    s = await sembrarBasico(db);
    const nuevo = (lat: number, lng: number, n: number) =>
      NuevoReporteSchema.parse({ categoriaId: s.luminaria, descripcion: 'Luminaria apagada', lat, lng, origen: 'mapa', nVecinos: n, canal: 'junta' });
    const a = await crearReporte(db, s.marta, nuevo(-33.4815, -70.579, 10), null); // La Faena
    const b = await crearReporte(db, s.marta, nuevo(-33.4746, -70.5656, 3), null); // Lo Hermida (fuera)
    await crearReporte(db, s.luis, nuevo(-33.4745, -70.5655, 1), null);
    // a: Ingresado (2 h) → En revisión (5 h) → En gestión (12 h) → Resuelto
    await cambiarEstado(db, s.carolina, a.id, { estado: 'en_revision' });
    await cambiarEstado(db, s.carolina, a.id, { estado: 'en_gestion' });
    await cambiarEstado(db, s.carolina, a.id, { estado: 'resuelto', comentario: 'Listo' });
    const horas = (h: number) => sql`now() - make_interval(hours => ${h})`;
    await db.execute(sql`UPDATE eventos_historial SET creado_en = ${horas(19)} WHERE reporte_id = ${a.id} AND estado_nuevo = 'ingresado'`);
    await db.execute(sql`UPDATE eventos_historial SET creado_en = ${horas(17)} WHERE reporte_id = ${a.id} AND estado_nuevo = 'en_revision'`);
    await db.execute(sql`UPDATE eventos_historial SET creado_en = ${horas(12)} WHERE reporte_id = ${a.id} AND estado_nuevo = 'en_gestion'`);
    await db.update(schema.reportes).set({ creadoEn: sql`now() - interval '19 hours'` }).where(eq(schema.reportes.id, a.id));
    void b;
  });
  afterAll(async () => base?.cerrar());

  it('totales, por estado, por territorio y top por respaldos', async () => {
    const m = await calcularMetricas(db);
    expect(m.totales).toMatchObject({ reportes: 3, abiertos: 2, resueltos: 1, vecinos: 14 });
    expect(m.porEstado.find((e) => e.estado === 'resuelto')?.total).toBe(1);
    expect(m.porTerritorio[0]).toMatchObject({ territorio: 'Lo Hermida', total: 2, abiertos: 2 });
    expect(m.top5Respaldos.map((r) => r.total)).toEqual([3, 1]); // solo abiertos
  });

  it('tiempo promedio por etapa desde el historial', async () => {
    const m = await calcularMetricas(db);
    const etapa = Object.fromEntries(m.tiempoPorEtapa.map((e) => [e.estado, e.horasPromedio]));
    expect(etapa.ingresado).toBeCloseTo(2, 0);
    expect(etapa.en_revision).toBeCloseTo(5, 0);
    expect(etapa.en_gestion).toBeCloseTo(12, 0);
    expect(m.horasPromedioResolucion).toBeCloseTo(19, 0);
  });

  it('filtra por territorio y por unidad responsable', async () => {
    expect((await calcularMetricas(db, { territorio: s.laFaena })).totales.reportes).toBe(1);
    expect((await calcularMetricas(db, { unidad: 'DIDECO' })).totales.reportes).toBe(0);
    expect((await calcularMetricas(db, { unidad: 'DOM' })).totales.reportes).toBe(3);
  });

  it('reportes creados por semana', async () => {
    const m = await calcularMetricas(db);
    expect(m.creadosPorSemana.reduce((acc, w) => acc + w.total, 0)).toBe(3);
  });
});
