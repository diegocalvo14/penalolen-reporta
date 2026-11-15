import { describe, expect, it } from 'vitest';
import { isValidLatLng, parsePointHex } from './geo';

describe('parsePointHex', () => {
  it('decodifica el EWKB con SRID que entrega PostGIS', () => {
    // SELECT ST_SetSRID(ST_MakePoint(-70.5481, -33.4855), 4326)::geography
    const hex = '0101000020E610000002BC051214A351C0A01A2FDD24BE40C0';
    const p = parsePointHex(hex);
    expect(p.lng).toBeCloseTo(-70.5481, 6);
    expect(p.lat).toBeCloseTo(-33.4855, 6);
  });

  it('rechaza geometrías que no son puntos', () => {
    // Tipo 3 (polígono) sin SRID
    expect(() => parsePointHex('0103000000010000000400000000000000000000000000000000000000000000000000F03F0000000000000000000000000000F03F000000000000F03F00000000000000000000000000000000')).toThrow();
  });
});

describe('isValidLatLng', () => {
  it('valida rangos', () => {
    expect(isValidLatLng({ lat: -33.48, lng: -70.55 })).toBe(true);
    expect(isValidLatLng({ lat: -91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 0, lng: 181 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
  });
});
