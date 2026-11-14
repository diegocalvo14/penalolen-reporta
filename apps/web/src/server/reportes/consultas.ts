/**
 * Consultas de lectura de reportes. Las usan las páginas (Server Components) y
 * la API, para que ambas muestren exactamente lo mismo.
 */
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/db';
import {
  analisisIa,
  categorias,
  eventosHistorial,
  imagenes,
  reportes,
  respaldos,
  territorios,
  usuarios,
  type EstadoReporte,
  type Severidad,
} from '@/db/schema';
import { ESTADOS_ABIERTOS } from '@/domain/estados';
import { POR_PAGINA, type FiltrosBandeja } from '@/domain/filtros-bandeja';

export interface ReporteResumen {
  id: string;
  folio: string;
  estado: EstadoReporte;
  creadoEn: Date;
  actualizadoEn: Date;
  totalRespaldoVecinos: number;
  fueraDeTerritorio: boolean;
  categoria: { id: number; nombre: string; slug: string; color: string; usaIa: boolean };
  territorio: { id: number; nombre: string };
  analisis: { estado: 'pendiente' | 'listo' | 'error'; severidad: Severidad | null; requiereRevision: boolean } | null;
}

/** Último análisis IA de cada reporte (DISTINCT ON). */
function ultimoAnalisis(db: Db) {
  return db.$with('ultimo_analisis').as(
    db
      .selectDistinctOn([analisisIa.reporteId], {
        reporteId: analisisIa.reporteId,
        estado: analisisIa.estado,
        severidad: analisisIa.severidadSugerida,
        requiereRevision: analisisIa.requiereRevision,
      })
      .from(analisisIa)
      .orderBy(analisisIa.reporteId, desc(analisisIa.creadoEn)),
  );
}

const ORDEN_SEVERIDAD = (col: unknown) =>
  sql`CASE ${col} WHEN 'critica' THEN 4 WHEN 'media' THEN 3 WHEN 'baja' THEN 2 WHEN 'sin_deteccion' THEN 1 ELSE 0 END`;

async function consultarResumenes(
  db: Db,
  where: SQL | undefined,
  orden: SQL[],
  limite: number,
  desplazamiento = 0,
): Promise<ReporteResumen[]> {
  const ua = ultimoAnalisis(db);
  const filas = await db
    .with(ua)
    .select({
      id: reportes.id,
      folio: reportes.folio,
      estado: reportes.estado,
      creadoEn: reportes.creadoEn,
      actualizadoEn: reportes.actualizadoEn,
      totalRespaldoVecinos: reportes.totalRespaldoVecinos,
      fueraDeTerritorio: reportes.fueraDeTerritorio,
      categoriaId: categorias.id,
      categoriaNombre: categorias.nombre,
      categoriaSlug: categorias.slug,
      categoriaColor: categorias.color,
      categoriaUsaIa: categorias.usaIa,
      territorioId: territorios.id,
      territorioNombre: territorios.nombre,
      analisisEstado: ua.estado,
      analisisSeveridad: ua.severidad,
      analisisRevision: ua.requiereRevision,
    })
    .from(reportes)
    .innerJoin(categorias, eq(categorias.id, reportes.categoriaId))
    .innerJoin(territorios, eq(territorios.id, reportes.territorioId))
    .leftJoin(ua, eq(ua.reporteId, reportes.id))
    .where(where)
    .orderBy(...orden)
    .limit(limite)
    .offset(desplazamiento);

  return filas.map((f) => ({
    id: f.id,
    folio: f.folio,
    estado: f.estado,
    creadoEn: f.creadoEn,
    actualizadoEn: f.actualizadoEn,
    totalRespaldoVecinos: f.totalRespaldoVecinos,
    fueraDeTerritorio: f.fueraDeTerritorio,
    categoria: { id: f.categoriaId, nombre: f.categoriaNombre, slug: f.categoriaSlug, color: f.categoriaColor, usaIa: f.categoriaUsaIa },
    territorio: { id: f.territorioId, nombre: f.territorioNombre },
    analisis: f.analisisEstado
      ? { estado: f.analisisEstado, severidad: f.analisisSeveridad, requiereRevision: Boolean(f.analisisRevision) }
      : null,
  }));
}

