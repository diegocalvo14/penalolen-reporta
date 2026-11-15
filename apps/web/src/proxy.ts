/**
 * Proxy (antes "middleware" en Next.js ≤ 15). Hace una revisión temprana y
 * optimista: si una página protegida se pide sin sesión o con otro rol, redirige.
 * La autorización real se repite en el servidor (layouts y route handlers), como
 * pide RF-1.2 y recomienda la documentación de Next.js.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { puedeEntrar, rolesDeRuta, rutaInicio } from '@/domain/permisos';
import { SESSION_COOKIE, verificarSesion } from '@/server/auth/jwt';

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sesion = await verificarSesion(req.cookies.get(SESSION_COOKIE)?.value);

  // Inicio y login: llevar a cada rol a su vista
  if (pathname === '/' || pathname === '/login') {
    if (sesion) return NextResponse.redirect(new URL(rutaInicio(sesion.rol), req.url));
    if (pathname === '/') return NextResponse.redirect(new URL('/login', req.url));
    return NextResponse.next();
  }

  // Secciones protegidas por rol
  if (rolesDeRuta(pathname)) {
    if (!sesion) {
      const login = new URL('/login', req.url);
      login.searchParams.set('next', pathname + search);
      return NextResponse.redirect(login);
    }
    if (!puedeEntrar(sesion.rol, pathname)) {
      return NextResponse.redirect(new URL(rutaInicio(sesion.rol), req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Páginas solamente: la API valida la sesión en cada handler (y responde JSON, no redirecciones)
  matcher: ['/', '/login', '/encargado/:path*', '/panel/:path*', '/copiloto/:path*', '/admin/:path*'],
};
