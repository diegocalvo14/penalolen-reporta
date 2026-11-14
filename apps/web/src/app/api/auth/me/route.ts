import { NextResponse } from 'next/server';
import { conErrores } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';

/** GET /api/auth/me — datos del usuario de la sesión (401 si no hay sesión). */
export const GET = conErrores(async () => {
  const usuario = await requerirUsuarioApi();
  return NextResponse.json({ usuario });
});
