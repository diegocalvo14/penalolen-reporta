/**
 * Registro de un reporte por un encargado (RF-3.1, 3.3, 3.4, 3.5, 4.3 y 5.1).
 *
 * En una sola transacción: folio correlativo, reporte, primer respaldo vecinal
 * (§5: "el reporte inicial crea su primer respaldo"), foto, análisis IA en
 * "pendiente" si la categoría usa IA y el evento "creado" del historial.
 * La foto se escribe en disco antes; si la transacción falla, se borra.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '@/db';
import {
  analisisIa,
  categorias,
  eventosHistorial,
  folioContadores,
  imagenes,
  reportes,
  respaldos,
  territorios,
} from '@/db/schema';
import type { LatLng } from '@/db/geo';
import { anioFolio, formatFolio } from '@/domain/folio';
import type { NuevoReporte } from '@/domain/reporte-input';
import { resolverTerritorio, type TerritorioCandidato } from '@/domain/territorio';
import { ApiError, errores } from '@/server/api';
import { borrarArchivo, guardarFoto } from '@/server/almacenamiento';
import type { ImagenProcesada } from '@/server/imagenes';

export interface Creador {
  id: string;
  territorioId: number | null;
}

export interface ReporteCreado {
  id: string;
  folio: string;
  estado: 'ingresado';
  territorioId: number;
  fueraDeTerritorio: boolean;
  totalRespaldoVecinos: number;
  analisis: { id: string; estado: 'pendiente' } | null;
}

/** Folio correlativo por año, atómico (la fila del año queda bloqueada hasta el commit). */
async function siguienteFolio(tx: Parameters<Parameters<Db['transaction']>[0]>[0], ahora: Date): Promise<string> {
  const anio = anioFolio(ahora);
  const [fila] = await tx
    .insert(folioContadores)
    .values({ anio, ultimo: 1 })
    .onConflictDoUpdate({ target: folioContadores.anio, set: { ultimo: sql`${folioContadores.ultimo} + 1` } })
    .returning({ ultimo: folioContadores.ultimo });
  return formatFolio(anio, fila.ultimo);
}

async function candidatosTerritorio(db: Db, p: LatLng): Promise<TerritorioCandidato[]> {
  const punto = sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography`;
  const filas = await db
    .select({
      id: territorios.id,
      cubre: sql<boolean>`(${territorios.poligono} IS NOT NULL AND ST_Covers(${territorios.poligono}, ${punto}))`,
      distanciaM: sql<number | null>`CASE WHEN ${territorios.centroide} IS NULL THEN NULL ELSE ST_Distance(${territorios.centroide}, ${punto}) END`,
    })
    .from(territorios);
  return filas.map((f) => ({ id: f.id, cubre: Boolean(f.cubre), distanciaM: f.distanciaM === null ? null : Number(f.distanciaM) }));
}

export async function crearReporte(
  db: Db,
  creador: Creador,
  input: NuevoReporte,
  foto: ImagenProcesada | null,
  ahora: Date = new Date(),
): Promise<ReporteCreado> {
  if (!creador.territorioId) {
    throw new ApiError(409, 'SIN_TERRITORIO', 'Tu usuario no tiene un territorio asignado. Pide al administrador que lo asigne.');
  }

  const [categoria] = await db
    .select()
    .from(categorias)
    .where(and(eq(categorias.id, input.categoriaId), eq(categorias.activa, true)))
    .limit(1);
  if (!categoria) throw errores.invalido('La categoría elegida no existe.');
  if (categoria.usaIa && !foto) {
    throw errores.invalido(`La foto es obligatoria para "${categoria.nombre}": la usa la IA para sugerir la severidad.`);
  }

  // Ubicación: con origen "centroide" manda el centroide guardado en la BD, no lo que envíe el cliente
  let ubicacion: LatLng = { lat: input.lat, lng: input.lng };
  let precisionM = input.precision ?? null;
  if (input.origen === 'centroide') {
    const [propio] = await db
      .select({ centroide: territorios.centroide })
      .from(territorios)
      .where(eq(territorios.id, creador.territorioId));
    if (!propio?.centroide) throw new ApiError(409, 'SIN_CENTROIDE', 'Tu territorio no tiene ubicación de referencia. Marca el punto en el mapa.');
    ubicacion = propio.centroide;
    precisionM = null;
  }

  const { territorioId, fueraDeTerritorio } = resolverTerritorio(
    await candidatosTerritorio(db, ubicacion),
    creador.territorioId,
    input.origen,
  );

  const rutaFoto = foto ? await guardarFoto(foto.buffer, 'jpg', ahora) : null;

  try {
    return await db.transaction(async (tx) => {
      const folio = await siguienteFolio(tx, ahora);

      const [reporte] = await tx
        .insert(reportes)
        .values({
          folio,
          categoriaId: categoria.id,
          descripcion: input.descripcion,
          ubicacion,
          origenUbicacion: input.origen,
          precisionM,
          direccionReferencia: input.direccionReferencia ?? null,
          territorioId,
          encargadoId: creador.id,
          estado: 'ingresado',
          totalRespaldoVecinos: input.nVecinos,
          fueraDeTerritorio,
          creadoEn: ahora,
        })
        .returning({ id: reportes.id });

      await tx.insert(respaldos).values({
        reporteId: reporte.id,
        encargadoId: creador.id,
        nVecinos: input.nVecinos,
        canal: input.canal,
        creadoEn: ahora,
      });

      let analisis: ReporteCreado['analisis'] = null;
      if (foto && rutaFoto) {
        const [imagen] = await tx
          .insert(imagenes)
          .values({
            reporteId: reporte.id,
            ruta: rutaFoto,
            tipo: 'original',
            mime: foto.mime,
            tamanoBytes: foto.buffer.length,
            ancho: foto.ancho,
            alto: foto.alto,
          })
          .returning({ id: imagenes.id });

        if (categoria.usaIa) {
          const [a] = await tx
            .insert(analisisIa)
            .values({ reporteId: reporte.id, imagenId: imagen.id, estado: 'pendiente' })
            .returning({ id: analisisIa.id });
          analisis = { id: a.id, estado: 'pendiente' };
        }
      }

      await tx.insert(eventosHistorial).values({
        reporteId: reporte.id,
        usuarioId: creador.id,
        tipo: 'creado',
        estadoNuevo: 'ingresado',
        datos: {
          nVecinos: input.nVecinos,
          canal: input.canal,
          origenUbicacion: input.origen,
          fueraDeTerritorio,
          conFoto: Boolean(foto),
        },
        creadoEn: ahora,
      });

      return {
        id: reporte.id,
        folio,
        estado: 'ingresado' as const,
        territorioId,
        fueraDeTerritorio,
        totalRespaldoVecinos: input.nVecinos,
        analisis,
      };
    });
  } catch (err) {
    if (rutaFoto) await borrarArchivo(rutaFoto).catch(() => undefined);
    throw err;
  }
}
