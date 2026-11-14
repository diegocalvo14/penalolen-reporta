/**
 * Sesión del usuario en el servidor (Server Components y Route Handlers).
 * El JWT de la cookie solo prueba quién es; en cada petición se vuelve a leer el
 * usuario desde la BD para respetar desactivaciones y cambios de rol al instante.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { territorios, usuarios, type Rol, type Unidad } from '@/db/schema';
import { puede, rutaInicio, type Accion } from '@/domain/permisos';
import { errores } from '@/server/api';
import { SESSION_COOKIE, verificarSesion } from './jwt';

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  unidad: Unidad | null;
  territorioId: number | null;
  territorioNombre: string | null;
  debeCambiarPassword: boolean;
}

/** Usuario autenticado y activo, o null. */
export async function obtenerUsuarioActual(): Promise<UsuarioSesion | null> {
  const store = await cookies();
  const claims = await verificarSesion(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const [fila] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      unidad: usuarios.unidad,
      activo: usuarios.activo,
      debeCambiarPassword: usuarios.debeCambiarPassword,
      territorioId: usuarios.territorioId,
      territorioNombre: territorios.nombre,
    })
    .from(usuarios)
    .leftJoin(territorios, eq(territorios.id, usuarios.territorioId))
    .where(eq(usuarios.id, claims.sub))
    .limit(1);

  if (!fila || !fila.activo) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    rol: fila.rol,
    unidad: fila.unidad,
    territorioId: fila.territorioId,
    territorioNombre: fila.territorioNombre,
    debeCambiarPassword: fila.debeCambiarPassword,
  };
}

/** Para Route Handlers: exige sesión y, opcionalmente, un permiso. Lanza 401/403. */
export async function requerirUsuarioApi(accion?: Accion): Promise<UsuarioSesion> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw errores.noAutenticado();
  if (accion && !puede(usuario.rol, accion)) throw errores.prohibido();
  return usuario;
}

/** Para páginas y layouts: exige sesión y uno de los roles; si no, redirige. */
export async function requerirUsuarioPagina(roles: readonly Rol[], desde?: string): Promise<UsuarioSesion> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    // Pasa por /api/auth/logout para borrar una cookie que ya no sirve (usuario desactivado)
    redirect(desde ? `/api/auth/logout?next=${encodeURIComponent(desde)}` : '/api/auth/logout');
  }
  // RF-1.4: con contraseña temporal, primero hay que cambiarla
  if (usuario.debeCambiarPassword) redirect('/cambiar-clave');
  if (!roles.includes(usuario.rol)) {
    redirect(rutaInicio(usuario.rol));
  }
  return usuario;
}
