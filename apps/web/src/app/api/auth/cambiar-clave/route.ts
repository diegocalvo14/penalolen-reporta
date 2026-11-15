import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { CambioClaveSchema } from '@/domain/admin';
import { rutaInicio } from '@/domain/permisos';
import { conErrores, errorResponse, leerJson } from '@/server/api';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { requerirUsuarioApi } from '@/server/auth/session';

/** POST /api/auth/cambiar-clave — { actual, nueva } (RF-1.4). */
export const POST = conErrores(async (req: Request) => {
  const usuario = await requerirUsuarioApi();
  const { actual, nueva } = CambioClaveSchema.parse(await leerJson(req));
  const [u] = await db.select({ hash: usuarios.passwordHash }).from(usuarios).where(eq(usuarios.id, usuario.id));
  if (!u || !(await verifyPassword(actual, u.hash))) {
    return errorResponse(400, 'CLAVE_INCORRECTA', 'La contraseña actual no es correcta.');
  }
  await db.update(usuarios).set({ passwordHash: await hashPassword(nueva), debeCambiarPassword: false }).where(eq(usuarios.id, usuario.id));
  return NextResponse.json({ ok: true, redirectTo: rutaInicio(usuario.rol) });
});
