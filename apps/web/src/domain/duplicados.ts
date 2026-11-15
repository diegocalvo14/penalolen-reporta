/**
 * ¿Corresponde buscar duplicados? (RF-4.1)
 * No se aplica si la ubicación es aproximada (centroide) ni si la precisión del
 * GPS es peor que el radio de la categoría: el resultado no sería confiable.
 */
export function aplicaBusquedaDuplicados(
  origen: 'gps' | 'mapa' | 'centroide',
  precisionM: number | null | undefined,
  radioM: number,
): boolean {
  if (origen === 'centroide') return false;
  if (precisionM !== null && precisionM !== undefined && precisionM > radioM) return false;
  return radioM > 0;
}
