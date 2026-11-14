import { NextResponse } from 'next/server';
import { db } from '@/db';
import { NuevoComentarioSchema } from '@/domain/reporte-input';
import { conErrores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { comentar } from '@/server/reportes/gestion';

/** POST /api/reportes/{id}/comentarios — comentario del funcionario, visible en el historial (RF-6.3). */
export const POST = conErrores(async (req: Request, ctx: RouteContext<'/api/reportes/[id]/comentarios'>) => {
  const usuario = await requerirUsuarioApi('reporte:gestionar');
  const { id } = await ctx.params;
  const { comentario } = NuevoComentarioSchema.parse(await leerJson(req));
  return NextResponse.json(await comentar(db, usuario, id, comentario), { status: 201 });
});
