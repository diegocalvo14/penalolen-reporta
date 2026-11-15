import { NextResponse } from 'next/server';
import { db } from '@/db';
import { BuscarDuplicadosSchema } from '@/domain/reporte-input';
import { conErrores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { buscarDuplicados } from '@/server/reportes/duplicados';

/**
 * POST /api/reportes/duplicados — antes de crear, busca reportes abiertos de la
 * misma categoría dentro del radio (RF-4.1). Body: { categoriaId, lat, lng, precision?, origen }
 */
export const POST = conErrores(async (req: Request) => {
  await requerirUsuarioApi('reporte:crear');
  const q = BuscarDuplicadosSchema.parse(await leerJson(req));
  const r = await buscarDuplicados(db, {
    categoriaId: q.categoriaId,
    punto: { lat: q.lat, lng: q.lng },
    origen: q.origen,
    precision: q.precision,
  });
  return NextResponse.json(r);
});
