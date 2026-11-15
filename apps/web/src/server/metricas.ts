/**
 * Métricas del trabajo (RF-9.1), calculadas desde `reportes` y `eventos_historial`.
 * Las usan GET /api/metricas, la vista de métricas y el bloque [MÉTRICAS] del copiloto.
 */
import { and, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/db';
import { categorias, reportes, type EstadoReporte, type Unidad } from '@/db/schema';
import { ESTADOS, ESTADOS_ABIERTOS } from '@/domain/estados';

export const FiltrosMetricasSchema = z.object({
  desde: z.preprocess((v) => (v ? v : undefined), z.coerce.date().optional()),
  hasta: z.preprocess((v) => (v ? v : undefined), z.coerce.date().optional()),
  territorio: z.preprocess((v) => (v ? v : undefined), z.coerce.number().int().positive().optional()),
  categoria: z.preprocess((v) => (v ? v : undefined), z.coerce.number().int().positive().optional()),
  unidad: z.preprocess((v) => (v ? v : undefined), z.enum(['DOM', 'DIDECO']).optional()),
});
export type FiltrosMetricas = z.infer<typeof FiltrosMetricasSchema>;

export interface Metricas {
  filtros: { desde: string | null; hasta: string | null; territorio: number | null; categoria: number | null; unidad: Unidad | null };
  totales: { reportes: number; abiertos: number; resueltos: number; cerrados: number; vecinos: number };
  porEstado: Array<{ estado: EstadoReporte; total: number }>;
  porCategoria: Array<{ categoria: string; color: string; total: number; abiertos: number }>;
  porTerritorio: Array<{ territorio: string; total: number; abiertos: number }>;
  abiertosPorSeveridad: Array<{ severidad: string; total: number }>;
  tiempoPorEtapa: Array<{ estado: EstadoReporte; horasPromedio: number; muestras: number }>;
  horasPromedioResolucion: number | null;
  top5Respaldos: Array<{ id: string; folio: string; categoria: string; territorio: string; total: number; estado: EstadoReporte }>;
  creadosPorSemana: Array<{ semana: string; total: number }>;
}

function condiciones(f: FiltrosMetricas): SQL | undefined {
  const c: SQL[] = [];
  if (f.desde) c.push(gte(reportes.creadoEn, f.desde));
  if (f.hasta) c.push(lte(reportes.creadoEn, f.hasta));
  if (f.territorio) c.push(eq(reportes.territorioId, f.territorio));
  if (f.categoria) c.push(eq(reportes.categoriaId, f.categoria));
  if (f.unidad) c.push(eq(categorias.unidadResponsable, f.unidad));
  return c.length ? and(...c) : undefined;
}

const num = (v: unknown) => Number(v ?? 0);
const ABIERTOS_SQL = sql.raw(`(${ESTADOS_ABIERTOS.map((e) => `'${e}'`).join(',')})`);

export async function calcularMetricas(db: Db, f: FiltrosMetricas = {}): Promise<Metricas> {
  const where = condiciones(f);
  const filtroSql = where ? sql`AND ${where}` : sql``;
  const base = sql`FROM reportes JOIN categorias ON categorias.id = reportes.categoria_id JOIN territorios ON territorios.id = reportes.territorio_id WHERE TRUE ${filtroSql}`;

  const [totales, porEstado, porCategoria, porTerritorio, etapas, resolucion, top, semanas] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) AS reportes,
        COUNT(*) FILTER (WHERE reportes.estado IN ${ABIERTOS_SQL}) AS abiertos,
        COUNT(*) FILTER (WHERE reportes.estado = 'resuelto') AS resueltos,
        COUNT(*) FILTER (WHERE reportes.estado NOT IN ${ABIERTOS_SQL}) AS cerrados,
        COALESCE(SUM(reportes.total_respaldo_vecinos), 0) AS vecinos ${base}`),
    db.execute(sql`SELECT reportes.estado AS estado, COUNT(*) AS total ${base} GROUP BY reportes.estado`),
    db.execute(sql`SELECT categorias.nombre AS categoria, categorias.color AS color, COUNT(*) AS total,
        COUNT(*) FILTER (WHERE reportes.estado IN ${ABIERTOS_SQL}) AS abiertos ${base}
        GROUP BY categorias.nombre, categorias.color ORDER BY total DESC`),
    db.execute(sql`SELECT territorios.nombre AS territorio, COUNT(*) AS total,
        COUNT(*) FILTER (WHERE reportes.estado IN ${ABIERTOS_SQL}) AS abiertos ${base}
        GROUP BY territorios.nombre ORDER BY total DESC`),
    db.execute(sql`WITH ev AS (
        SELECT e.estado_nuevo AS estado, e.creado_en,
               LEAD(e.creado_en) OVER (PARTITION BY e.reporte_id ORDER BY e.creado_en, e.id) AS siguiente
        FROM eventos_historial e
        JOIN reportes ON reportes.id = e.reporte_id
        JOIN categorias ON categorias.id = reportes.categoria_id
        WHERE e.estado_nuevo IS NOT NULL ${filtroSql})
      SELECT estado, AVG(EXTRACT(EPOCH FROM (siguiente - creado_en))) / 3600.0 AS horas, COUNT(*) AS muestras
      FROM ev WHERE siguiente IS NOT NULL GROUP BY estado`),
    db.execute(sql`SELECT AVG(EXTRACT(EPOCH FROM (reportes.cerrado_en - reportes.creado_en))) / 3600.0 AS horas ${base}
        AND reportes.estado = 'resuelto' AND reportes.cerrado_en IS NOT NULL`),
    db.execute(sql`SELECT reportes.id, reportes.folio, categorias.nombre AS categoria, territorios.nombre AS territorio,
        reportes.total_respaldo_vecinos AS total, reportes.estado ${base} AND reportes.estado IN ${ABIERTOS_SQL}
        ORDER BY reportes.total_respaldo_vecinos DESC, reportes.creado_en ASC LIMIT 5`),
    db.execute(sql`SELECT to_char(date_trunc('week', reportes.creado_en AT TIME ZONE 'America/Santiago'), 'YYYY-MM-DD') AS semana,
        COUNT(*) AS total ${base}
        AND reportes.creado_en >= now() - interval '12 weeks'
        GROUP BY 1 ORDER BY 1`),
  ]);

  // Severidad del último análisis de cada reporte abierto con IA
  const sev = await db.execute(sql`SELECT COALESCE(u.severidad_sugerida::text, 'sin_analisis') AS severidad, COUNT(*) AS total
      FROM reportes
      JOIN categorias ON categorias.id = reportes.categoria_id
      JOIN territorios ON territorios.id = reportes.territorio_id
      LEFT JOIN LATERAL (
        SELECT a.severidad_sugerida FROM analisis_ia a
        WHERE a.reporte_id = reportes.id AND a.estado = 'listo'
        ORDER BY a.creado_en DESC LIMIT 1
      ) u ON TRUE
      WHERE categorias.usa_ia AND reportes.estado IN ${ABIERTOS_SQL} ${filtroSql}
      GROUP BY 1`);

  const t = totales.rows[0] as Record<string, unknown>;
  const conteoEstado = new Map((porEstado.rows as Array<{ estado: EstadoReporte; total: unknown }>).map((r) => [r.estado, num(r.total)]));
  const ordenSev = ['critica', 'media', 'baja', 'sin_deteccion', 'sin_analisis'];

  return {
    filtros: {
      desde: f.desde?.toISOString() ?? null,
      hasta: f.hasta?.toISOString() ?? null,
      territorio: f.territorio ?? null,
      categoria: f.categoria ?? null,
      unidad: f.unidad ?? null,
    },
    totales: {
      reportes: num(t.reportes),
      abiertos: num(t.abiertos),
      resueltos: num(t.resueltos),
      cerrados: num(t.cerrados),
      vecinos: num(t.vecinos),
    },
    porEstado: ESTADOS.map((estado) => ({ estado, total: conteoEstado.get(estado) ?? 0 })),
    porCategoria: (porCategoria.rows as Array<Record<string, unknown>>).map((r) => ({
      categoria: String(r.categoria),
      color: String(r.color),
      total: num(r.total),
      abiertos: num(r.abiertos),
    })),
    porTerritorio: (porTerritorio.rows as Array<Record<string, unknown>>).map((r) => ({
      territorio: String(r.territorio),
      total: num(r.total),
      abiertos: num(r.abiertos),
    })),
    abiertosPorSeveridad: (sev.rows as Array<Record<string, unknown>>)
      .map((r) => ({ severidad: String(r.severidad), total: num(r.total) }))
      .sort((a, b) => ordenSev.indexOf(a.severidad) - ordenSev.indexOf(b.severidad)),
    tiempoPorEtapa: (etapas.rows as Array<Record<string, unknown>>)
      .map((r) => ({ estado: r.estado as EstadoReporte, horasPromedio: Math.round(num(r.horas) * 10) / 10, muestras: num(r.muestras) }))
      .sort((a, b) => ESTADOS.indexOf(a.estado) - ESTADOS.indexOf(b.estado)),
    horasPromedioResolucion:
      (resolucion.rows[0] as Record<string, unknown>)?.horas == null
        ? null
        : Math.round(num((resolucion.rows[0] as Record<string, unknown>).horas) * 10) / 10,
    top5Respaldos: (top.rows as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      folio: String(r.folio),
      categoria: String(r.categoria),
      territorio: String(r.territorio),
      total: num(r.total),
      estado: r.estado as EstadoReporte,
    })),
    creadosPorSemana: (semanas.rows as Array<Record<string, unknown>>).map((r) => ({ semana: String(r.semana), total: num(r.total) })),
  };
}

/** Primer día del mes actual en hora de Chile (para "este mes"). */
export function inicioDeMes(ahora = new Date()): Date {
  const [anio, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' })
    .format(ahora)
    .split('-');
  return new Date(`${anio}-${mes}-01T00:00:00-03:00`);
}
