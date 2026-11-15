import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { conErrores, errores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { marcarLeida } from '@/server/notificaciones';

/** PATCH /api/notificaciones/{id} — marcar como leída (id = "todas" marca todas). */
export const PATCH = conErrores(async (_req: Request, ctx: RouteContext<'/api/notificaciones/[id]'>) => {
  const usuario = await requerirUsuarioApi();
  const { id } = await ctx.params;
  if (id !== 'todas' && !z.string().uuid().safeParse(id).success) throw errores.noEncontrado('La notificación');
  const cambiadas = await marcarLeida(db, usuario.id, id);
  if (id !== 'todas' && cambiadas === 0) throw errores.noEncontrado('La notificación');
  return NextResponse.json({ ok: true, cambiadas });
});
