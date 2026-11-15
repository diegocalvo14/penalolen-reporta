import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conErrores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { listarNotificaciones } from '@/server/notificaciones';

/** GET /api/notificaciones — últimas notificaciones del usuario y cuántas no ha leído (RF-7.1). */
export const GET = conErrores(async () => {
  const usuario = await requerirUsuarioApi();
  return NextResponse.json(await listarNotificaciones(db, usuario.id));
});
