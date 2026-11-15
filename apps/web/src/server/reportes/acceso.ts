import { z } from 'zod';
import type { Db } from '@/db';
import { puede } from '@/domain/permisos';
import type { UsuarioSesion } from '@/server/auth/session';
import { obtenerDetalle, type ReporteDetalle } from './consultas';
import { encargadoRespaldo } from './gestion';

const UuidSchema = z.string().uuid();

/**
 * Detalle de un reporte si el usuario puede verlo; si no, null.
 * Un encargado ve los que registró y los que respaldó. Para los demás se
 * responde igual que si no existiera (404), para no revelar qué folios hay.
 */
export async function detalleVisible(db: Db, usuario: UsuarioSesion, id: string): Promise<ReporteDetalle | null> {
  if (!UuidSchema.safeParse(id).success) return null;
  const detalle = await obtenerDetalle(db, id);
  if (!detalle) return null;
  if (puede(usuario.rol, 'reporte:ver_todos')) return detalle;
  if (puede(usuario.rol, 'reporte:ver_propios')) {
    if (detalle.encargado.id === usuario.id) return detalle;
    if (await encargadoRespaldo(db, usuario.id, id)) return detalle;
  }
  return null;
}
