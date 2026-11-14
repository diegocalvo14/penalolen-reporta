/** Formato de fechas en español de Chile y hora de Santiago. */
const ZONA = 'America/Santiago';

const fechaHora = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const fechaCorta = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, day: 'numeric', month: 'short' });

export function formatoFechaHora(fecha: Date | string): string {
  return fechaHora.format(new Date(fecha));
}

export function formatoFechaCorta(fecha: Date | string): string {
  return fechaCorta.format(new Date(fecha));
}

/** "hace 5 min", "hace 3 h", "hace 2 días" */
export function hace(fecha: Date | string, ahora: Date = new Date()): string {
  const seg = Math.max(0, Math.round((ahora.getTime() - new Date(fecha).getTime()) / 1000));
  if (seg < 60) return 'recién';
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  const m = Math.round(d / 30);
  return `hace ${m} ${m === 1 ? 'mes' : 'meses'}`;
}

/** Hora actual en ms (en una función aparte: el render de un Server Component la usa una vez por petición). */
export function ahoraMs(): number {
  return Date.now();
}
