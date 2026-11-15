import { describe, expect, it } from 'vitest';
import { resolverTerritorio } from './territorio';

const LA_FAENA = 2;
const LO_HERMIDA = 1;

describe('resolverTerritorio (RF-3.5)', () => {
  it('sin polígonos usa el centroide más cercano', () => {
    const r = resolverTerritorio(
      [
        { id: LO_HERMIDA, cubre: false, distanciaM: 1500 },
        { id: LA_FAENA, cubre: false, distanciaM: 80 },
      ],
      LA_FAENA,
      'gps',
    );
    expect(r).toEqual({ territorioId: LA_FAENA, fueraDeTerritorio: false });
  });

  it('marca fuera de territorio si el punto está más cerca de otro territorio', () => {
    const r = resolverTerritorio(
      [
        { id: LO_HERMIDA, cubre: false, distanciaM: 40 },
        { id: LA_FAENA, cubre: false, distanciaM: 1300 },
      ],
      LA_FAENA,
      'mapa',
    );
    expect(r).toEqual({ territorioId: LO_HERMIDA, fueraDeTerritorio: true });
  });

  it('un polígono que contiene el punto manda sobre la distancia', () => {
    const r = resolverTerritorio(
      [
        { id: LO_HERMIDA, cubre: false, distanciaM: 10 },
        { id: LA_FAENA, cubre: true, distanciaM: 900 },
      ],
      LA_FAENA,
      'gps',
    );
    expect(r).toEqual({ territorioId: LA_FAENA, fueraDeTerritorio: false });
  });

  it('si dos polígonos se solapan, prefiere el del encargado', () => {
    const r = resolverTerritorio(
      [
        { id: LO_HERMIDA, cubre: true, distanciaM: 10 },
        { id: LA_FAENA, cubre: true, distanciaM: 20 },
      ],
      LA_FAENA,
      'gps',
    );
    expect(r.territorioId).toBe(LA_FAENA);
  });

  it('la ubicación aproximada (centroide) siempre queda en el territorio del encargado', () => {
    const r = resolverTerritorio([{ id: LO_HERMIDA, cubre: true, distanciaM: 0 }], LA_FAENA, 'centroide');
    expect(r).toEqual({ territorioId: LA_FAENA, fueraDeTerritorio: false });
  });

  it('sin datos geográficos no marca fuera de territorio', () => {
    expect(resolverTerritorio([{ id: LO_HERMIDA, cubre: false, distanciaM: null }], LA_FAENA, 'gps')).toEqual({
      territorioId: LA_FAENA,
      fueraDeTerritorio: false,
    });
  });
});
