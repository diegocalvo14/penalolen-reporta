/**
 * Tipos PostGIS para Drizzle.
 *
 * Las posiciones se guardan como geography(Point, 4326) (PROMPT_DESARROLLO §2).
 * - Al escribir: { lat, lng } → ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
 * - Al leer: PostgreSQL entrega EWKB en hexadecimal → { lat, lng }
 */
import { sql } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Decodifica un punto EWKB/WKB en hexadecimal (formato que entrega PostGIS). */
export function parsePointHex(hex: string): LatLng {
  const buf = Buffer.from(hex, 'hex');
  const littleEndian = buf.readUInt8(0) === 1;
  const readU32 = (o: number) => (littleEndian ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const readF64 = (o: number) => (littleEndian ? buf.readDoubleLE(o) : buf.readDoubleBE(o));

  const type = readU32(1);
  const hasSrid = (type & 0x20000000) !== 0;
  const geomType = type & 0x0fffffff;
  if (geomType !== 1) {
    throw new Error(`Se esperaba un punto (tipo 1) y llegó el tipo ${geomType}`);
  }
  const offset = hasSrid ? 9 : 5;
  const lng = readF64(offset);
  const lat = readF64(offset + 8);
  return { lat, lng };
}

export function isValidLatLng(p: LatLng): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

/** geography(Point, 4326) ↔ { lat, lng } */
export const geographyPoint = customType<{ data: LatLng; driverData: string }>({
  dataType() {
    return 'geography(Point, 4326)';
  },
  toDriver(value) {
    if (!isValidLatLng(value)) throw new Error('Coordenadas inválidas');
    return sql`ST_SetSRID(ST_MakePoint(${value.lng}, ${value.lat}), 4326)::geography` as unknown as string;
  },
  fromDriver(value) {
    return parsePointHex(value);
  },
});

/**
 * geography(Polygon, 4326). Se escribe con GeoJSON y se usa solo dentro de SQL
 * (ST_Covers) para detectar reportes fuera de territorio (RF-3.5).
 */
export const geographyPolygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(Polygon, 4326)';
  },
  toDriver(geojson) {
    return sql`ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)::geography` as unknown as string;
  },
  fromDriver(value) {
    return value; // EWKB en hex; no se decodifica en JS
  },
});
