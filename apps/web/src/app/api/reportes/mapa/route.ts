import { NextResponse } from 'next/server';
import { db } from '@/db';
import { leerFiltros } from '@/domain/filtros-bandeja';
import { conErrores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { listarParaMapa } from '@/server/reportes/consultas';

/** GET /api/reportes/mapa — puntos para el mapa del panel, con los mismos filtros de la bandeja (RF-6.2). */
export const GET = conErrores(async (req: Request) => {
  await requerirUsuarioApi('reporte:ver_todos');
  return NextResponse.json({ puntos: await listarParaMapa(db, leerFiltros(new URL(req.url).searchParams)) });
});
