import { describe, expect, it } from 'vitest';
import { calcularSeveridad, requiereRevision, UMBRALES_POR_DEFECTO, validarUmbrales } from './severidad';

describe('calcularSeveridad con umbrales por defecto (8 % y 20 %)', () => {
  it.each([
    [0.5, 'baja'],
    [7.99, 'baja'],
    [8, 'media'], // borde inferior: 8 % ya es Media
    [12.3, 'media'],
    [20, 'media'], // borde superior: 20 % todavía es Media
    [20.01, 'critica'],
    [64, 'critica'],
  ] as const)('%s %% → %s', (ratio, esperado) => {
    expect(calcularSeveridad(ratio, 1)).toBe(esperado);
  });

  it('sin cajas es "sin_deteccion" aunque llegue un ratio', () => {
    expect(calcularSeveridad(35, 0)).toBe('sin_deteccion');
  });

  it('ratio 0, negativo o no numérico es "sin_deteccion"', () => {
    expect(calcularSeveridad(0, 2)).toBe('sin_deteccion');
    expect(calcularSeveridad(-1, 2)).toBe('sin_deteccion');
    expect(calcularSeveridad(Number.NaN, 2)).toBe('sin_deteccion');
  });
});

describe('calcularSeveridad con umbrales configurados por el administrador', () => {
  const dom = { umbralMedia: 5, umbralCritica: 15 };

  it('respeta los nuevos bordes', () => {
    expect(calcularSeveridad(4.99, 1, dom)).toBe('baja');
    expect(calcularSeveridad(5, 1, dom)).toBe('media');
    expect(calcularSeveridad(15, 1, dom)).toBe('media');
    expect(calcularSeveridad(15.01, 1, dom)).toBe('critica');
  });

  it('el mismo ratio cambia de severidad al cambiar los umbrales', () => {
    expect(calcularSeveridad(10, 1, UMBRALES_POR_DEFECTO)).toBe('media');
    expect(calcularSeveridad(10, 1, { umbralMedia: 12, umbralCritica: 30 })).toBe('baja');
  });
});

describe('validarUmbrales', () => {
  it('acepta los valores por defecto', () => {
    expect(validarUmbrales(UMBRALES_POR_DEFECTO)).toBeNull();
  });

  it('rechaza umbrales incoherentes', () => {
    expect(validarUmbrales({ umbralMedia: 20, umbralCritica: 8 })).not.toBeNull();
    expect(validarUmbrales({ umbralMedia: 10, umbralCritica: 10 })).not.toBeNull();
    expect(validarUmbrales({ umbralMedia: 0, umbralCritica: 10 })).not.toBeNull();
    expect(validarUmbrales({ umbralMedia: 10, umbralCritica: 120 })).not.toBeNull();
    expect(validarUmbrales({ umbralMedia: Number.NaN, umbralCritica: 10 })).not.toBeNull();
  });
});

describe('requiereRevision', () => {
  it('siempre si no hubo detección', () => {
    expect(requiereRevision('sin_deteccion', [])).toBe(true);
  });

  it('si la mejor detección tiene baja confianza', () => {
    expect(requiereRevision('media', [0.2, 0.35])).toBe(true);
    expect(requiereRevision('media', [0.2, 0.62])).toBe(false);
  });

  it('respeta cuando el servicio de visión lo pide', () => {
    expect(requiereRevision('critica', [0.9], true)).toBe(true);
  });
});
