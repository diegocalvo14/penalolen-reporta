/**
 * Firma y verificación del token de sesión (JWT HS256 en cookie httpOnly).
 * Este módulo no toca la BD, así que lo puede usar proxy.ts.
 */
import { jwtVerify, SignJWT } from 'jose';
import type { Rol } from '@/db/schema';
import { esRol } from '@/domain/permisos';

export const SESSION_COOKIE = 'pr_session';
export const SESSION_DURACION_S = 60 * 60 * 12; // 12 horas (una jornada)

export interface SessionClaims {
  sub: string; // id del usuario
  rol: Rol;
  nombre: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET falta o es muy corto (mínimo 32 caracteres). Revisa el archivo .env');
  }
  return new TextEncoder().encode(secret);
}

export async function firmarSesion(claims: SessionClaims): Promise<string> {
  return new SignJWT({ rol: claims.rol, nombre: claims.nombre })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURACION_S}s`)
    .setIssuer('penalolen-reporta')
    .sign(secretKey());
}

/** Devuelve los datos de la sesión o null si el token falta, expiró o fue alterado. */
export async function verificarSesion(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'penalolen-reporta',
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string' || !esRol(payload.rol) || typeof payload.nombre !== 'string') {
      return null;
    }
    return { sub: payload.sub, rol: payload.rol, nombre: payload.nombre };
  } catch {
    return null;
  }
}