/** Condiciones SQL de los filtros de la bandeja (las comparten la tabla y el mapa). */
function whereBandeja(f: FiltrosBandeja): SQL | undefined {
  const condiciones: SQL[] = [];
  if (f.estado === 'abiertos') condiciones.push(inArray(reportes.estado, [...ESTADOS_ABIERTOS]));
  else if (f.estado) condiciones.push(eq(reportes.estado, f.estado as EstadoReporte));
  if (f.categoria) condiciones.push(eq(reportes.categoriaId, f.categoria));
  if (f.territorio) condiciones.push(eq(reportes.territorioId, f.territorio));
  if (f.severidad === 'sin_analisis') {
    condiciones.push(sql`NOT EXISTS (SELECT 1 FROM ${analisisIa} a WHERE a.reporte_id = ${reportes.id} AND a.estado = 'listo')`);
  } else if (f.severidad) {
    condiciones.push(sql`EXISTS (
      SELECT 1 FROM (
        SELECT DISTINCT ON (a.reporte_id) a.severidad_sugerida
        FROM ${analisisIa} a WHERE a.reporte_id = ${reportes.id}
        ORDER BY a.reporte_id, a.creado_en DESC
      ) u WHERE u.severidad_sugerida = ${f.severidad}
    )`);
  }
  if (f.destacados) {
    condiciones.push(sql`(${reportes.fueraDeTerritorio} OR EXISTS (
      SELECT 1 FROM ${analisisIa} a WHERE a.reporte_id = ${reportes.id} AND a.requiere_revision
    ))`);
  }
  return condiciones.length ? and(...condiciones) : undefined;
}

/** Bandeja municipal con filtros, orden y paginación (RF-6.1). */
export async function listarBandeja(db: Db, f: FiltrosBandeja): Promise<{ items: ReporteResumen[]; total: number; paginas: number }> {
  const ua = ultimoAnalisis(db);
  const where = whereBandeja(f);

  const orden: SQL[] = (() => {
    switch (f.orden) {
      case 'respaldos':
        return [desc(reportes.totalRespaldoVecinos), desc(reportes.creadoEn)];
      case 'antiguedad':
        return [asc(reportes.creadoEn)];
      case 'severidad':
        return [desc(ORDEN_SEVERIDAD(ua.severidad)), desc(reportes.totalRespaldoVecinos), asc(reportes.creadoEn)];
      default:
        return [desc(reportes.creadoEn)];
    }
  })();

  const [[{ total }], items] = await Promise.all([
    db.select({ total: count() }).from(reportes).where(where),
    consultarResumenes(db, where, orden, POR_PAGINA, (f.pagina - 1) * POR_PAGINA),
  ]);

  return { items, total, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) };
}

/**
 * "Mis reportes" del encargado (RF-3.6): los que registró y los que respaldó
 * (por ejemplo al sumar respaldo a un reporte cercano), más recientes primero.
 */
export async function listarMisReportes(db: Db, encargadoId: string): Promise<Array<ReporteResumen & { propio: boolean }>> {
  const items = await consultarResumenes(
    db,
    sql`(${reportes.encargadoId} = ${encargadoId} OR EXISTS (
      SELECT 1 FROM ${respaldos} s WHERE s.reporte_id = ${reportes.id} AND s.encargado_id = ${encargadoId}
    ))`,
    [desc(reportes.creadoEn)],
    100,
  );
  const propios = new Set(
    (await db.select({ id: reportes.id }).from(reportes).where(eq(reportes.encargadoId, encargadoId))).map((r) => r.id),
  );
  return items.map((i) => ({ ...i, propio: propios.has(i.id) }));
}

