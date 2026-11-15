import { NextResponse } from 'next/server';
import { z } from 'zod';
import { conErrores, errorResponse, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { urlVision } from '@/server/vision';

function cabeceras(): HeadersInit {
  const key = process.env.VISION_API_KEY;
  return key ? { 'X-API-Key': key } : {};
}

async function consultar(ruta: string, init?: RequestInit) {
  try {
    const res = await fetch(urlVision() + ruta, { ...init, headers: cabeceras(), signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
  } catch {
    return { ok: false, status: 503, data: null };
  }
}

/** GET /api/admin/vision — motor activo del servicio de visión (RF-5.4, solo admin). */
export const GET = conErrores(async () => {
  await requerirUsuarioApi('analisis:cambiar_motor');
  const r = await consultar('/api/engine');
  if (!r.ok) return errorResponse(503, 'VISION_NO_DISPONIBLE', 'El servicio de visión no responde.');
  return NextResponse.json(r.data);
});

const MotorSchema = z.object({ engine: z.enum(['local', 'pretrained', 'ensemble']) });

/** POST /api/admin/vision — cambia el motor: { engine: "local" | "pretrained" | "ensemble" }. */
export const POST = conErrores(async (req: Request) => {
  await requerirUsuarioApi('analisis:cambiar_motor');
  const { engine } = MotorSchema.parse(await leerJson(req));
  const r = await consultar(`/api/switch_engine?engine=${engine}`, { method: 'POST' });
  if (!r.ok) return errorResponse(503, 'VISION_NO_DISPONIBLE', 'No se pudo cambiar el motor: el servicio de visión no responde.');
  return NextResponse.json(r.data);
});
