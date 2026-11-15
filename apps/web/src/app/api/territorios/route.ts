import { asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { territorios } from '@/db/schema';
import { conErrores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';

/** GET /api/territorios — catálogo de territorios con su centroide (todos los roles). */
export const GET = conErrores(async () => {
  await requerirUsuarioApi();
  const filas = await db
    .select({ id: territorios.id, nombre: territorios.nombre, centroide: territorios.centroide })
    .from(territorios)
    .orderBy(asc(territorios.nombre));
  return NextResponse.json({ territorios: filas });
});