export interface ReporteDetalle {
  id: string;
  folio: string;
  estado: EstadoReporte;
  descripcion: string;
  ubicacion: { lat: number; lng: number };
  origenUbicacion: 'gps' | 'mapa' | 'centroide';
  precisionM: number | null;
  direccionReferencia: string | null;
  fueraDeTerritorio: boolean;
  totalRespaldoVecinos: number;
  organismoDerivado: string | null;
  motivoRechazo: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  cerradoEn: Date | null;
  categoria: { id: number; nombre: string; slug: string; color: string; usaIa: boolean; unidadResponsable: 'DOM' | 'DIDECO' };
  territorio: { id: number; nombre: string };
  encargado: { id: string; nombre: string };
  imagenes: Array<{ id: string; tipo: 'original' | 'cierre'; ancho: number | null; alto: number | null }>;
  analisis: {
    id: string;
    estado: 'pendiente' | 'listo' | 'error';
    severidad: Severidad | null;
    ratioCobertura: number | null;
    requiereRevision: boolean;
    boundingBoxes: Array<{ x1: number; y1: number; x2: number; y2: number; confidence: number; label: string }>;
    engine: string | null;
    imagenId: string;
    error: string | null;
    creadoEn: Date;
  } | null;
  respaldos: Array<{ id: string; nVecinos: number; canal: 'junta' | 'whatsapp' | 'presencial' | 'otro'; nota: string | null; creadoEn: Date; encargado: string }>;
  eventos: Array<{
    id: string;
    tipo: 'creado' | 'respaldo' | 'estado' | 'derivado' | 'comentario' | 'cierre' | 'analisis';
    estadoAnterior: EstadoReporte | null;
    estadoNuevo: EstadoReporte | null;
    organismoDerivado: string | null;
    comentario: string | null;
    creadoEn: Date;
    usuario: string | null;
  }>;
}

export async function obtenerDetalle(db: Db, id: string): Promise<ReporteDetalle | null> {
  const [r] = await db
    .select({
      reporte: reportes,
      categoria: categorias,
      territorio: { id: territorios.id, nombre: territorios.nombre },
      encargado: { id: usuarios.id, nombre: usuarios.nombre },
    })
    .from(reportes)
    .innerJoin(categorias, eq(categorias.id, reportes.categoriaId))
    .innerJoin(territorios, eq(territorios.id, reportes.territorioId))
    .innerJoin(usuarios, eq(usuarios.id, reportes.encargadoId))
    .where(eq(reportes.id, id))
    .limit(1);
  if (!r) return null;

  const [listaImagenes, listaAnalisis, listaRespaldos, listaEventos] = await Promise.all([
    db
      .select({ id: imagenes.id, tipo: imagenes.tipo, ancho: imagenes.ancho, alto: imagenes.alto })
      .from(imagenes)
      .where(eq(imagenes.reporteId, id))
      .orderBy(asc(imagenes.creadoEn)),
    db.select().from(analisisIa).where(eq(analisisIa.reporteId, id)).orderBy(desc(analisisIa.creadoEn)).limit(1),
    db
      .select({
        id: respaldos.id,
        nVecinos: respaldos.nVecinos,
        canal: respaldos.canal,
        nota: respaldos.nota,
        creadoEn: respaldos.creadoEn,
        encargado: usuarios.nombre,
      })
      .from(respaldos)
      .innerJoin(usuarios, eq(usuarios.id, respaldos.encargadoId))
      .where(eq(respaldos.reporteId, id))
      .orderBy(asc(respaldos.creadoEn)),
    db
      .select({
        id: eventosHistorial.id,
        tipo: eventosHistorial.tipo,
        estadoAnterior: eventosHistorial.estadoAnterior,
        estadoNuevo: eventosHistorial.estadoNuevo,
        organismoDerivado: eventosHistorial.organismoDerivado,
        comentario: eventosHistorial.comentario,
        creadoEn: eventosHistorial.creadoEn,
        usuario: usuarios.nombre,
      })
      .from(eventosHistorial)
      .leftJoin(usuarios, eq(usuarios.id, eventosHistorial.usuarioId))
      .where(eq(eventosHistorial.reporteId, id))
      .orderBy(asc(eventosHistorial.creadoEn)),
  ]);

  const a = listaAnalisis[0];
  const rep = r.reporte;
  return {
    id: rep.id,
    folio: rep.folio,
    estado: rep.estado,
    descripcion: rep.descripcion,
    ubicacion: rep.ubicacion,
    origenUbicacion: rep.origenUbicacion,
    precisionM: rep.precisionM,
    direccionReferencia: rep.direccionReferencia,
    fueraDeTerritorio: rep.fueraDeTerritorio,
    totalRespaldoVecinos: rep.totalRespaldoVecinos,
    organismoDerivado: rep.organismoDerivado,
    motivoRechazo: rep.motivoRechazo,
    creadoEn: rep.creadoEn,
    actualizadoEn: rep.actualizadoEn,
    cerradoEn: rep.cerradoEn,
    categoria: {
      id: r.categoria.id,
      nombre: r.categoria.nombre,
      slug: r.categoria.slug,
      color: r.categoria.color,
      usaIa: r.categoria.usaIa,
      unidadResponsable: r.categoria.unidadResponsable,
    },
    territorio: r.territorio,
    encargado: r.encargado,
    imagenes: listaImagenes,
    analisis: a
      ? {
          id: a.id,
          estado: a.estado,
          severidad: a.severidadSugerida,
          ratioCobertura: a.ratioCobertura,
          requiereRevision: a.requiereRevision,
          boundingBoxes: a.boundingBoxes ?? [],
          engine: a.engine,
          imagenId: a.imagenId,
          error: a.error,
          creadoEn: a.creadoEn,
        }
      : null,
    respaldos: listaRespaldos,
    eventos: listaEventos,
  };
}

