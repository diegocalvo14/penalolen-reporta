import { describe, expect, it } from 'vitest';
import { anioFolio, formatFolio, parseFolio } from './folio';

describe('formatFolio', () => {
  it('genera el formato PR-AAAA-NNNNN con ceros a la izquierda', () => {
    expect(formatFolio(2026, 42)).toBe('PR-2026-00042');
    expect(formatFolio(2026, 1)).toBe('PR-2026-00001');
  });

  it('no trunca correlativos de más de 5 dígitos', () => {
    expect(formatFolio(2026, 123456)).toBe('PR-2026-123456');
  });

  it('rechaza correlativos y años inválidos', () => {
    expect(() => formatFolio(2026, 0)).toThrow();
    expect(() => formatFolio(2026, -3)).toThrow();
    expect(() => formatFolio(2026, 1.5)).toThrow();
    expect(() => formatFolio(26, 1)).toThrow();
  });
});

describe('parseFolio', () => {
  it('es el inverso de formatFolio', () => {
    expect(parseFolio(formatFolio(2027, 815))).toEqual({ anio: 2027, correlativo: 815 });
  });

  it('acepta minúsculas y espacios', () => {
    expect(parseFolio('  pr-2026-00042 ')).toEqual({ anio: 2026, correlativo: 42 });
  });

  it('devuelve null si el formato no corresponde', () => {
    expect(parseFolio('#B-2026-0042')).toBeNull();
    expect(parseFolio('PR-26-00042')).toBeNull();
    expect(parseFolio('')).toBeNull();
  });
});

describe('anioFolio', () => {
  it('usa la hora de Chile: el 31/12 a las 23:30 (UTC-3) sigue siendo ese año', () => {
    // 2026-12-31 23:30 en Santiago = 2027-01-01 02:30 UTC
    expect(anioFolio(new Date('2027-01-01T02:30:00Z'))).toBe(2026);
  });
});
