import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conErrores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { estadoCopiloto, responderCopiloto, SolicitudCopilotoSchema } from '@/server/copiloto/servicio';

/**
 * POST /api/copiloto — contrato §8.3 (funcionario/admin).
 * { messages, reporteId?, incluirMetricas?, ambitoMetricas? } → { success, reply, provider, model }
 * LLM apagado → { success:false, offline:true }; entrada inválida → 400; tiempo agotado → 504.
 */
export const POST = conErrores(async (req: Request) => {
  const usuario = await requerirUsuarioApi('copiloto:usar');
  const parsed = SolicitudCopilotoSchema.safeParse(await leerJson(req));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Entrada inválida.' }, { status: 400 });
  }
  const r = await responderCopiloto(db, usuario, parsed.data);
  return NextResponse.json(r.body, { status: r.status });
});

/** GET /api/copiloto — healthcheck del LLM local (RF-8.8). */
export const GET = conErrores(async () => {
  await requerirUsuarioApi('copiloto:usar');
  return NextResponse.json(await estadoCopiloto());
});