/** Datos para autorizar la descarga de una imagen. */
export async function duenoImagen(db: Db, imagenId: string) {
  const [fila] = await db
    .select({
      ruta: imagenes.ruta,
      mime: imagenes.mime,
      reporteId: reportes.id,
      encargadoId: reportes.encargadoId,
      estado: reportes.estado,
      tipo: imagenes.tipo,
    })
    .from(imagenes)
    .innerJoin(reportes, eq(reportes.id, imagenes.reporteId))
    .where(eq(imagenes.id, imagenId))
    .limit(1);
  return fila ?? null;
}


export interface PuntoMapa {
  id: string;
  folio: string;
  lat: number;
  lng: number;
  estado: EstadoReporte;
  totalRespaldoVecinos: number;
  categoria: { nombre: string; slug: string; color: string };
  territorio: string;
  severidad: Severidad | null;
  fueraDeTerritorio: boolean;
}

/** Puntos para el mapa del panel (RF-6.2), con los filtros de la bandeja. */
export async function listarParaMapa(db: Db, f: FiltrosBandeja, limite = 2000): Promise<PuntoMapa[]> {
  const ua = ultimoAnalisis(db);
  const filas = await db
    .with(ua)
    .select({
      id: reportes.id,
      folio: reportes.folio,
      lat: sql<number>`ST_Y(${reportes.ubicacion}::geometry)`,
      lng: sql<number>`ST_X(${reportes.ubicacion}::geometry)`,
      estado: reportes.estado,
      totalRespaldoVecinos: reportes.totalRespaldoVecinos,
      fueraDeTerritorio: reportes.fueraDeTerritorio,
      categoriaNombre: categorias.nombre,
      categoriaSlug: categorias.slug,
      categoriaColor: categorias.color,
      territorio: territorios.nombre,
      severidad: ua.severidad,
    })
    .from(reportes)
    .innerJoin(categorias, eq(categorias.id, reportes.categoriaId))
    .innerJoin(territorios, eq(territorios.id, reportes.territorioId))
    .leftJoin(ua, eq(ua.reporteId, reportes.id))
    .where(whereBandeja(f))
    .orderBy(desc(reportes.creadoEn))
    .limit(limite);
  return filas.map((r) => ({
    id: r.id,
    folio: r.folio,
    lat: Number(r.lat),
    lng: Number(r.lng),
    estado: r.estado,
    totalRespaldoVecinos: r.totalRespaldoVecinos,
    fueraDeTerritorio: r.fueraDeTerritorio,
    categoria: { nombre: r.categoriaNombre, slug: r.categoriaSlug, color: r.categoriaColor },
    territorio: r.territorio,
    severidad: r.severidad,
  }));
}

/**
 * Alertas del panel (RF-7.2): reportes abiertos que superan el umbral de
 * respaldo vecinal o cuya severidad sugerida es crítica.
 */
export async function listarAlertas(db: Db, umbralRespaldos: number, limite = 10): Promise<ReporteResumen[]> {
  return consultarResumenes(
    db,
    and(
      inArray(reportes.estado, [...ESTADOS_ABIERTOS]),
      sql`(${reportes.totalRespaldoVecinos} >= ${umbralRespaldos} OR EXISTS (
        SELECT 1 FROM (
          SELECT DISTINCT ON (a.reporte_id) a.severidad_sugerida
          FROM ${analisisIa} a WHERE a.reporte_id = ${reportes.id}
          ORDER BY a.reporte_id, a.creado_en DESC
        ) u WHERE u.severidad_sugerida = 'critica'
      ))`,
    ),
    [desc(reportes.totalRespaldoVecinos), asc(reportes.creadoEn)],
    limite,
  );
}
