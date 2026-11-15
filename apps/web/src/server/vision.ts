/**
 * Integración con el servicio de visión (RF-5.1, 5.2; contrato §8.2).
 *
 * - El reporte ya está guardado cuando se llama a la visión: si el servicio
 *   falla o tarda más que `vision_timeout_ms` (10 s por defecto), el análisis
 *   queda en "error" y se puede reintentar. El registro nunca depende de la IA.
 * - La severidad se RECALCULA aquí con los umbrales de `configuracion`
 *   (no se usa la que devuelve el servicio), para que el admin pueda ajustarlos.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/db';
import { analisisIa, configuracion, eventosHistorial, imagenes, type Severidad } from '@/db/schema';
import { calcularSeveridad, requiereRevision } from '@/domain/severidad';
import { leerArchivo } from '@/server/almacenamiento';

const CajaSchema = z.object({
  x1: z.number().min(0).max(1),
  y1: z.number().min(0).max(1),
  x2: z.number().min(0).max(1),
  y2: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  label: z.string().default('bache'),
});

/** Respuesta de POST /api/analyze (§8.2). requiereRevision y engineUsed son opcionales por compatibilidad. */
export const RespuestaVisionSchema = z.object({
  boundingBoxes: z.array(CajaSchema),
  severidad: z.string().optional(),
  ratioCobertura: z.number().min(0).max(100),
  requiereRevision: z.boolean().optional(),
  engineUsed: z.string().optional(),
  timestamp: z.string().optional(),
});
export type RespuestaVision = z.infer<typeof RespuestaVisionSchema>;

export type CodigoErrorVision = 'TIMEOUT' | 'SIN_CONEXION' | 'HTTP' | 'RESPUESTA_INVALIDA' | 'SIN_IMAGEN';

export class VisionError extends Error {
  constructor(
    message: string,
    public readonly codigo: CodigoErrorVision,
  ) {
    super(message);
  }
}

export interface OpcionesVision {
  url?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function urlVision(): string {
  return (process.env.VISION_URL ?? 'http://localhost:8000').replace(/\/$/, '');
}

export async function llamarVision(imagen: Buffer, opciones: OpcionesVision = {}): Promise<RespuestaVision> {
  const url = (opciones.url ?? urlVision()) + '/api/analyze';
  const timeoutMs = opciones.timeoutMs ?? 10_000;
  const apiKey = opciones.apiKey ?? process.env.VISION_API_KEY ?? '';
  const f = opciones.fetchImpl ?? fetch;

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(imagen)], { type: 'image/jpeg' }), 'reporte.jpg');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await f(url, {
      method: 'POST',
      body: form,
      headers: apiKey ? { 'X-API-Key': apiKey } : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new VisionError(`El servicio de visión no respondió en ${timeoutMs / 1000} s.`, 'TIMEOUT');
    throw new VisionError(`No se pudo conectar con el servicio de visión (${(err as Error).message}).`, 'SIN_CONEXION');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new VisionError(`El servicio de visión respondió HTTP ${res.status}${detalle ? `: ${detalle.slice(0, 200)}` : ''}`, 'HTTP');
  }
  const json = await res.json().catch(() => null);
  const parsed = RespuestaVisionSchema.safeParse(json);
  if (!parsed.success) throw new VisionError('La respuesta del servicio de visión no cumple el contrato §8.2.', 'RESPUESTA_INVALIDA');
  return parsed.data;
}

export interface ResultadoAnalisis {
  estado: 'listo' | 'error';
  severidad: Severidad | null;
  error: string | null;
}

/**
 * Ejecuta un análisis pendiente de punta a punta y guarda el resultado.
 * Nunca lanza: los errores quedan registrados en el análisis (estado "error").
 */
export async function procesarAnalisis(db: Db, analisisId: string, opciones: OpcionesVision = {}): Promise<ResultadoAnalisis> {
  const inicio = Date.now();
  const [fila] = await db
    .select({ id: analisisIa.id, reporteId: analisisIa.reporteId, ruta: imagenes.ruta })
    .from(analisisIa)
    .innerJoin(imagenes, eq(imagenes.id, analisisIa.imagenId))
    .where(eq(analisisIa.id, analisisId))
    .limit(1);
  if (!fila) return { estado: 'error', severidad: null, error: 'Análisis no encontrado' };

  const [config] = await db.select().from(configuracion).where(eq(configuracion.id, 1)).limit(1);
  const umbrales = { umbralMedia: config?.umbralMedia ?? 8, umbralCritica: config?.umbralCritica ?? 20 };
  const timeoutMs = opciones.timeoutMs ?? config?.visionTimeoutMs ?? 10_000;

  try {
    let imagen: Buffer;
    try {
      imagen = await leerArchivo(fila.ruta);
    } catch {
      throw new VisionError('No se encontró el archivo de la foto.', 'SIN_IMAGEN');
    }
    const r = await llamarVision(imagen, { ...opciones, timeoutMs });

    const severidad = calcularSeveridad(r.ratioCobertura, r.boundingBoxes.length, umbrales);
    const revision = requiereRevision(severidad, r.boundingBoxes.map((b) => b.confidence), r.requiereRevision ?? false);
    const duracionMs = Date.now() - inicio;

    await db.transaction(async (tx) => {
      await tx
        .update(analisisIa)
        .set({
          estado: 'listo',
          engine: r.engineUsed ?? null,
          modeloVersion: r.engineUsed ? `vision:${r.engineUsed}` : null,
          boundingBoxes: r.boundingBoxes,
          ratioCobertura: r.ratioCobertura,
          severidadSugerida: severidad,
          requiereRevision: revision,
          error: null,
          duracionMs,
        })
        .where(eq(analisisIa.id, analisisId));
      await tx.insert(eventosHistorial).values({
        reporteId: fila.reporteId,
        usuarioId: null,
        tipo: 'analisis',
        datos: {
          estado: 'listo',
          severidadSugerida: severidad,
          ratioCobertura: r.ratioCobertura,
          detecciones: r.boundingBoxes.length,
          requiereRevision: revision,
          engine: r.engineUsed ?? null,
          duracionMs,
        },
      });
    });
    return { estado: 'listo', severidad, error: null };
  } catch (err) {
    const mensaje = err instanceof VisionError ? err.message : 'Error inesperado al analizar la foto.';
    if (!(err instanceof VisionError)) console.error('[vision] Error no controlado:', err);
    await db.transaction(async (tx) => {
      await tx
        .update(analisisIa)
        .set({ estado: 'error', error: mensaje, duracionMs: Date.now() - inicio })
        .where(eq(analisisIa.id, analisisId));
      await tx.insert(eventosHistorial).values({
        reporteId: fila.reporteId,
        usuarioId: null,
        tipo: 'analisis',
        datos: { estado: 'error', error: mensaje, codigo: err instanceof VisionError ? err.codigo : 'INESPERADO' },
      });
    });
    return { estado: 'error', severidad: null, error: mensaje };
  }
}
