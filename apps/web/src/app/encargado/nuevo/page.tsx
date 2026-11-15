import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categorias, territorios } from '@/db/schema';
import { requerirUsuarioPagina } from '@/server/auth/session';
import FormularioReporte from './FormularioReporte';

export const metadata = { title: 'Registrar problema · Peñalolén Reporta' };

// Centro de Peñalolén, por si el territorio no tuviera centroide
const CENTRO_COMUNA = { lat: -33.4855, lng: -70.5585 };

export default async function NuevoReportePage() {
  const usuario = await requerirUsuarioPagina(['encargado'], '/encargado/nuevo');

  const [listaCategorias, territorio] = await Promise.all([
    db
      .select({ id: categorias.id, nombre: categorias.nombre, slug: categorias.slug, usaIa: categorias.usaIa, color: categorias.color })
      .from(categorias)
      .where(eq(categorias.activa, true))
      .orderBy(asc(categorias.id)),
    usuario.territorioId
      ? db
          .select({ nombre: territorios.nombre, centroide: territorios.centroide })
          .from(territorios)
          .where(eq(territorios.id, usuario.territorioId))
          .then((f) => f[0] ?? null)
      : Promise.resolve(null),
  ]);

  return (
    <FormularioReporte
      categorias={listaCategorias}
      territorio={{
        nombre: territorio?.nombre ?? 'Peñalolén',
        centro: territorio?.centroide ?? CENTRO_COMUNA,
        tieneCentroide: Boolean(territorio?.centroide),
      }}
    />
  );
}
