import { NextResponse } from 'next/server';
import { db } from '@/db';
import { NuevoRespaldoSchema } from '@/domain/reporte-input';
import { conErrores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { sumarRespaldo } from '@/server/reportes/gestion';

/** POST /api/reportes/{id}/respaldos — sumar respaldo vecinal (RF-4.3). Body: { nVecinos, canal, nota? } */
export const POST = conErrores(async (req: Request, ctx: RouteContext<'/api/reportes/[id]/respaldos'>) => {
  const usuario = await requerirUsuarioApi('reporte:crear');
  const { id } = await ctx.params;
  const input = NuevoRespaldoSchema.parse(await leerJson(req));
  const r = await sumarRespaldo(db, usuario, id, input);
  return NextResponse.json(r, { status: 201 });
});
