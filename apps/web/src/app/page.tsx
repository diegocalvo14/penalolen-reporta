import { redirect } from 'next/navigation';
import { rutaInicio } from '@/domain/permisos';
import { obtenerUsuarioActual } from '@/server/auth/session';

/** "/" lleva a cada rol a su vista (proxy.ts ya lo hace; esto es el respaldo en el servidor). */
export default async function Inicio() {
  const usuario = await obtenerUsuarioActual();
  redirect(usuario ? rutaInicio(usuario.rol) : '/login');
}
