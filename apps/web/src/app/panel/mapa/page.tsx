import { asc } from 'drizzle-orm';
import { Suspense } from 'react';
import MapaReportes from '@/components/mapa/MapaReportes';
import { CategoriaPunto } from '@/components/reportes/Etiquetas';
import { db } from '@/db';
import { categorias, territorios } from '@/db/schema';
import { leerFiltros } from '@/domain/filtros-bandeja';
import { requerirUsuarioPagina } from '@/server/auth/session';
import { listarParaMapa } from '@/server/reportes/consultas';
import FiltrosBandeja from '../FiltrosBandeja';

export const metadata = { title: 'Mapa · Peñalolén Reporta' };

const CENTRO_COMUNA = { lat: -33.4855, lng: -70.5585 };

/** Mapa de reportes (RF-6.2): color por categoría, relleno tenue = cerrado, borde rojo = crítico. */
export default async function PanelMapa({ searchParams }: PageProps<'/panel/mapa'>) {
  await requerirUsuarioPagina(['funcionario', 'admin'], '/panel/mapa');
  const filtros = leerFiltros(await searchParams);

  const [puntos, listaCategorias, listaTerritorios] = await Promise.all([
    listarParaMapa(db, filtros),
    db.select({ id: categorias.id, nombre: categorias.nombre, color: categorias.color }).from(categorias).orderBy(asc(categorias.id)),
    db.select({ id: territorios.id, nombre: territorios.nombre }).from(territorios).orderBy(asc(territorios.nombre)),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mapa de reportes</h1>
        <p className="text-sm text-slate-500">
          {puntos.length} {puntos.length === 1 ? 'reporte' : 'reportes'} · el tamaño del punto crece con el respaldo vecinal
        </p>
      </div>
      <Suspense>
        <FiltrosBandeja categorias={listaCategorias} territorios={listaTerritorios} />
      </Suspense>
      <div className="h-[65vh] min-h-[420px] overflow-hidden rounded-xl border border-slate-200">
        <MapaReportes puntos={puntos} centro={CENTRO_COMUNA} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        {listaCategorias.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <CategoriaPunto color={c.color} /> {c.nombre}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-red-900" /> Severidad crítica
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-slate-500 bg-slate-300/50" /> Cerrado
        </span>
      </div>
    </div>
  );
}
