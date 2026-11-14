/** Integración del copiloto con un LLM simulado (compatible con OpenAI) y PostGIS real. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { NuevoReporteSchema } from '@/domain/reporte-input';
import { crearBaseDePrueba, integracionHabilitada, sembrarBasico, type BaseDePrueba } from '@/test/db';
import { crearReporte } from '@/server/reportes/crear';
import { cambiarEstado } from '@/server/reportes/gestion';
import { MARCA_PLAZO } from './prompt';
import { responderCopiloto } from './servicio';

type Llamada = { url: string; body: { messages: Array<{ role: string; content: string }> } | null };

/** LLM falso: responde /models y /chat/completions con el texto indicado. */
function llmFalso(respuesta: string, opciones: { colgar?: boolean } = {}) {
  const llamadas: Llamada[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'llama-3-8b-instruct' }] }));
    if (opciones.colgar) {
      return new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('abort'))));
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: respuesta } }] }));
  }) as unknown as typeof fetch;
  return { f, llamadas };
}

describe.skipIf(!integracionHabilitada)('copiloto contra PostGIS', () => {
  let base: BaseDePrueba;
  let db: Db;
  let reporteId: string;
  const usuario = { unidad: 'DOM' as const };

  beforeAll(async () => {
    base = await crearBaseDePrueba('copiloto');
    db = base.db;
    const s = await sembrarBasico(db);
    const r = await crearReporte(
      db,
      s.marta,
      NuevoReporteSchema.parse({
        categoriaId: s.luminaria, descripcion: 'Luminaria apagada; avisar a vecino@correo.cl', lat: -33.4815, lng: -70.579,
        origen: 'mapa', nVecinos: 6, canal: 'whatsapp',
      }),
      null,
    );
    reporteId = r.id;
    await cambiarEstado(db, s.carolina, r.id, { estado: 'en_revision', comentario: 'Revisado por Carolina' });
  });
  afterAll(async () => base?.cerrar());

  it('inyecta el contexto del reporte sin datos personales y devuelve la respuesta (§8.3)', async () => {
    const { f, llamadas } = llmFalso('Borrador para revisión del funcionario: el reporte está en revisión.');
    const r = await responderCopiloto(db, usuario, { messages: [{ role: 'user', content: 'Resume este caso' }], reporteId }, f);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, provider: 'lm-studio', model: 'llama-3-8b-instruct', usoContexto: true });

    const enviado = llamadas.find((l) => l.url.endsWith('/chat/completions'))!.body!.messages;
    const contexto = enviado.find((m) => m.content.startsWith('[CONTEXTO DEL REPORTE]'))!.content;
    expect(contexto).toContain('Folio: PR-');
    expect(contexto).toContain('Respaldo vecinal: 6 vecinos');
    expect(contexto).toContain('En revisión');
    expect(contexto).not.toMatch(/Marta|Carolina@|vecino@correo\.cl/); // sin nombre del encargado ni correos
    expect(enviado[0].content).toContain('[REFERENCIAS]');
  });

  it('agrega [MÉTRICAS] con datos reales cuando la pregunta lo requiere', async () => {
    const { f, llamadas } = llmFalso('Hay 1 reporte abierto en La Faena.');
    const r = await responderCopiloto(db, usuario, { messages: [{ role: 'user', content: '¿Cuántos reportes abiertos hay por territorio?' }] }, f);
    expect(r.body).toMatchObject({ success: true, usoMetricas: true });
    const metricas = llamadas.at(-1)!.body!.messages.find((m) => m.content.startsWith('[MÉTRICAS]'))!.content;
    expect(metricas).toContain('La Faena 1/1');
    expect(metricas).toContain('Totales: 1 reportes');
  });

  it('nunca entrega plazos aunque el modelo los escriba', async () => {
    const { f } = llmFalso('Estimada encargada: la cuadrilla irá en 24 a 48 horas.');
    const r = await responderCopiloto(db, usuario, { messages: [{ role: 'user', content: '¿Cuándo lo reparan?' }], reporteId }, f);
    expect(r.body).toMatchObject({ success: true, plazosOcultados: 1 });
    if (r.body.success) expect(r.body.reply).toContain(MARCA_PLAZO);
  });

  it('valida la entrada (400) y avisa si el LLM está apagado o se agota el tiempo', async () => {
    const { f } = llmFalso('x');
    expect((await responderCopiloto(db, usuario, { messages: [{ role: 'user', content: '   ' }] }, f)).status).toBe(400);
    expect((await responderCopiloto(db, usuario, { messages: [{ role: 'user', content: 'a'.repeat(2001) }] }, f)).status).toBe(400);

    const apagado = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect((await responderCopiloto(db, usuario, { messages: [{ role: 'user', content: 'Hola' }] }, apagado)).body).toMatchObject({
      success: false,
      offline: true,
    });

    process.env.LLM_INFERENCE_TIMEOUT_MS = '100';
    const lento = llmFalso('x', { colgar: true });
    const r = await responderCopiloto(db, usuario, { messages: [{ role: 'user', content: 'Hola' }] }, lento.f);
    delete process.env.LLM_INFERENCE_TIMEOUT_MS;
    expect(r.status).toBe(504);
  });
});
