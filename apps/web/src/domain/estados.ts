/**
 * Ciclo de estados del reporte (PROMPT_DESARROLLO §6).
 *
 *   Ingresado ──► En revisión ──► En gestión ──► Resuelto
 *                    │                 │
 *                    │                 └──► Derivado ──► Resuelto
 *                    ├──► Duplicado (vinculado a otro reporte)
 *                    └──► Rechazado (con motivo obligatorio)
 *
 * Transiciones no permitidas → la API responde HTTP 409.
 */
import type { EstadoReporte } from '@/db/schema';

export const ESTADOS: readonly EstadoReporte[] = [
  'ingresado',
  'en_revision',
  'en_gestion',
  'derivado',
  'resuelto',
  'duplicado',
  'rechazado',
] as const;

export const TRANSICIONES: Readonly<Record<EstadoReporte, readonly EstadoReporte[]>> = {
  ingresado: ['en_revision'],
  en_revision: ['en_gestion', 'duplicado', 'rechazado'],
  en_gestion: ['resuelto', 'derivado'],
  derivado: ['resuelto'],
  resuelto: [],
  duplicado: [],
  rechazado: [],
};

/** Estados en los que el reporte sigue "abierto" (cuenta para duplicados y métricas). */
export const ESTADOS_ABIERTOS: readonly EstadoReporte[] = ['ingresado', 'en_revision', 'en_gestion', 'derivado'];
export const ESTADOS_CERRADOS: readonly EstadoReporte[] = ['resuelto', 'duplicado', 'rechazado'];

export const ESTADO_LABEL: Record<EstadoReporte, string> = {
  ingresado: 'Ingresado',
  en_revision: 'En revisión',
  en_gestion: 'En gestión',
  derivado: 'Derivado',
  resuelto: 'Resuelto',
  duplicado: 'Duplicado',
  rechazado: 'Rechazado',
};

export function esEstado(valor: unknown): valor is EstadoReporte {
  return typeof valor === 'string' && (ESTADOS as readonly string[]).includes(valor);
}

export function esAbierto(estado: EstadoReporte): boolean {
  return ESTADOS_ABIERTOS.includes(estado);
}

export function puedeTransicionar(desde: EstadoReporte, hacia: EstadoReporte): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export interface CambioEstadoInput {
  reporteId: string;
  desde: EstadoReporte;
  hacia: EstadoReporte;
  comentario?: string | null;
  organismo?: string | null;
  duplicadoDe?: string | null;
  motivo?: string | null;
}

export type ResultadoValidacion =
  | { ok: true }
  | { ok: false; code: 'TRANSICION_INVALIDA' | 'DATOS_FALTANTES'; message: string };

const vacio = (v?: string | null) => !v || v.trim().length === 0;

/**
 * Valida la transición y los datos obligatorios de cada estado destino.
 * - Resuelto: comentario de cierre (la foto de evidencia es opcional)
 * - Derivado: organismo (SERVIU, empresa eléctrica u otra unidad)
 * - Duplicado: id del reporte original, distinto del propio
 * - Rechazado: motivo
 */
export function validarCambioEstado(input: CambioEstadoInput): ResultadoValidacion {
  const { desde, hacia } = input;

  if (!puedeTransicionar(desde, hacia)) {
    return {
      ok: false,
      code: 'TRANSICION_INVALIDA',
      message: `No se puede pasar de "${ESTADO_LABEL[desde]}" a "${ESTADO_LABEL[hacia]}".`,
    };
  }

  if (hacia === 'resuelto' && vacio(input.comentario)) {
    return { ok: false, code: 'DATOS_FALTANTES', message: 'Para cerrar el reporte se requiere un comentario de cierre.' };
  }
  if (hacia === 'derivado' && vacio(input.organismo)) {
    return { ok: false, code: 'DATOS_FALTANTES', message: 'Indica a qué organismo se deriva el reporte.' };
  }
  if (hacia === 'duplicado') {
    if (vacio(input.duplicadoDe)) {
      return { ok: false, code: 'DATOS_FALTANTES', message: 'Indica el reporte original del que este es duplicado.' };
    }
    if (input.duplicadoDe === input.reporteId) {
      return { ok: false, code: 'DATOS_FALTANTES', message: 'Un reporte no puede ser duplicado de sí mismo.' };
    }
  }
  if (hacia === 'rechazado' && vacio(input.motivo)) {
    return { ok: false, code: 'DATOS_FALTANTES', message: 'El rechazo requiere un motivo.' };
  }

  return { ok: true };
}
