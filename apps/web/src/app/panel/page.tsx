import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { AlertTriangle, BellRing, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  CategoriaPunto,
  EstadoBadge,
  FueraTerritorioBadge,
  RevisionBadge,
  SeveridadBadge,
} from '@/components/reportes/Etiquetas';
import { Card, CardContent } from '@/components/shared/Card';
import { db } from '@/db';
import { categorias, configuracion, reportes, territorios, usuarios } from '@/db/schema';
import { ESTADOS_ABIERTOS } from '@/domain/estados';
import { leerFiltros } from '@/domain/filtros-bandeja';
import { hace } from '@/lib/fechas';
import { requerirUsuarioPagina } from '@/server/auth/session';
import { listarAlertas, listarBandeja } from '@/server/reportes/consultas';
import FiltrosBandeja from './FiltrosBandeja';

export const metadata = { title: 'Bandeja · Peñalolén Reporta' };

/** Bandeja municipal (RF-6.1 y RF-6.4). */
export default async function PanelBandeja({ searchParams }: PageProps<'/panel'>) {
  const usuario = await requerirUsuarioPagina(['funcionario', 'admin'], '/panel');
  const parametros = await searchParams;
  const filtros = leerFiltros(parametros);

  const [bandeja, [total], [abiertos], [resueltos], [encargados], listaCategorias, listaTerritorios] = await Promise.all([
    listarBandeja(db, filtros),
    db.select({ n: count() }).from(reportes),
    db.select({ n: count() }).from(reportes).where(inArray(reportes.estado, [...ESTADOS_ABIERTOS])),
    db.select({ n: count() }).from(reportes).where(eq(reportes.estado, 'resuelto')),
    db
      .select({ n: count() })
      .from(usuarios)
      .where(and(eq(usuarios.rol, 'encargado'), eq(usuarios.activo, true))),
    db.select({ id: categorias.id, nombre: categorias.nombre }).from(categorias).orderBy(asc(categorias.id)),
    db.select({ id: territorios.id, nombre: territorios.nombre }).from(territorios).orderBy(asc(territorios.nombre)),
  ]);

  const [config] = await db.select({ umbral: configuracion.umbralAlertaRespaldos }).from(configuracion).limit(1);
  const umbral = config?.umbral ?? 10;
  const alertas = await listarAlertas(db, umbral);

  const tarjetas = [
    { label: 'Reportes totales', valor: total.n, icon: Inbox, color: 'text-navy-700 bg-navy-50' },
    { label: 'Abiertos', valor: abiertos.n, icon: AlertTriangle, color: 'text-amber-700 bg-amber-50' },
    { label: 'Resueltos', valor: resueltos.n, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Encargados activos', valor: encargados.n, icon: Users, color: 'text-slate-700 bg-slate-100' },
  ];

  const enlacePagina = (pagina: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(parametros)) if (typeof v === 'string' && v) p.set(k, v);
    p.set('pagina', String(pagina));
    return `/panel?${p.toString()}`;
  };
  const anterior = enlacePagina(filtros.pagina - 1);
  const siguiente = enlacePagina(filtros.pagina + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Bandeja de reportes</h1>
        <p className="text-sm text-slate-500">
          {usuario.unidad ? `Unidad ${usuario.unidad} · ` : ''}Reportes registrados por los encargados barriales.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tarjetas.map(({ label, valor, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{valor}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {alertas.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <BellRing size={16} /> {alertas.length} {alertas.length === 1 ? 'reporte requiere' : 'reportes requieren'} atención
          </p>
          <p className="mt-0.5 text-xs text-red-700">Abiertos con {umbral} o más vecinos, o con severidad crítica sugerida por IA.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {alertas.map((a) => (
              <Link
                key={a.id}
                href={`/panel/reportes/${a.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm hover:border-red-400"
              >
                <CategoriaPunto color={a.categoria.color} />
                <span className="font-mono font-semibold text-navy-700">{a.folio}</span>
                <span className="text-slate-500">{a.totalRespaldoVecinos} vecinos</span>
                {a.analisis?.severidad === 'critica' && <SeveridadBadge analisis={a.analisis} />}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Suspense>
        <FiltrosBandeja categorias={listaCategorias} territorios={listaTerritorios} />
      </Suspense>

      <Card>
        {bandeja.items.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-slate-500">
            <Inbox size={32} className="mx-auto mb-2 text-slate-300" />
            {total.n === 0
              ? 'Aún no hay reportes. Aparecerán aquí cuando los encargados empiecen a registrarlos.'
              : 'Ningún reporte coincide con los filtros.'}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Folio</th>
                  <th className="px-4 py-2.5">Categoría</th>
                  <th className="px-4 py-2.5">Territorio</th>
                  <th className="px-4 py-2.5 text-right">Respaldos</th>
                  <th className="px-4 py-2.5">Severidad IA</th>
                  <th className="px-4 py-2.5">Antigüedad</th>
                  <th className="px-4 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bandeja.items.map((r) => {
                  const destacado = r.fueraDeTerritorio || r.analisis?.requiereRevision;
                  return (
                    <tr key={r.id} className={`hover:bg-slate-50 ${destacado ? 'bg-orange-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <Link href={`/panel/reportes/${r.id}`} className="font-mono font-semibold text-navy-700 hover:underline">
                          {r.folio}
                        </Link>
                        {destacado && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.fueraDeTerritorio && <FueraTerritorioBadge />}
                            {r.analisis?.requiereRevision && <RevisionBadge />}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <CategoriaPunto color={r.categoria.color} />
                          {r.categoria.nombre}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.territorio.nombre}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{r.totalRespaldoVecinos}</td>
                      <td className="px-4 py-3">
                        {r.categoria.usaIa ? <SeveridadBadge analisis={r.analisis} /> : <span className="text-xs text-slate-400">No aplica</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{hace(r.creadoEn)}</td>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={r.estado} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {bandeja.paginas > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Página {filtros.pagina} de {bandeja.paginas} · {bandeja.total} reportes
          </span>
          <div className="flex gap-2">
            {filtros.pagina > 1 && (
              <Link href={anterior} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5">
                <ChevronLeft size={14} /> Anterior
              </Link>
            )}
            {filtros.pagina < bandeja.paginas && (
              <Link href={siguiente} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5">
                Siguiente <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
