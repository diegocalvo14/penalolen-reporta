/** Operaciones de administración (RF-1.3, RF-2.2). Solo las invoca un admin. */
import { and, eq, ne } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '@/db';
import { categorias, configuracion, territorios, usuarios } from '@/db/schema';
import type { ConfiguracionSchema, EditarCategoriaSchema, EditarUsuarioSchema, NuevoUsuarioSchema, TerritorioSchema } from '@/domain/admin';
import { generarClaveTemporal } from '@/domain/admin';
import { validarUmbrales } from '@/domain/severidad';
import { errores } from '@/server/api';
import { hashPassword } from '@/server/auth/password';

export async function crearUsuario(db: Db, input: z.infer<typeof NuevoUsuarioSchema>) {
  const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, input.email)).limit(1);
  if (existe) throw errores.conflicto('EMAIL_EN_USO', 'Ya existe un usuario con ese correo.');
  const claveTemporal = generarClaveTemporal();
  const [u] = await db
    .insert(usuarios)
    .values({
      nombre: input.nombre,
      email: input.email,
      rol: input.rol,
      territorioId: input.rol === 'encargado' ? input.territorioId : null,
      unidad: input.rol === 'funcionario' ? input.unidad : null,
      passwordHash: await hashPassword(claveTemporal),
      debeCambiarPassword: true,
    })
    .returning({ id: usuarios.id, email: usuarios.email });
  return { ...u, claveTemporal };
}

export async function editarUsuario(db: Db, adminId: string, id: string, input: z.infer<typeof EditarUsuarioSchema>) {
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
  if (!u) throw errores.noEncontrado('El usuario');
  if (id === adminId && (input.activo === false || (input.rol && input.rol !== 'admin'))) {
    throw errores.conflicto('AUTO_BLOQUEO', 'No puedes desactivarte ni quitarte el rol de administrador.');
  }
  const rol = input.rol ?? u.rol;
  const territorioId = input.territorioId !== undefined ? input.territorioId : u.territorioId;
  const unidad = input.unidad !== undefined ? input.unidad : u.unidad;
  if (rol === 'encargado' && !territorioId) throw errores.invalido('Un encargado necesita un territorio.');
  if (rol === 'funcionario' && !unidad) throw errores.invalido('Un funcionario necesita una unidad (DOM o DIDECO).');

  const cambios: Partial<typeof usuarios.$inferInsert> = {
    nombre: input.nombre ?? u.nombre,
    rol,
    territorioId: rol === 'encargado' ? territorioId : null,
    unidad: rol === 'funcionario' ? unidad : null,
    activo: input.activo ?? u.activo,
  };
  let claveTemporal: string | null = null;
  if (input.resetPassword) {
    claveTemporal = generarClaveTemporal();
    cambios.passwordHash = await hashPassword(claveTemporal);
    cambios.debeCambiarPassword = true;
  }
  await db.update(usuarios).set(cambios).where(eq(usuarios.id, id));
  return { id, claveTemporal };
}

export async function guardarConfiguracion(db: Db, input: z.infer<typeof ConfiguracionSchema>) {
  const error = validarUmbrales({ umbralMedia: input.umbralMedia, umbralCritica: input.umbralCritica });
  if (error) throw errores.invalido(error);
  await db.insert(configuracion).values({ id: 1, ...input }).onConflictDoUpdate({ target: configuracion.id, set: input });
  const [c] = await db.select().from(configuracion).where(eq(configuracion.id, 1));
  return c;
}

export async function editarCategoria(db: Db, id: number, input: z.infer<typeof EditarCategoriaSchema>) {
  if (input.nombre) {
    const [dup] = await db
      .select({ id: categorias.id })
      .from(categorias)
      .where(and(eq(categorias.nombre, input.nombre), ne(categorias.id, id)))
      .limit(1);
    if (dup) throw errores.conflicto('NOMBRE_EN_USO', 'Ya existe una categoría con ese nombre.');
  }
  const [c] = await db.update(categorias).set(input).where(eq(categorias.id, id)).returning();
  if (!c) throw errores.noEncontrado('La categoría');
  return c;
}

export async function guardarTerritorio(db: Db, id: number | null, input: z.infer<typeof TerritorioSchema>) {
  const valores = { nombre: input.nombre, centroide: { lat: input.lat, lng: input.lng } };
  const [dup] = await db
    .select({ id: territorios.id })
    .from(territorios)
    .where(id ? and(eq(territorios.nombre, input.nombre), ne(territorios.id, id)) : eq(territorios.nombre, input.nombre))
    .limit(1);
  if (dup) throw errores.conflicto('NOMBRE_EN_USO', 'Ya existe un territorio con ese nombre.');
  if (id) {
    const [t] = await db.update(territorios).set(valores).where(eq(territorios.id, id)).returning({ id: territorios.id });
    if (!t) throw errores.noEncontrado('El territorio');
    return t;
  }
  const [t] = await db.insert(territorios).values(valores).returning({ id: territorios.id });
  return t;
}
