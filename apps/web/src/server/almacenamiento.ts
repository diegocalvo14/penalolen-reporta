/**
 * Fotos en un directorio local (PROMPT_DESARROLLO §2): la BD guarda solo la ruta
 * relativa, nunca base64. Los nombres los genera el servidor (RF-11.2).
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function directorioUploads(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR ?? '../../uploads');
}

/** Ruta absoluta de un archivo guardado; impide salir del directorio de uploads. */
export function rutaAbsoluta(rutaRelativa: string): string {
  const base = directorioUploads();
  const abs = path.resolve(/* turbopackIgnore: true */ base, rutaRelativa);
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new Error('Ruta de archivo fuera del directorio permitido');
  }
  return abs;
}

/** Guarda la foto como reportes/AAAA/MM/<uuid>.jpg y devuelve la ruta relativa (con "/"). */
export async function guardarFoto(buffer: Buffer, extension = 'jpg', fecha = new Date()): Promise<string> {
  const anio = String(fecha.getFullYear());
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const relativa = ['reportes', anio, mes, `${randomUUID()}.${extension}`].join('/');
  const abs = rutaAbsoluta(relativa);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer, { flag: 'wx' }); // wx: nunca sobrescribe
  return relativa;
}

export function leerArchivo(rutaRelativa: string): Promise<Buffer> {
  return readFile(rutaAbsoluta(rutaRelativa));
}

/** Borra un archivo; se usa para limpiar si falla la transacción que lo referenciaba. */
export async function borrarArchivo(rutaRelativa: string): Promise<void> {
  await rm(rutaAbsoluta(rutaRelativa), { force: true });
}
