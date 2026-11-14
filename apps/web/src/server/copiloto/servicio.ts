/**
 * Orquestación del copiloto (M8, contrato §8.3): valida la entrada, arma el
 * prompt (system + [CONTEXTO DEL REPORTE] + [MÉTRICAS]), llama al LLM local y
 * aplica la regla de no plazos sobre la respuesta.
 */
import { z } from 'zod';
import type { Db } from '@/db';
import type { Unidad } from '@/db/schema';
import { calcularMetricas, inicioDeMes } from '@/server/metricas';
import { obtenerDetalle } from '@/server/reportes/consultas';
import { detectarProveedor, inferir, LlmError, type MensajeChat } from './llm';
import { bloqueMetricas, contextoReporte, necesitaMetricas, sanearPlazos, systemPrompt } from './prompt';

export const MAX_PREGUNTA = 2000;

export const SolicitudCopilotoSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }))
    .min(1, { message: 'Se requiere al menos un mensaje.' })
    .max(30),
  reporteId: z.string().uuid().optional().nullable(),
  incluirMetricas: z.boolean().optional(),
  /** "unidad": métricas filtradas a la unidad del funcionario (acción rápida "Métricas de mi unidad") */
  ambitoMetricas: z.enum(['todo', 'unidad']).optional(),
});
export type SolicitudCopiloto = z.infer<typeof SolicitudCopilotoSchema>;

export type RespuestaCopiloto =
  | { status: 200; body: { success: true; reply: string; provider: string; model: string; usoMetricas: boolean; usoContexto: boolean; plazosOcultados: number } }
  | { status: 200; body: { success: false; offline: true; error: string } }
  | { status: 400 | 404 | 502 | 504; body: { success: false; error: string } };

export async function responderCopiloto(
  db: Db,
  usuario: { unidad: Unidad | null },
  solicitud: SolicitudCopiloto,
  f: typeof fetch = fetch,
): Promise<RespuestaCopiloto> {
  const ultima = solicitud.messages[solicitud.messages.length - 1];
  if (ultima.role !== 'user' || ultima.content.trim().length === 0) {
    return { status: 400, body: { success: false, error: 'La pregunta está vacía.' } };
  }
  if (ultima.content.length > MAX_PREGUNTA) {
    return { status: 400, body: { success: false, error: `La pregunta supera los ${MAX_PREGUNTA} caracteres.` } };
  }

  const proveedor = await detectarProveedor(f);
  if (!proveedor) {
    return {
      status: 200,
      body: {
        success: false,
        offline: true,
        error: 'No hay un LLM local activo. Abre LM Studio (puerto 1234) u Ollama (puerto 11434) con Llama 3 cargado.',
      },
    };
  }

  const sistema: MensajeChat[] = [{ role: 'system', content: systemPrompt() }];

  let usoContexto = false;
  if (solicitud.reporteId) {
    const detalle = await obtenerDetalle(db, solicitud.reporteId);
    if (!detalle) return { status: 404, body: { success: false, error: 'El reporte no existe.' } };
    sistema.push({ role: 'system', content: contextoReporte(detalle) });
    usoContexto = true;
  }

  const usoMetricas = Boolean(solicitud.incluirMetricas) || necesitaMetricas(ultima.content);
  if (usoMetricas) {
    const porUnidad = solicitud.ambitoMetricas === 'unidad' && usuario.unidad;
    const filtros = porUnidad ? { unidad: usuario.unidad! } : {};
    const [general, mes] = await Promise.all([
      calcularMetricas(db, filtros),
      calcularMetricas(db, { ...filtros, desde: inicioDeMes() }),
    ]);
    const ambito = porUnidad ? `categorías de la unidad ${usuario.unidad}` : 'toda la comuna, todas las categorías';
    sistema.push({ role: 'system', content: bloqueMetricas(general, mes, ambito) });
  }

  // Historial reciente de la conversación (los mensajes largos del asistente se recortan)
  const historial: MensajeChat[] = solicitud.messages.slice(-12).map((m) => ({
    role: m.role,
    content: m.content.length > 3000 ? `${m.content.slice(0, 3000)}…` : m.content,
  }));

  try {
    const bruto = await inferir(proveedor, [...sistema, ...historial], f);
    const { texto, reemplazos } = sanearPlazos(bruto.trim() || 'El modelo no devolvió contenido. Intenta reformular la pregunta.');
    return {
      status: 200,
      body: { success: true, reply: texto, provider: proveedor.id, model: proveedor.modelo, usoMetricas, usoContexto, plazosOcultados: reemplazos },
    };
  } catch (err) {
    if (err instanceof LlmError) {
      if (err.tipo === 'TIMEOUT') return { status: 504, body: { success: false, error: `${err.message} Prueba con un modelo más liviano (por ejemplo Llama 3.2 3B) o aumenta LLM_INFERENCE_TIMEOUT_MS.` } };
      if (err.tipo === 'OFFLINE') return { status: 200, body: { success: false, offline: true, error: err.message } };
      return { status: 502, body: { success: false, error: err.message } };
    }
    throw err;
  }
}

/** Healthcheck (RF-8.8). */
export async function estadoCopiloto(f: typeof fetch = fetch) {
  const p = await detectarProveedor(f);
  return p
    ? { active: true, provider: p.id, model: p.modelo, message: `IA local activa en ${p.id === 'lm-studio' ? 'LM Studio' : 'Ollama'} (${p.modelo})` }
    : { active: false, provider: null, model: null, message: 'No se detectó un LLM local en los puertos 1234 (LM Studio) ni 11434 (Ollama).' };
}
