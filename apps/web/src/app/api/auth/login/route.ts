import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { rutaInicio } from '@/domain/permisos';
import { conErrores, errorResponse, leerJson } from '@/server/api';
import { firmarSesion, SESSION_COOKIE, SESSION_DURACION_S } from '@/server/auth/jwt';
import { obtenerHashSenuelo, verifyPassword } from '@/server/auth/password';
import { estaBloqueado, limpiarFallos, registrarFallo } from '@/server/auth/rate-limit';
import { usarCookieSegura } from '@/server/auth/cookie';

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';

/** POST /api/auth/login — RF-1.1 */
export const POST = conErrores(async (req: Request) => {
  const parsed = LoginSchema.safeParse(await leerJson(req));
  // Mensaje genérico: no revelar si el problema es el correo o la contraseña
  if (!parsed.success) return errorResponse(401, 'CREDENCIALES_INVALIDAS', CREDENCIALES_INVALIDAS);
  const { email, password } = parsed.data;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const clave = `${ip}|${email}`;
  if (estaBloqueado(clave)) {
    return errorResponse(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos fallidos. Espera unos minutos.');
  }

  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);

  // Siempre se compara un hash para que el tiempo de respuesta no delate si el correo existe
  const hash = usuario?.passwordHash ?? (await obtenerHashSenuelo());
  const passwordOk = await verifyPassword(password, hash);

  if (!usuario || !passwordOk || !usuario.activo) {
    registrarFallo(clave);
    return errorResponse(401, 'CREDENCIALES_INVALIDAS', CREDENCIALES_INVALIDAS);
  }
  limpiarFallos(clave);

  const token = await firmarSesion({ sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
  const res = NextResponse.json({
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    redirectTo: usuario.debeCambiarPassword ? '/cambiar-clave' : rutaInicio(usuario.rol),
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: usarCookieSegura(req),
    path: '/',
    maxAge: SESSION_DURACION_S,
  });
  return res;
});
