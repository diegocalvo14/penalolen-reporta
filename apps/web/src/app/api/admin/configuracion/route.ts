import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { configuracion } from '@/db/schema';
import { ConfiguracionSchema } from '@/domain/admin';
import { guardarConfiguracion } from '@/server/admin';
import { conErrores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';

/** GET /api/admin/configuracion — umbrales y parámetros editables. */
export const GET = conErrores(async () => {
  await requerirUsuarioApi('admin:gestionar');
  const [c] = await db.select().from(configuracion).where(eq(configuracion.id, 1));
  return NextResponse.json({ configuracion: c ?? null });
});

/** PATCH /api/admin/configuracion — { umbralMedia, umbralCritica, umbralAlertaRespaldos, visionTimeoutMs } (RF-2.2). */
export const PATCH = conErrores(async (req: Request) => {
  await requerirUsuarioApi('admin:gestionar');
  const input = ConfiguracionSchema.parse(await leerJson(req));
  return NextResponse.json({ configuracion: await guardarConfiguracion(db, input) });
});
