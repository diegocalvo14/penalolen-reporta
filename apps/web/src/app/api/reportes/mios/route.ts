import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conErrores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { listarMisReportes } from '@/server/reportes/consultas';

/** GET /api/reportes/mios — reportes registrados por el encargado de la sesión (RF-3.6). */
export const GET = conErrores(async () => {
  const usuario = await requerirUsuarioApi('reporte:ver_propios');
  const items = await listarMisReportes(db, usuario.id);
  return NextResponse.json({ items });
});
