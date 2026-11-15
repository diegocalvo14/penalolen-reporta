import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { Suspense } from 'react';
import { BarrasHorizontales, ColumnasSemanales } from '@/components/metricas/Graficos';
import { EstadoBadge } from '@/components/reportes/Etiquetas';
import { Card, CardContent, CardHeader } from '@/components/shared/Card';
import { db } from '@/db';
import { categorias, territorios } from '@/db/schema';
import { ESTADO_LABEL } from '@/domain/estados';
import { SEVERIDAD_LABEL } from '@/domain/severidad';
import { ahoraMs } from '@/lib/fechas';
import { requerirUsuarioPagina } from '@/server/auth/session';
import { calcularMetricas, FiltrosMetricasSchema, inicioDeMes } from '@/server/metricas';
import FiltrosMetricas from './FiltrosMetricas';

export const metadata = { title: 'Métricas · Peñalolén Reporta' };

const horas = (h: number) => (h < 48 ? `${h.toLocaleString('es-CL', { maximumFractionDigits: 1 })} h` : `${(h / 24).toLocaleString('es-CL', { maximumFractionDigits: 1 })} días`);

/** Vista de métricas (RF-9.2): totales, estados, categorías, territorios, semanas y tiempos por etapa. */
export default async function PanelMetricas({ searchParams }: PageProps<'/panel/metricas'>) {
  await requerirUsuarioPagina(['funcionario', 'admin'], '/panel/metricas');
  const p = await searchParams;
  const uno = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
  const periodo = uno('periodo');
  const desde =
    periodo === 'mes' ? inicioDeMes() : periodo === '30d' ? new Date(ahoraMs() - 30 * 864e5) : periodo === '90d' ? new Date(ahoraMs() - 90 * 864e5) : undefined;
  const filtros = FiltrosMetricasSchema.safeParse({ territorio: uno('territorio'), categoria: uno('categoria'), unidad: uno('unidad') });

  const [m, listaTerritorios, listaCategorias] = await Promise.all([
    calcularMetricas(db, { ...(filtros.success ? filtros.data : {}), desde }),
    db.select({ id: territorios.id, nombre: territorios.nombre }).from(territorios).orderBy(asc(territorios.nombre)),
    db.select({ id: categorias.id, nombre: categorias.nombre }).from(categorias).orderBy(asc(categorias.id)),
  ]);

  const tiles = [
    { etiqueta: 'Reportes', valor: m.totales.reportes },
    { etiqueta: 'Abiertos', valor: m.totales.abiertos },
    { etiqueta: 'Resueltos', valor: m.totales.resueltos },
    { etiqueta: 'Vecinos en respaldos', valor: m.totales.vecinos },
    { etiqueta: 'Resolución promedio', valor: m.horasPromedioResolucion === null ? '—' : horas(m.horasPromedioResolucion) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Métricas</h1>
        <p className="text-sm text-slate-500">Calculadas desde los reportes y su historial. Las mismas cifras usa el copiloto.</p>
      </div>
      <Suspense>
        <FiltrosMetricas territorios={listaTerritorios} categorias={listaCategorias} />
      </Suspense>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.etiqueta}>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-slate-800">{t.valor}</p>
              <p className="text-xs text-slate-500">{t.etiqueta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Reportes por estado</h2>
          </CardHeader>
          <CardContent>
            <BarrasHorizontales datos={m.porEstado.map((e) => ({ etiqueta: ESTADO_LABEL[e.estado], valor: e.total }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Reportes por categoría</h2>
          </CardHeader>
          <CardContent>
            <BarrasHorizontales
              datos={m.porCategoria.map((c) => ({ etiqueta: c.categoria, valor: c.total, color: c.color, detalle: `${c.abiertos} ab.` }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Reportes por territorio</h2>
          </CardHeader>
          <CardContent>
            <BarrasHorizontales datos={m.porTerritorio.map((t) => ({ etiqueta: t.territorio, valor: t.total, detalle: `${t.abiertos} ab.` }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Creados por semana (últimas 12)</h2>
          </CardHeader>
          <CardContent>
            <ColumnasSemanales datos={m.creadosPorSemana} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Tiempo promedio por etapa</h2>
            <p className="text-xs text-slate-500">Estadística histórica, no es un plazo comprometido.</p>
          </CardHeader>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {m.tiempoPorEtapa.length === 0 && (
                <tr>
                  <td className="px-5 py-3 text-slate-500">Aún sin cambios de estado.</td>
                </tr>
              )}
              {m.tiempoPorEtapa.map((e) => (
                <tr key={e.estado}>
                  <td className="px-5 py-2.5">{ESTADO_LABEL[e.estado]}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{horas(e.horasPromedio)}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-slate-400">n={e.muestras}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Baches abiertos por severidad sugerida</h2>
          </CardHeader>
          <CardContent>
            <BarrasHorizontales
              datos={m.abiertosPorSeveridad.map((s) => ({
                etiqueta: s.severidad === 'sin_analisis' ? 'Sin análisis' : (SEVERIDAD_LABEL as Record<string, string>)[s.severidad] ?? s.severidad,
                valor: s.total,
              }))}
              vacio="No hay baches abiertos."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Top 5 abiertos por respaldo vecinal</h2>
          </CardHeader>
          <ul className="divide-y divide-slate-100 text-sm">
            {m.top5Respaldos.length === 0 && <li className="px-5 py-3 text-slate-500">No hay reportes abiertos.</li>}
            {m.top5Respaldos.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                <span className="min-w-0">
                  <Link href={`/panel/reportes/${r.id}`} className="font-mono font-semibold text-navy-700 hover:underline">
                    {r.folio}
                  </Link>
                  <span className="block truncate text-xs text-slate-500">
                    {r.categoria} · {r.territorio}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <EstadoBadge estado={r.estado} />
                  <strong className="tabular-nums">{r.total}</strong>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
