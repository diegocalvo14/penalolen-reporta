/** Reintento/reanálisis de la foto de un reporte (RF-5.1 y RF-5.4). */
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/db';
import { analisisIa, categorias, imagenes, reportes } from '@/db/schema';
import { errores } from '@/server/api';

/**
 * Crea un análisis nuevo en "pendiente" sobre la foto original del reporte y
 * devuelve su id. Se crea uno nuevo (en vez de pisar el anterior) para
 * conservar el historial de intentos; las consultas usan siempre el más reciente.
 */
export async function nuevoIntentoAnalisis(db: Db, reporteId: string): Promise<string> {
  if (!z.string().uuid().safeParse(reporteId).success) throw errores.noEncontrado('El reporte');
  const [r] = await db
    .select({ usaIa: categorias.usaIa, nombre: categorias.nombre })
    .from(reportes)
    .innerJoin(categorias, eq(categorias.id, reportes.categoriaId))
    .where(eq(reportes.id, reporteId))
    .limit(1);
  if (!r) throw errores.noEncontrado('El reporte');
  if (!r.usaIa) throw errores.conflicto('SIN_IA', `La categoría "${r.nombre}" no usa análisis de IA.`);

  const [img] = await db
    .select({ id: imagenes.id })
    .from(imagenes)
    .where(and(eq(imagenes.reporteId, reporteId), eq(imagenes.tipo, 'original')))
    .orderBy(asc(imagenes.creadoEn))
    .limit(1);
  if (!img) throw errores.conflicto('SIN_FOTO', 'El reporte no tiene foto para analizar.');

  const [a] = await db
    .insert(analisisIa)
    .values({ reporteId, imagenId: img.id, estado: 'pendiente' })
    .returning({ id: analisisIa.id });
  return a.id;
}
