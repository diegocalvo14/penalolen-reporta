import { ChevronRight, ClipboardList, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import Badge from '@/components/shared/Badge';
import { CategoriaPunto, EstadoBadge, FueraTerritorioBadge, SeveridadBadge } from '@/components/reportes/Etiquetas';
import { db } from '@/db';
import { hace } from '@/lib/fechas';
import { requerirUsuarioPagina } from '@/server/auth/session';
import { listarMisReportes } from '@/server/reportes/consultas';

export const metadata = { title: 'Mis reportes · Peñalolén Reporta' };

/** "Mis reportes" (RF-3.6): estado, severidad sugerida y acceso al historial. */
export default async function MisReportes() {
  const usuario = await requerirUsuarioPagina(['encargado'], '/encargado/reportes');
  const items = await listarMisReportes(db, usuario.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Mis reportes</h1>
        <Link
          href="/encargado/nuevo"
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} /> Nuevo
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          <ClipboardList size={32} className="mx-auto mb-2 text-slate-300" />
          Todavía no registras reportes.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                href={`/encargado/reportes/${r.id}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CategoriaPunto color={r.categoria.color} />
                    <span className="font-semibold text-slate-800">{r.categoria.nombre}</span>
                    <span className="font-mono text-xs text-slate-400">{r.folio}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <EstadoBadge estado={r.estado} />
                    {r.categoria.usaIa && <SeveridadBadge analisis={r.analisis} />}
                    {r.fueraDeTerritorio && <FueraTerritorioBadge />}
                    {!r.propio && <Badge className="bg-sky-100 text-sky-800">Respaldado</Badge>}
                  </div>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Users size={12} /> {r.totalRespaldoVecinos} {r.totalRespaldoVecinos === 1 ? 'vecino' : 'vecinos'} · {r.territorio.nombre} ·{' '}
                    {hace(r.creadoEn)}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
