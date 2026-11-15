import { describe, expect, it } from 'vitest';
import { llamarVision, VisionError } from './vision';

const IMG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const okJson = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

describe('llamarVision (contrato §8.2)', () => {
  it('envía multipart "file" con la API key y valida la respuesta', async () => {
    let recibido: { url: string; key: string | null; tieneArchivo: boolean } | null = null;
    const fetchFalso = (async (url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      recibido = { url, key: new Headers(init?.headers).get('X-API-Key'), tieneArchivo: form.get('file') instanceof Blob };
      return new Response(JSON.stringify({ boundingBoxes: [{ x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.6, confidence: 0.7, label: 'bache' }], ratioCobertura: 16, severidad: 'media' }));
    }) as unknown as typeof fetch;
    const r = await llamarVision(IMG, { url: 'http://vision:8000', apiKey: 'k', fetchImpl: fetchFalso });
    expect(recibido).toEqual({ url: 'http://vision:8000/api/analyze', key: 'k', tieneArchivo: true });
    expect(r.boundingBoxes).toHaveLength(1);
    expect(r.requiereRevision).toBeUndefined(); // campo opcional: compatible con el servicio original
  });

  it('timeout → VisionError TIMEOUT', async () => {
    const lento = ((_u: string, init?: RequestInit) =>
      new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError'))))) as unknown as typeof fetch;
    await expect(llamarVision(IMG, { timeoutMs: 50, fetchImpl: lento })).rejects.toMatchObject({ codigo: 'TIMEOUT' });
  });

  it('servicio apagado → SIN_CONEXION; HTTP 500 → HTTP; JSON fuera de contrato → RESPUESTA_INVALIDA', async () => {
    const caido = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(llamarVision(IMG, { fetchImpl: caido })).rejects.toMatchObject({ codigo: 'SIN_CONEXION' });
    await expect(llamarVision(IMG, { fetchImpl: okJson({ detail: 'x' }, 500) as unknown as typeof fetch })).rejects.toMatchObject({ codigo: 'HTTP' });
    await expect(
      llamarVision(IMG, { fetchImpl: okJson({ boundingBoxes: [{ x1: 2 }], ratioCobertura: 5 }) as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(VisionError);
  });
});
