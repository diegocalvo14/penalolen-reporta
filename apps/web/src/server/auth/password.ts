import bcrypt from 'bcryptjs';

const COSTO = 10;

export function hashPassword(plano: string): Promise<string> {
  return bcrypt.hash(plano, COSTO);
}

export function verifyPassword(plano: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plano, hash);
}

let hashSenuelo: Promise<string> | null = null;

/**
 * Hash de una contraseña aleatoria que nadie conoce. Cuando el email no existe se
 * compara contra este hash para que la respuesta tarde lo mismo y no revele qué
 * correos están registrados.
 */
export function obtenerHashSenuelo(): Promise<string> {
  hashSenuelo ??= bcrypt.hash(crypto.randomUUID(), COSTO);
  return hashSenuelo;
}
