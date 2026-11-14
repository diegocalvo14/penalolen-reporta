/**
 * Severidad sugerida por IA a partir del % de cobertura del bache en la foto
 * (PROMPT_DESARROLLO §2): Baja < 8 %, Media 8–20 %, Crítica > 20 %.
 *
 * Los umbrales vienen de la tabla `configuracion` para que el administrador los
 * ajuste con la DOM. La API recalcula siempre la severidad con esta función, sin
 * depender de la que devuelve el servicio de visión. Siempre se muestra como
 * "sugerida por IA".
 */
import type { Severidad } from '@/db/schema';

export interface UmbralesSeveridad {
  /** % de cobertura desde el cual la severidad es Media (inclusive). */
  umbralMedia: number;
  /** % de cobertura sobre el cual la severidad es Crítica (exclusive). */
  umbralCritica: number;
}

export const UMBRALES_POR_DEFECTO: UmbralesSeveridad = { umbralMedia: 8, umbralCritica: 20 };

/** Confianza máxima bajo la cual el análisis se marca para revisión humana. */
export const CONFIANZA_MINIMA_REVISION = 0.4;

export const SEVERIDAD_LABEL: Record<Severidad, string> = {
  baja: 'Baja',
  media: 'Media',
  critica: 'Crítica',
  sin_deteccion: 'Sin detección',
};

export function validarUmbrales(u: UmbralesSeveridad): string | null {
  if (!Number.isFinite(u.umbralMedia) || !Number.isFinite(u.umbralCritica)) return 'Los umbrales deben ser números.';
  if (u.umbralMedia <= 0) return 'El umbral de severidad media debe ser mayor que 0 %.';
  if (u.umbralCritica > 100) return 'El umbral de severidad crítica no puede superar 100 %.';
  if (u.umbralMedia >= u.umbralCritica) return 'El umbral medio debe ser menor que el crítico.';
  return null;
}

/**
 * @param ratioCobertura % del área de la foto cubierta por el bache más grande (0–100)
 * @param cantidadDetecciones número de cajas detectadas
 */
export function calcularSeveridad(
  ratioCobertura: number,
  cantidadDetecciones: number,
  umbrales: UmbralesSeveridad = UMBRALES_POR_DEFECTO,
): Severidad {
  if (cantidadDetecciones <= 0 || !Number.isFinite(ratioCobertura) || ratioCobertura <= 0) {
    return 'sin_deteccion';
  }
  if (ratioCobertura > umbrales.umbralCritica) return 'critica';
  if (ratioCobertura >= umbrales.umbralMedia) return 'media';
  return 'baja';
}

/**
 * Un análisis requiere revisión humana si no detectó nada o si la mejor
 * detección tiene baja confianza. Si el servicio de visión ya lo pidió, se respeta.
 */
export function requiereRevision(
  severidad: Severidad,
  confianzas: number[],
  pedidoPorVision = false,
): boolean {
  if (pedidoPorVision) return true;
  if (severidad === 'sin_deteccion') return true;
  const mejor = confianzas.length > 0 ? Math.max(...confianzas) : 0;
  return mejor < CONFIANZA_MINIMA_REVISION;
}
