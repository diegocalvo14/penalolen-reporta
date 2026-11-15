/**
 * Folio legible de un reporte: PR-2026-00042 (PROMPT_DESARROLLO §5).
 * El correlativo se reinicia cada año y se obtiene de forma atómica en la BD
 * (tabla folio_contadores, ver src/server/folios.ts).
 */
export const FOLIO_PREFIJO = 'PR';
export const FOLIO_DIGITOS = 5;
export const FOLIO_REGEX = /^PR-(\d{4})-(\d{5,})$/;

export function formatFolio(anio: number, correlativo: number): string {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 9999) {
    throw new Error(`Año inválido para folio: ${anio}`);
  }
  if (!Number.isInteger(correlativo) || correlativo < 1) {
    throw new Error(`Correlativo inválido para folio: ${correlativo}`);
  }
  return `${FOLIO_PREFIJO}-${anio}-${String(correlativo).padStart(FOLIO_DIGITOS, '0')}`;
}

export function parseFolio(folio: string): { anio: number; correlativo: number } | null {
  const m = FOLIO_REGEX.exec(folio.trim().toUpperCase());
  if (!m) return null;
  return { anio: Number(m[1]), correlativo: Number(m[2]) };
}

/** Año del folio según la hora de Chile (un reporte del 31/12 a las 23:30 es de ese año). */
export function anioFolio(fecha: Date = new Date()): number {
  const anio = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', year: 'numeric' }).format(fecha);
  return Number(anio);
}
