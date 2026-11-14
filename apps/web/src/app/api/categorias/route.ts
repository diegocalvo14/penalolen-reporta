import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { categorias } from '@/db/schema';
import { conErrores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';

/** GET /api/categorias — catálogo de categorías activas (todos los roles). */
export const GET = conErrores(async () => {
  await requerirUsuarioApi();
  const filas = await db.select().from(categorias).where(eq(categorias.activa, true)).orderBy(asc(categorias.id));
  return NextResponse.json({ categorias: filas });
});
