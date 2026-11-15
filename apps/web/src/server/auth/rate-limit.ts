/**
 * Límite simple de intentos de login en memoria (suficiente para la demo en un
 * solo servidor). Bloquea una combinación IP + email tras demasiados fallos.
 */
const VENTANA_MS = 5 * 60 * 1000;
const MAX_FALLOS = 8;

const fallos = new Map<string, { cuenta: number; desde: number }>();

export function estaBloqueado(clave: string, ahora = Date.now()): boolean {
  const r = fallos.get(clave);
  if (!r) return false;
  if (ahora - r.desde > VENTANA_MS) {
    fallos.delete(clave);
    return false;
  }
  return r.cuenta >= MAX_FALLOS;
}

export function registrarFallo(clave: string, ahora = Date.now()): void {
  const r = fallos.get(clave);
  if (!r || ahora - r.desde > VENTANA_MS) {
    fallos.set(clave, { cuenta: 1, desde: ahora });
  } else {
    r.cuenta += 1;
  }
}

export function limpiarFallos(clave: string): void {
  fallos.delete(clave);
}
