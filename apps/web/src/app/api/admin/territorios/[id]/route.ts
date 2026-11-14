import { NextResponse } from 'next/server';
import { db } from '@/db';
import { TerritorioSchema } from '@/domain/admin';
import { guardarTerritorio } from '@/server/admin';
import { conErrores, errores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';

/** PATCH /api/admin/territorios/{id} — { nombre, lat, lng }. */
export const PATCH = conErrores(async (req: Request, ctx: RouteContext<'/api/admin/territorios/[id]'>) => {
  await requerirUsuarioApi('admin:gestionar');
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw errores.noEncontrado('El territorio');
  const input = TerritorioSchema.parse(await leerJson(req));
  return NextResponse.json(await guardarTerritorio(db, id, input));
});
