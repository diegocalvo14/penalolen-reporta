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

/** LLM falso: responde /models y /chat/completions con el texto indicado (o una lista, en orden). */
function llmFalso(respuesta: string | string[], opciones: { colgar?: boolean } = {}) {
  const respuestas = Array.isArray(respuesta) ? [...respuesta] : [respuesta];
  const llamadas: Llamada[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'llama-3-8b-instruct' }] }));
    if (opciones.colgar) {
      return new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('abort'))));
    }
    const content = respuestas.length > 1 ? respuestas.shift()! : respuestas[0];
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
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
    expect(enviado.filter((m) => m.role === 'system')).toHaveLength(1); // un solo mensaje de sistema
    const contexto = enviado[0].content.slice(enviado[0].content.indexOf('[CONTEXTO DEL REPORTE]'));
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
    const sistema = llamadas.at(-1)!.body!.messages[0].content;
    const metricas = sistema.slice(sistema.indexOf('[MÉTRICAS]'));
    expect(metricas).toContain('La Faena 1/1');
    expect(metricas).toContain('Totales: 1 reportes');
  });

  it('si el modelo responde con una llamada a función (JSON), reintenta pidiendo texto', async () => {
    const json = '{"name": "responder_reporte", "parameters": {"folio": "PR-2026-00001"}}';
    const { f, llamadas } = llmFalso([json, 'Borrador para revisión del funcionario: el reporte está en revisión.']);
    const r = await responderCopiloto(db, usuario, { messages: [{ role: 'user', content: 'Redacta una respuesta' }], reporteId }, f);
    expect(r.body).toMatchObject({ success: true, reply: expect.stringContaining('Borrador para revisión') });
    const chats = llamadas.filter((l) => l.url.endsWith('/chat/completions'));
    expect(chats).toHaveLength(2);
    expect(chats[1].body!.messages.at(-1)!.content).toMatch(/sin JSON/);

    const insistente = llmFalso(json);
    const r2 = await responderCopiloto(db, usuario, { messages: [{ role: 'user', content: 'Redacta una respuesta' }], reporteId }, insistente.f);
    expect(r2.status).toBe(502);
    expect(r2.body).toMatchObject({ success: false, error: expect.stringContaining('formato no válido') });
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
