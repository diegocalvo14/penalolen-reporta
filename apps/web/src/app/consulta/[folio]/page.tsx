import { asc, eq, isNotNull, and } from 'drizzle-orm';
import { CheckCircle2, Circle, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import { EstadoBadge } from '@/components/reportes/Etiquetas';
import Marca from '@/components/shared/Marca';
import { db } from '@/db';
import { categorias, eventosHistorial, reportes, territorios } from '@/db/schema';
import { ESTADO_LABEL } from '@/domain/estados';
import { parseFolio } from '@/domain/folio';
import { formatoFechaHora, hace } from '@/lib/fechas';

export const metadata: Metadata = { title: 'Consulta de reporte · Peñalolén Reporta', robots: { index: false, follow: false } };

/**
 * Consulta pública por folio (RF-10.1): solo lectura, sin sesión.
 * Muestra estado y fechas; NO muestra datos del encargado, descripción, fotos ni ubicación exacta.
 */
export default async function ConsultaPublica({ params }: PageProps<'/consulta/[folio]'>) {
  const { folio: crudo } = await params;
  const folio = decodeURIComponent(crudo).trim().toUpperCase();
  const valido = parseFolio(folio) !== null;

  const [r] = valido
    ? await db
        .select({
          id: reportes.id,
          folio: reportes.folio,
          estado: reportes.estado,
          creadoEn: reportes.creadoEn,
          actualizadoEn: reportes.actualizadoEn,
          total: reportes.totalRespaldoVecinos,
          categoria: categorias.nombre,
          territorio: territorios.nombre,
          organismo: reportes.organismoDerivado,
        })
        .from(reportes)
        .innerJoin(categorias, eq(categorias.id, reportes.categoriaId))
        .innerJoin(territorios, eq(territorios.id, reportes.territorioId))
        .where(eq(reportes.folio, folio))
        .limit(1)
    : [];

  const pasos = r
    ? await db
        .select({ estado: eventosHistorial.estadoNuevo, creadoEn: eventosHistorial.creadoEn })
        .from(eventosHistorial)
        .where(and(eq(eventosHistorial.reporteId, r.id), isNotNull(eventosHistorial.estadoNuevo)))
        .orderBy(asc(eventosHistorial.creadoEn))
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-md space-y-5 px-4 py-8">
      <Marca subtitulo="Consulta pública de reportes" />
      {!r ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <SearchX size={36} className="mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-800">No encontramos el folio {folio}</p>
          <p className="mt-1 text-sm text-slate-500">Revisa que esté bien escrito (ejemplo: PR-2026-00042) o consulta a tu encargado barrial.</p>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="font-mono text-sm font-semibold text-navy-700">{r.folio}</p>
            <h1 className="text-xl font-bold text-slate-800">{r.categoria}</h1>
            <p className="text-sm text-slate-500">{r.territorio}</p>
          </div>
          <div className="flex items-center justify-between">
            <EstadoBadge estado={r.estado} />
            <span className="text-xs text-slate-500">Actualizado {hace(r.actualizadoEn)}</span>
          </div>
          {r.estado === 'derivado' && r.organismo && <p className="rounded-lg bg-purple-50 p-2 text-sm text-purple-800">Derivado a {r.organismo}</p>}
          <p className="text-sm text-slate-600">
            Respaldado por <strong>{r.total}</strong> {r.total === 1 ? 'vecino' : 'vecinos'}.
          </p>
          <ol className="space-y-2 border-t border-slate-100 pt-4">
            {pasos.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                {i === pasos.length - 1 ? <CheckCircle2 size={16} className="text-navy-700" /> : <Circle size={16} className="text-slate-300" />}
                <span className="font-medium text-slate-700">{p.estado ? ESTADO_LABEL[p.estado] : ''}</span>
                <span className="ml-auto text-xs text-slate-400">{formatoFechaHora(p.creadoEn)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-center text-xs text-slate-400">Municipalidad de Peñalolén · Peñalolén Reporta</p>
    </main>
  );
}
