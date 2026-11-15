import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conErrores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { nuevoIntentoAnalisis } from '@/server/reportes/analisis';
import { procesarAnalisis } from '@/server/vision';

/**
 * POST /api/reportes/{id}/analisis/reintentar — funcionario/admin (RF-5.1, 5.4).
 * Analiza de nuevo la foto y responde con el resultado (espera como máximo el
 * tiempo límite de visión configurado).
 */
export const POST = conErrores(async (_req: Request, ctx: RouteContext<'/api/reportes/[id]/analisis/reintentar'>) => {
  await requerirUsuarioApi('analisis:reintentar');
  const { id } = await ctx.params;
  const analisisId = await nuevoIntentoAnalisis(db, id);
  const resultado = await procesarAnalisis(db, analisisId);
  return NextResponse.json({ analisisId, ...resultado });
});
