import { asc, eq, sql } from 'drizzle-orm';
import { AdminCategorias, AdminConfiguracion, AdminTerritorios, SelectorMotor } from '@/components/admin/AdminCatalogos';
import AdminUsuarios from '@/components/admin/AdminUsuarios';
import { Card, CardContent, CardHeader } from '@/components/shared/Card';
import { db } from '@/db';
import { categorias, configuracion, territorios, usuarios } from '@/db/schema';
import { requerirUsuarioPagina } from '@/server/auth/session';

export const metadata = { title: 'Administración · Peñalolén Reporta' };

/** Administración (RF-1.3, RF-2.2 y RF-5.4). */
export default async function AdminInicio() {
  const admin = await requerirUsuarioPagina(['admin'], '/admin');

  const [listaUsuarios, listaTerritorios, listaCategorias, [config]] = await Promise.all([
    db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        email: usuarios.email,
        rol: usuarios.rol,
        unidad: usuarios.unidad,
        territorioId: usuarios.territorioId,
        activo: usuarios.activo,
        debeCambiarPassword: usuarios.debeCambiarPassword,
      })
      .from(usuarios)
      .orderBy(asc(usuarios.rol), asc(usuarios.nombre)),
    db
      .select({
        id: territorios.id,
        nombre: territorios.nombre,
        lat: sql<number | null>`ST_Y(${territorios.centroide}::geometry)`,
        lng: sql<number | null>`ST_X(${territorios.centroide}::geometry)`,
      })
      .from(territorios)
      .orderBy(asc(territorios.nombre)),
    db.select().from(categorias).orderBy(asc(categorias.id)),
    db.select().from(configuracion).where(eq(configuracion.id, 1)),
  ]);

  const seccion = (titulo: string, descripcion: string, contenido: React.ReactNode) => (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-800">{titulo}</h2>
        <p className="text-xs text-slate-500">{descripcion}</p>
      </CardHeader>
      <CardContent>{contenido}</CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Administración</h1>
        <p className="text-sm text-slate-500">Usuarios, territorios, categorías, umbrales y motor de visión.</p>
      </div>

      {seccion(
        `Usuarios (${listaUsuarios.length})`,
        'Crea usuarios con contraseña temporal, cambia su rol, territorio o unidad, desactívalos o restablece su contraseña.',
        <AdminUsuarios
          usuarios={listaUsuarios}
          territorios={listaTerritorios.map((t) => ({ id: t.id, nombre: t.nombre }))}
          yo={admin.id}
        />,
      )}

      {config &&
        seccion(
          'Umbrales y parámetros',
          'Severidad sugerida por IA según el % de la foto cubierto por el bache; alerta del panel y tiempo máximo del servicio de visión.',
          <AdminConfiguracion
            config={{
              umbralMedia: config.umbralMedia,
              umbralCritica: config.umbralCritica,
              umbralAlertaRespaldos: config.umbralAlertaRespaldos,
              visionTimeoutMs: config.visionTimeoutMs,
            }}
          />,
        )}

      <div className="grid gap-6 xl:grid-cols-2">
        {seccion('Categorías', 'Radio para sugerir duplicados, unidad responsable, uso de IA y color en el mapa.', <AdminCategorias categorias={listaCategorias} />)}
        {seccion(
          'Territorios',
          'Unidades vecinales o barrios con su centroide.',
          <AdminTerritorios territorios={listaTerritorios.map((t) => ({ ...t, lat: t.lat === null ? null : Number(t.lat), lng: t.lng === null ? null : Number(t.lng) }))} />,
        )}
      </div>

      {seccion('Motor de visión', 'Modelo que usa el servicio de visión para analizar los baches (RF-5.4).', <SelectorMotor />)}
    </div>
  );
}
