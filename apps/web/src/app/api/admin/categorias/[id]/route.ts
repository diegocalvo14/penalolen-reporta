import { NextResponse } from 'next/server';
import { db } from '@/db';
import { EditarCategoriaSchema } from '@/domain/admin';
import { editarCategoria } from '@/server/admin';
import { conErrores, errores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';

/** PATCH /api/admin/categorias/{id} — radio de duplicado, usa_ia, color, unidad, activa (RF-2.2). */
export const PATCH = conErrores(async (req: Request, ctx: RouteContext<'/api/admin/categorias/[id]'>) => {
  await requerirUsuarioApi('admin:gestionar');
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw errores.noEncontrado('La categoría');
  const input = EditarCategoriaSchema.parse(await leerJson(req));
  return NextResponse.json({ categoria: await editarCategoria(db, id, input) });
});
