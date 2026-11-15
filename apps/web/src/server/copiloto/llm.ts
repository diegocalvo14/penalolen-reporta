/**
 * Cliente del LLM local (LM Studio :1234 u Ollama :11434, API compatible con OpenAI).
 * Basado en frontend/src/app/api/copiloto/route.ts de Soluciones Barriales.
 */
export type ProveedorId = 'lm-studio' | 'ollama';

export interface Proveedor {
  id: ProveedorId;
  baseUrl: string;
  modelo: string;
}

export interface MensajeChat {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly tipo: 'OFFLINE' | 'TIMEOUT' | 'HTTP',
  ) {
    super(message);
  }
}

const HEALTHCHECK_MS = 2000;

function proveedores(): Array<{ id: ProveedorId; baseUrl: string }> {
  return [
    { id: 'lm-studio', baseUrl: (process.env.LOCAL_LLM_URL ?? 'http://127.0.0.1:1234/v1').replace(/\/$/, '') },
    { id: 'ollama', baseUrl: (process.env.OLLAMA_LLM_URL ?? 'http://127.0.0.1:11434/v1').replace(/\/$/, '') },
  ];
}

export function timeoutInferenciaMs(): number {
  const v = Number(process.env.LLM_INFERENCE_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 60_000;
}

/** Primer proveedor que responde en /models. LLM_MODEL fija el modelo si se define. */
export async function detectarProveedor(f: typeof fetch = fetch): Promise<Proveedor | null> {
  for (const p of proveedores()) {
    try {
      const res = await f(`${p.baseUrl}/models`, { signal: AbortSignal.timeout(HEALTHCHECK_MS) });
      if (!res.ok) continue;
      const json = (await res.json().catch(() => ({}))) as { data?: Array<{ id: string }> };
      const preferido = process.env.LLM_MODEL?.trim();
      const disponibles = json.data?.map((m) => m.id) ?? [];
      const modelo =
        (preferido && disponibles.includes(preferido) ? preferido : undefined) ??
        disponibles.find((m) => /llama/i.test(m)) ??
        preferido ??
        disponibles[0] ??
        'default';
      return { id: p.id, baseUrl: p.baseUrl, modelo };
    } catch {
      // probar el siguiente
    }
  }
  return null;
}

export async function inferir(p: Proveedor, mensajes: MensajeChat[], f: typeof fetch = fetch, timeoutMs = timeoutInferenciaMs()): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await f(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: p.modelo, messages: mensajes, temperature: 0.3, max_tokens: 700, stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new LlmError(`El LLM local respondió HTTP ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ''}`, 'HTTP');
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string }; text?: string }> };
    return data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? '';
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (controller.signal.aborted) throw new LlmError(`El modelo superó el tiempo límite de ${Math.round(timeoutMs / 1000)} s.`, 'TIMEOUT');
    throw new LlmError('No se pudo comunicar con el LLM local.', 'OFFLINE');
  } finally {
    clearTimeout(timer);
  }
}
