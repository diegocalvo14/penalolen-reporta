import { NextResponse } from 'next/server';
import { conErrores } from '@/server/api';
import { SESSION_COOKIE } from '@/server/auth/jwt';
import { usarCookieSegura } from '@/server/auth/cookie';

function borrarCookie(res: NextResponse, req: Request) {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: usarCookieSegura(req),
    path: '/',
    maxAge: 0,
  });
  return res;
}

/** POST /api/auth/logout — cierre de sesión desde la interfaz. */
export const POST = conErrores(async (req: Request) => borrarCookie(NextResponse.json({ ok: true }), req));

/**
 * GET /api/auth/logout — lo usan las páginas cuando el token es válido pero el
 * usuario ya no (desactivado o eliminado): borra la cookie y lleva al login.
 * Sin esto, proxy.ts (que solo mira el token) y el layout se redirigirían en ciclo.
 */
export const GET = conErrores(async (req: Request) => {
  const login = new URL('/login', req.url);
  const next = new URL(req.url).searchParams.get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) login.searchParams.set('next', next);
  return borrarCookie(NextResponse.redirect(login), req);
});
