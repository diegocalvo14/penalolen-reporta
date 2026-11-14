import { asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { NuevoUsuarioSchema } from '@/domain/admin';
import { crearUsuario } from '@/server/admin';
import { conErrores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';

/** GET /api/admin/usuarios — lista de usuarios (sin hashes). */
export const GET = conErrores(async () => {
  await requerirUsuarioApi('admin:gestionar');
  const lista = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      territorioId: usuarios.territorioId,
      unidad: usuarios.unidad,
      activo: usuarios.activo,
      debeCambiarPassword: usuarios.debeCambiarPassword,
      creadoEn: usuarios.creadoEn,
    })
    .from(usuarios)
    .orderBy(asc(usuarios.rol), asc(usuarios.nombre));
  return NextResponse.json({ usuarios: lista });
});

/** POST /api/admin/usuarios — crea un usuario con contraseña temporal (se muestra una sola vez). RF-1.3 */
export const POST = conErrores(async (req: Request) => {
  await requerirUsuarioApi('admin:gestionar');
  const input = NuevoUsuarioSchema.parse(await leerJson(req));
  return NextResponse.json(await crearUsuario(db, input), { status: 201 });
});
