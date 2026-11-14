/**
 * Validación y procesamiento de fotos (RF-3.1 y RF-11.2).
 *
 * 1. El tipo se detecta por los primeros bytes del archivo (no se confía en la
 *    extensión ni en el MIME que declara el navegador).
 * 2. La imagen se decodifica completa con sharp: si está corrupta o no es una
 *    imagen real, se rechaza.
 * 3. Se guarda una copia normalizada en JPEG: orientación corregida, tamaño
 *    máximo de 2048 px y SIN METADATOS. Eso elimina el EXIF, que puede traer
 *    la ubicación exacta, el modelo del celular o el nombre del dueño.
 */
import sharp from 'sharp';
import { FOTO_MAX_BYTES } from '@/domain/reporte-input';

export type FormatoImagen = 'jpeg' | 'png' | 'webp';

export const MIME_POR_FORMATO: Record<FormatoImagen, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Detecta JPEG, PNG o WEBP por su firma binaria. */
export function detectarFormato(buf: Uint8Array): FormatoImagen | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buf.length >= 12 &&
    String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) === 'RIFF' &&
    String.fromCharCode(buf[8], buf[9], buf[10], buf[11]) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export class ImagenInvalidaError extends Error {}

export interface ImagenProcesada {
  buffer: Buffer;
  mime: 'image/jpeg';
  ancho: number;
  alto: number;
  formatoOriginal: FormatoImagen;
}

const LADO_MAXIMO = 2048;

export async function procesarImagen(entrada: Buffer): Promise<ImagenProcesada> {
  if (entrada.length === 0) throw new ImagenInvalidaError('La foto está vacía.');
  if (entrada.length > FOTO_MAX_BYTES) throw new ImagenInvalidaError('La foto supera el máximo de 10 MB.');

  const formatoOriginal = detectarFormato(entrada);
  if (!formatoOriginal) throw new ImagenInvalidaError('La foto debe ser JPG, PNG o WEBP.');

  try {
    // failOn 'error': rechaza archivos truncados o corruptos
    const { data, info } = await sharp(entrada, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate() // aplica la orientación EXIF antes de descartar los metadatos
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }) // PNG/WEBP con transparencia → fondo blanco
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    return { buffer: data, mime: 'image/jpeg', ancho: info.width, alto: info.height, formatoOriginal };
  } catch {
    throw new ImagenInvalidaError('No se pudo leer la foto. Puede estar dañada; intenta con otra.');
  }
}
