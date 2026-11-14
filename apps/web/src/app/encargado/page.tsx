import { and, count, eq, inArray } from 'drizzle-orm';
import { ChevronRight, ClipboardList, PlusCircle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { reportes } from '@/db/schema';
import { ESTADOS_ABIERTOS } from '@/domain/estados';
import { requerirUsuarioPagina } from '@/server/auth/session';

export const metadata = { title: 'Encargado · Peñalolén Reporta' };

export default async function EncargadoInicio() {
  const usuario = await requerirUsuarioPagina(['encargado'], '/encargado');
  const nombrePila = usuario.nombre.split(' ')[0];

  const [[{ total }], [{ abiertos }]] = await Promise.all([
    db.select({ total: count() }).from(reportes).where(eq(reportes.encargadoId, usuario.id)),
    db
      .select({ abiertos: count() })
      .from(reportes)
      .where(and(eq(reportes.encargadoId, usuario.id), inArray(reportes.estado, [...ESTADOS_ABIERTOS]))),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-500">Hola,</p>
        <h1 className="text-2xl font-bold text-slate-800">{nombrePila}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Encargado/a barrial de <span className="font-medium text-slate-700">{usuario.territorioNombre ?? '—'}</span>
        </p>
      </div>

      {/* RF-3.2: aviso de privacidad visible */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert size={20} className="mt-0.5 shrink-0" />
        <p>
          <strong>No incluyas datos personales de vecinos</strong> (nombres, teléfonos ni rostros) en las fotos ni en
          la descripción.
        </p>
      </div>

      <div className="grid gap-3">
        <Link
          href="/encargado/nuevo"
          className="flex items-center gap-4 rounded-2xl bg-navy-700 p-5 text-white shadow-md active:bg-navy-800"
        >
          <PlusCircle size={32} />
          <span className="flex-1">
            <span className="block text-lg font-semibold">Registrar problema</span>
            <span className="block text-sm text-navy-100">Bache, luminaria, poda, escombros…</span>
          </span>
          <ChevronRight size={20} className="text-navy-200" />
        </Link>
        <Link
          href="/encargado/reportes"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm active:bg-slate-50"
        >
          <ClipboardList size={32} className="text-navy-700" />
          <span className="flex-1">
            <span className="block text-lg font-semibold text-slate-800">Mis reportes</span>
            <span className="block text-sm text-slate-500">
              {total === 0 ? 'Aún no registras reportes' : `${total} registrados · ${abiertos} en curso`}
            </span>
          </span>
          <ChevronRight size={20} className="text-slate-300" />
        </Link>
      </div>
    </div>
  );
}
