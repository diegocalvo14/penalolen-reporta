/**
 * Utilidades comunes de la API de negocio.
 * Formato de error uniforme (§8.1): { "error": { "code": "...", "message": "..." } }
 */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errores = {
  noAutenticado: () => new ApiError(401, 'NO_AUTENTICADO', 'Debes iniciar sesión.'),
  prohibido: () => new ApiError(403, 'PROHIBIDO', 'No tienes permiso para realizar esta acción.'),
  noEncontrado: (que = 'El recurso') => new ApiError(404, 'NO_ENCONTRADO', `${que} no existe.`),
  invalido: (message: string) => new ApiError(400, 'DATOS_INVALIDOS', message),
  conflicto: (code: string, message: string) => new ApiError(409, code, message),
};

export function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Envuelve un route handler: convierte ApiError y ZodError en respuestas JSON uniformes. */
export function conErrores<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message);
      if (err instanceof ZodError) {
        const detalle = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
        return errorResponse(400, 'DATOS_INVALIDOS', detalle);
      }
      console.error('[api] Error no controlado:', err);
      return errorResponse(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado. Intenta nuevamente.');
    }
  };
}

/** Lee el body JSON; si no es JSON válido responde 400. */
export async function leerJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw errores.invalido('El cuerpo de la petición no es JSON válido.');
  }
}
