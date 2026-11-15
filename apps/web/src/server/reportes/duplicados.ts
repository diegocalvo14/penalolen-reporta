/**
 * Búsqueda de reportes cercanos para sugerir "Sumar respaldo" (RF-4.1 y 4.2).
 * Reportes ABIERTOS de la misma categoría dentro del radio de la categoría
 * (ST_DWithin sobre geography, en metros). Es una sugerencia: nunca fusiona sola.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/db';
import { categorias, reportes, territorios } from '@/db/schema';
import type { LatLng } from '@/db/geo';
import { aplicaBusquedaDuplicados } from '@/domain/duplicados';
import { ESTADOS_ABIERTOS } from '@/domain/estados';
import { errores } from '@/server/api';

export interface ReporteCercano {
  id: string;
  folio: string;
  estado: string;
  distanciaM: number;
  totalRespaldoVecinos: number;
  descripcion: string;
  creadoEn: Date;
  territorio: string;
  imagenId: string | null;
}

export async function buscarDuplicados(
  db: Db,
  q: { categoriaId: number; punto: LatLng; origen: 'gps' | 'mapa' | 'centroide'; precision?: number | null },
): Promise<{ aplica: boolean; radioM: number; cercanos: ReporteCercano[] }> {
  const [cat] = await db
    .select({ radio: categorias.radioDuplicadoM })
    .from(categorias)
    .where(eq(categorias.id, q.categoriaId))
    .limit(1);
  if (!cat) throw errores.invalido('La categoría elegida no existe.');

  if (!aplicaBusquedaDuplicados(q.origen, q.precision, cat.radio)) {
    return { aplica: false, radioM: cat.radio, cercanos: [] };
  }

  const punto = sql`ST_SetSRID(ST_MakePoint(${q.punto.lng}, ${q.punto.lat}), 4326)::geography`;
  const distancia = sql<number>`ST_Distance(${reportes.ubicacion}, ${punto})`;
  const filas = await db
    .select({
      id: reportes.id,
      folio: reportes.folio,
      estado: reportes.estado,
      distanciaM: distancia,
      totalRespaldoVecinos: reportes.totalRespaldoVecinos,
      descripcion: reportes.descripcion,
      creadoEn: reportes.creadoEn,
      territorio: territorios.nombre,
      imagenId: sql<string | null>`(SELECT i.id FROM imagenes i WHERE i.reporte_id = ${reportes.id} AND i.tipo = 'original' ORDER BY i.creado_en LIMIT 1)`,
    })
    .from(reportes)
    .innerJoin(territorios, eq(territorios.id, reportes.territorioId))
    .where(
      and(
        eq(reportes.categoriaId, q.categoriaId),
        inArray(reportes.estado, [...ESTADOS_ABIERTOS]),
        sql`ST_DWithin(${reportes.ubicacion}, ${punto}, ${cat.radio})`,
      ),
    )
    .orderBy(asc(distancia))
    .limit(5);

  return {
    aplica: true,
    radioM: cat.radio,
    cercanos: filas.map((f) => ({ ...f, distanciaM: Math.round(Number(f.distanciaM) * 10) / 10 })),
  };
}
