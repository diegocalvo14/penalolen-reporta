/**
 * ¿La cookie de sesión debe ser `Secure`? En la red local la demo puede correr
 * por http (sin certificados) o por https (mkcert). COOKIE_SECURE=auto (por
 * defecto) decide según el protocolo con que llegó la petición.
 */
export function usarCookieSegura(req: Request): boolean {
  const modo = (process.env.COOKIE_SECURE ?? 'auto').toLowerCase();
  if (modo === 'true') return true;
  if (modo === 'false') return false;
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '');
  return proto === 'https';
}
