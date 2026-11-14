import { describe, expect, it } from 'vitest';
import type { EstadoReporte } from '@/db/schema';
import { ESTADOS, ESTADOS_ABIERTOS, ESTADOS_CERRADOS, puedeTransicionar, validarCambioEstado } from './estados';

const VALIDAS: Array<[EstadoReporte, EstadoReporte]> = [
  ['ingresado', 'en_revision'],
  ['en_revision', 'en_gestion'],
  ['en_revision', 'duplicado'],
  ['en_revision', 'rechazado'],
  ['en_gestion', 'resuelto'],
  ['en_gestion', 'derivado'],
  ['derivado', 'resuelto'],
];

describe('máquina de estados (§6)', () => {
  it.each(VALIDAS)('permite %s → %s', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(true);
  });

  it('rechaza cualquier transición que no esté en el diagrama', () => {
    const validas = new Set(VALIDAS.map(([a, b]) => `${a}>${b}`));
    for (const desde of ESTADOS) {
      for (const hacia of ESTADOS) {
        if (!validas.has(`${desde}>${hacia}`)) {
          expect(puedeTransicionar(desde, hacia), `${desde} → ${hacia}`).toBe(false);
        }
      }
    }
  });

  it('los estados cerrados no tienen salida', () => {
    for (const cerrado of ESTADOS_CERRADOS) {
      for (const hacia of ESTADOS) expect(puedeTransicionar(cerrado, hacia)).toBe(false);
    }
  });

  it('abiertos y cerrados cubren todos los estados sin solaparse', () => {
    expect([...ESTADOS_ABIERTOS, ...ESTADOS_CERRADOS].sort()).toEqual([...ESTADOS].sort());
  });

  it('no permite saltarse la revisión (ingresado → resuelto)', () => {
    const r = validarCambioEstado({ reporteId: 'a', desde: 'ingresado', hacia: 'resuelto', comentario: 'ok' });
    expect(r).toMatchObject({ ok: false, code: 'TRANSICION_INVALIDA' });
  });
});

describe('datos obligatorios por estado destino', () => {
  it('Resuelto exige comentario de cierre', () => {
    expect(validarCambioEstado({ reporteId: 'a', desde: 'en_gestion', hacia: 'resuelto' })).toMatchObject({
      ok: false,
      code: 'DATOS_FALTANTES',
    });
    expect(
      validarCambioEstado({ reporteId: 'a', desde: 'en_gestion', hacia: 'resuelto', comentario: '   ' }),
    ).toMatchObject({ ok: false });
    expect(
      validarCambioEstado({ reporteId: 'a', desde: 'en_gestion', hacia: 'resuelto', comentario: 'Bache reparado' }),
    ).toEqual({ ok: true });
  });

  it('Derivado exige organismo', () => {
    expect(validarCambioEstado({ reporteId: 'a', desde: 'en_gestion', hacia: 'derivado' })).toMatchObject({
      ok: false,
    });
    expect(
      validarCambioEstado({ reporteId: 'a', desde: 'en_gestion', hacia: 'derivado', organismo: 'SERVIU' }),
    ).toEqual({ ok: true });
  });

  it('Duplicado exige el reporte original y que no sea el mismo', () => {
    expect(validarCambioEstado({ reporteId: 'a', desde: 'en_revision', hacia: 'duplicado' })).toMatchObject({
      ok: false,
    });
    expect(
      validarCambioEstado({ reporteId: 'a', desde: 'en_revision', hacia: 'duplicado', duplicadoDe: 'a' }),
    ).toMatchObject({ ok: false });
    expect(
      validarCambioEstado({ reporteId: 'a', desde: 'en_revision', hacia: 'duplicado', duplicadoDe: 'b' }),
    ).toEqual({ ok: true });
  });

  it('Rechazado exige motivo', () => {
    expect(validarCambioEstado({ reporteId: 'a', desde: 'en_revision', hacia: 'rechazado' })).toMatchObject({
      ok: false,
    });
    expect(
      validarCambioEstado({ reporteId: 'a', desde: 'en_revision', hacia: 'rechazado', motivo: 'Fuera de la comuna' }),
    ).toEqual({ ok: true });
  });
});
