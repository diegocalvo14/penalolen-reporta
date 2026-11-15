import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { EditarUsuarioSchema } from '@/domain/admin';
import { editarUsuario } from '@/server/admin';
import { conErrores, errores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';

/** PATCH /api/admin/usuarios/{id} — edita rol, territorio, unidad, activo o restablece la contraseña. */
export const PATCH = conErrores(async (req: Request, ctx: RouteContext<'/api/admin/usuarios/[id]'>) => {
  const admin = await requerirUsuarioApi('admin:gestionar');
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw errores.noEncontrado('El usuario');
  const input = EditarUsuarioSchema.parse(await leerJson(req));
  return NextResponse.json(await editarUsuario(db, admin.id, id, input));
});
