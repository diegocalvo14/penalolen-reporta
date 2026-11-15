/** Textos de las notificaciones internas al encargado (RF-7.1). */
import type { EstadoReporte } from '@/db/schema';

export function mensajeCambioEstado(
  folio: string,
  categoria: string,
  hacia: EstadoReporte,
  extra: { organismo?: string | null; motivo?: string | null; folioOriginal?: string | null } = {},
): string {
  switch (hacia) {
    case 'en_revision':
      return `Tu reporte ${folio} (${categoria}) está en revisión por la municipalidad.`;
    case 'en_gestion':
      return `Tu reporte ${folio} (${categoria}) está en gestión.`;
    case 'derivado':
      return `Tu reporte ${folio} (${categoria}) fue derivado a ${extra.organismo ?? 'otro organismo'}.`;
    case 'resuelto':
      return `Tu reporte ${folio} (${categoria}) fue resuelto.`;
    case 'duplicado':
      return `Tu reporte ${folio} se unió al reporte ${extra.folioOriginal ?? 'original'}: sus respaldos se sumaron allí.`;
    case 'rechazado':
      return `Tu reporte ${folio} (${categoria}) fue rechazado${extra.motivo ? `: ${extra.motivo}` : '.'}`;
    case 'ingresado':
      return `Tu reporte ${folio} (${categoria}) fue registrado.`;
  }
}

/** Texto listo para compartir con los vecinos por WhatsApp (RF-7.3). Sin datos personales. */
export function textoParaVecinos(r: {
  folio: string;
  categoria: string;
  territorio: string;
  estadoLabel: string;
  actualizado: string;
  totalVecinos: number;
  urlConsulta?: string | null;
}): string {
  const lineas = [
    `📍 Reporte ${r.folio} · ${r.categoria} (${r.territorio})`,
    `Estado: ${r.estadoLabel} · actualizado ${r.actualizado}`,
    `Respaldado por ${r.totalVecinos} ${r.totalVecinos === 1 ? 'vecino' : 'vecinos'}.`,
  ];
  if (r.urlConsulta) lineas.push(`Sigue el estado aquí: ${r.urlConsulta}`);
  lineas.push('— Encargado/a barrial, vía Peñalolén Reporta');
  return lineas.join('\n');
}
