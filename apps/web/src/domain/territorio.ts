/**
 * ¿En qué territorio cae un punto? (RF-3.5)
 *
 * - Si algún territorio tiene polígono y lo contiene, ese es el territorio.
 * - Si no hay polígonos (como en los datos de ejemplo), se usa el centroide más
 *   cercano, lo que equivale a dividir la comuna en zonas de Voronoi.
 * - Con ubicación aproximada (centroide) el reporte queda en el territorio del
 *   encargado: no hay información para decir otra cosa.
 *
 * El reporte se asigna al territorio donde está el problema (así lo ve y filtra
 * la DOM) y se marca `fueraDeTerritorio` si no es el del encargado.
 */
export interface TerritorioCandidato {
  id: number;
  /** true si el territorio tiene polígono y este contiene el punto */
  cubre: boolean;
  /** distancia en metros del punto al centroide (null si no tiene centroide) */
  distanciaM: number | null;
}

export interface ResultadoTerritorio {
  territorioId: number;
  fueraDeTerritorio: boolean;
}

export function resolverTerritorio(
  candidatos: TerritorioCandidato[],
  territorioEncargado: number,
  origen: 'gps' | 'mapa' | 'centroide',
): ResultadoTerritorio {
  if (origen === 'centroide') return { territorioId: territorioEncargado, fueraDeTerritorio: false };

  const cubriendo = candidatos.filter((c) => c.cubre);
  if (cubriendo.length > 0) {
    // Si los polígonos se solapan y uno es el del encargado, se prefiere ese
    const propio = cubriendo.find((c) => c.id === territorioEncargado);
    const elegido = propio ?? cubriendo[0];
    return { territorioId: elegido.id, fueraDeTerritorio: elegido.id !== territorioEncargado };
  }

  const conCentroide = candidatos.filter((c): c is TerritorioCandidato & { distanciaM: number } => c.distanciaM !== null);
  if (conCentroide.length === 0) return { territorioId: territorioEncargado, fueraDeTerritorio: false };

  const masCercano = conCentroide.reduce((a, b) => (b.distanciaM < a.distanciaM ? b : a));
  return { territorioId: masCercano.id, fueraDeTerritorio: masCercano.id !== territorioEncargado };
}
