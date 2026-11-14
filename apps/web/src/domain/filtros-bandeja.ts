/**
 * Filtros, orden y paginación de la bandeja municipal (RF-6.1). Se leen desde
 * la URL (?estado=...&orden=...) tanto en la página como en GET /api/reportes.
 */
import { z } from 'zod';

export const ORDENES = ['recientes', 'respaldos', 'antiguedad', 'severidad'] as const;
export type Orden = (typeof ORDENES)[number];

export const ORDEN_LABEL: Record<Orden, string> = {
  recientes: 'Más recientes',
  respaldos: 'Más respaldo vecinal',
  antiguedad: 'Más antiguos',
  severidad: 'Mayor severidad',
};

export const SEVERIDADES_FILTRO = ['critica', 'media', 'baja', 'sin_deteccion', 'sin_analisis'] as const;

export const POR_PAGINA = 25;

const vacioAUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const FiltrosBandejaSchema = z.object({
  estado: z.preprocess(
    vacioAUndefined,
    z
      .enum(['abiertos', 'ingresado', 'en_revision', 'en_gestion', 'derivado', 'resuelto', 'duplicado', 'rechazado'])
      .optional(),
  ),
  categoria: z.preprocess(vacioAUndefined, z.coerce.number().int().positive().optional()),
  territorio: z.preprocess(vacioAUndefined, z.coerce.number().int().positive().optional()),
  severidad: z.preprocess(vacioAUndefined, z.enum(SEVERIDADES_FILTRO).optional()),
  destacados: z.preprocess((v) => v === '1' || v === 'true' || v === true, z.boolean()),
  orden: z.preprocess(vacioAUndefined, z.enum(ORDENES).default('recientes')),
  pagina: z.preprocess(vacioAUndefined, z.coerce.number().int().min(1).default(1)),
});

export type FiltrosBandeja = z.infer<typeof FiltrosBandejaSchema>;

/** Lee los filtros desde searchParams; los valores inválidos se ignoran en vez de fallar. */
export function leerFiltros(params: Record<string, string | string[] | undefined> | URLSearchParams): FiltrosBandeja {
  const obj: Record<string, string | undefined> = {};
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => (obj[k] = v));
  } else {
    for (const [k, v] of Object.entries(params)) obj[k] = Array.isArray(v) ? v[0] : v;
  }
  const r = FiltrosBandejaSchema.safeParse(obj);
  if (r.success) return r.data;
  // Si un campo viene malo, se descarta solo ese campo
  const limpio: Record<string, string | undefined> = { ...obj };
  for (const issue of r.error.issues) delete limpio[String(issue.path[0])];
  return FiltrosBandejaSchema.parse(limpio);
}
