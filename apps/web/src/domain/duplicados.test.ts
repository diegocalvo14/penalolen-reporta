import { describe, expect, it } from 'vitest';
import { aplicaBusquedaDuplicados } from './duplicados';

describe('aplicaBusquedaDuplicados (RF-4.1)', () => {
  it('aplica con punto marcado en el mapa', () => {
    expect(aplicaBusquedaDuplicados('mapa', null, 15)).toBe(true);
  });
  it('aplica con GPS más preciso que el radio (incluido el borde)', () => {
    expect(aplicaBusquedaDuplicados('gps', 8, 15)).toBe(true);
    expect(aplicaBusquedaDuplicados('gps', 15, 15)).toBe(true);
  });
  it('no aplica si la precisión es peor que el radio', () => {
    expect(aplicaBusquedaDuplicados('gps', 15.1, 15)).toBe(false);
  });
  it('no aplica con ubicación aproximada', () => {
    expect(aplicaBusquedaDuplicados('centroide', null, 15)).toBe(false);
  });
});
