import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conErrores, errores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { detalleVisible } from '@/server/reportes/acceso';

/** GET /api/reportes/{id} — detalle completo según rol (encargado: solo los suyos). */
export const GET = conErrores(async (_req: Request, ctx: RouteContext<'/api/reportes/[id]'>) => {
  const usuario = await requerirUsuarioApi();
  const { id } = await ctx.params;
  const detalle = await detalleVisible(db, usuario, id);
  if (!detalle) throw errores.noEncontrado('El reporte');
  return NextResponse.json({ reporte: detalle });
});
