import { Bot, ChevronLeft } from 'lucide-react';
import { ahoraMs } from '@/lib/fechas';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DetalleReporte from '@/components/reportes/DetalleReporte';
import AccionesFuncionario from '@/components/reportes/AccionesFuncionario';
import { db } from '@/db';
import { requerirUsuarioPagina } from '@/server/auth/session';
import { detalleVisible } from '@/server/reportes/acceso';

export const metadata = { title: 'Detalle del reporte · Peñalolén Reporta' };

export default async function ReportePanel({ params }: PageProps<'/panel/reportes/[id]'>) {
  const { id } = await params;
  const usuario = await requerirUsuarioPagina(['funcionario', 'admin'], `/panel/reportes/${id}`);
  const detalle = await detalleVisible(db, usuario, id);
  if (!detalle) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/panel" className="inline-flex items-center gap-1 text-sm text-slate-600">
          <ChevronLeft size={16} /> Bandeja
        </Link>
        {/* RF-6.5: abre el copiloto con el contexto del reporte */}
        <Link
          href={`/copiloto?reporte=${detalle.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-navy-50 px-3 py-1.5 text-sm font-medium text-navy-800 hover:bg-navy-100"
        >
          <Bot size={15} /> Consultar al copiloto
        </Link>
      </div>
      <AccionesFuncionario reporteId={detalle.id} estado={detalle.estado} />
      <DetalleReporte r={detalle} vista="panel" puedeReanalizar ahora={ahoraMs()} />
    </div>
  );
}
