import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conErrores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { calcularMetricas, FiltrosMetricasSchema } from '@/server/metricas';

/** GET /api/metricas?desde&hasta&territorio&categoria&unidad — funcionario/admin (RF-9.1). */
export const GET = conErrores(async (req: Request) => {
  await requerirUsuarioApi('metricas:ver');
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const filtros = FiltrosMetricasSchema.parse(params);
  return NextResponse.json(await calcularMetricas(db, filtros));
});
