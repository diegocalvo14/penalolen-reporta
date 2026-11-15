import { NextResponse } from 'next/server';
import { db } from '@/db';
import { TerritorioSchema } from '@/domain/admin';
import { guardarTerritorio } from '@/server/admin';
import { conErrores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';

/** POST /api/admin/territorios — { nombre, lat, lng } (centroide). */
export const POST = conErrores(async (req: Request) => {
  await requerirUsuarioApi('admin:gestionar');
  const input = TerritorioSchema.parse(await leerJson(req));
  return NextResponse.json(await guardarTerritorio(db, null, input), { status: 201 });
});
