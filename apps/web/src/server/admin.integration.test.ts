/** Integración: administración (RF-1.3, RF-1.4, RF-2.2). */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import * as schema from '@/db/schema';
import { NuevoUsuarioSchema } from '@/domain/admin';
import { crearBaseDePrueba, integracionHabilitada, sembrarBasico, type BaseDePrueba } from '@/test/db';
import { crearUsuario, editarCategoria, editarUsuario, guardarConfiguracion, guardarTerritorio } from './admin';
import { verifyPassword } from './auth/password';

describe.skipIf(!integracionHabilitada)('administración contra PostGIS', () => {
  let base: BaseDePrueba;
  let db: Db;
  let s: Awaited<ReturnType<typeof sembrarBasico>>;
  let adminId: string;

  beforeAll(async () => {
    base = await crearBaseDePrueba('admin');
    db = base.db;
    s = await sembrarBasico(db);
    const [a] = await db.insert(schema.usuarios).values({ nombre: 'Admin', email: 'admin@test', passwordHash: 'x', rol: 'admin' }).returning();
    adminId = a.id;
  });
  afterAll(async () => base?.cerrar());

  it('crea un encargado con contraseña temporal que debe cambiar al entrar', async () => {
    const r = await crearUsuario(db, NuevoUsuarioSchema.parse({ nombre: 'Pedro Soto', email: 'Pedro@Test.cl', rol: 'encargado', territorioId: s.laFaena }));
    expect(r.claveTemporal).toHaveLength(10);
    const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.id, r.id));
    expect(u).toMatchObject({ email: 'pedro@test.cl', debeCambiarPassword: true, territorioId: s.laFaena, unidad: null });
    expect(await verifyPassword(r.claveTemporal, u.passwordHash)).toBe(true);
    await expect(crearUsuario(db, NuevoUsuarioSchema.parse({ nombre: 'Otro', email: 'pedro@test.cl', rol: 'admin' }))).rejects.toMatchObject({ status: 409 });
  });

  it('exige territorio al encargado y unidad al funcionario', () => {
    expect(NuevoUsuarioSchema.safeParse({ nombre: 'X Y', email: 'x@y.cl', rol: 'encargado' }).success).toBe(false);
    expect(NuevoUsuarioSchema.safeParse({ nombre: 'X Y', email: 'x@y.cl', rol: 'funcionario' }).success).toBe(false);
  });

  it('cambia rol (limpia territorio), desactiva y restablece contraseña; el admin no puede bloquearse', async () => {
    await editarUsuario(db, adminId, s.luis.id, { rol: 'funcionario', unidad: 'DIDECO' });
    const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.id, s.luis.id));
    expect(u).toMatchObject({ rol: 'funcionario', unidad: 'DIDECO', territorioId: null });

    const r = await editarUsuario(db, adminId, s.luis.id, { activo: false, resetPassword: true });
    expect(r.claveTemporal).toBeTruthy();
    const [u2] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.id, s.luis.id));
    expect(u2).toMatchObject({ activo: false, debeCambiarPassword: true });

    await expect(editarUsuario(db, adminId, adminId, { activo: false })).rejects.toMatchObject({ status: 409 });
    await expect(editarUsuario(db, adminId, adminId, { rol: 'encargado', territorioId: s.laFaena })).rejects.toMatchObject({ status: 409 });
  });

  it('guarda umbrales válidos y rechaza incoherentes', async () => {
    const c = await guardarConfiguracion(db, { umbralMedia: 6, umbralCritica: 18, umbralAlertaRespaldos: 12, visionTimeoutMs: 8000 });
    expect(c).toMatchObject({ umbralMedia: 6, umbralCritica: 18 });
    await expect(guardarConfiguracion(db, { umbralMedia: 20, umbralCritica: 10, umbralAlertaRespaldos: 5, visionTimeoutMs: 8000 })).rejects.toMatchObject({ status: 400 });
  });

  it('edita categorías y territorios sin duplicar nombres', async () => {
    const c = await editarCategoria(db, s.bache, { radioDuplicadoM: 20, color: '#ff0000' });
    expect(c).toMatchObject({ radioDuplicadoM: 20, color: '#ff0000' });
    await expect(editarCategoria(db, s.bache, { nombre: 'Luminaria en falla' })).rejects.toMatchObject({ status: 409 });

    const t = await guardarTerritorio(db, null, { nombre: 'San Luis', lat: -33.4925, lng: -70.5705 });
    await guardarTerritorio(db, t.id, { nombre: 'San Luis de Macul', lat: -33.49, lng: -70.57 });
    const [fila] = await db.select().from(schema.territorios).where(eq(schema.territorios.id, t.id));
    expect(fila.nombre).toBe('San Luis de Macul');
    expect(fila.centroide).toEqual({ lat: -33.49, lng: -70.57 });
    await expect(guardarTerritorio(db, null, { nombre: 'La Faena', lat: 0, lng: 0 })).rejects.toMatchObject({ status: 409 });
  });
});
