import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import AccionesEncargado from '@/components/reportes/AccionesEncargado';
import DetalleReporte from '@/components/reportes/DetalleReporte';
import { db } from '@/db';
import { requerirUsuarioPagina } from '@/server/auth/session';
import { detalleVisible } from '@/server/reportes/acceso';
import { esAbierto, ESTADO_LABEL } from '@/domain/estados';
import { textoParaVecinos } from '@/domain/notificaciones';
import { ahoraMs, hace } from '@/lib/fechas';

export const metadata = { title: 'Reporte · Peñalolén Reporta' };

export default async function ReporteEncargado({ params }: PageProps<'/encargado/reportes/[id]'>) {
  const { id } = await params;
  const usuario = await requerirUsuarioPagina(['encargado'], `/encargado/reportes/${id}`);
  const detalle = await detalleVisible(db, usuario, id);
  if (!detalle) notFound();

  // Enlace a la consulta pública por folio (RF-10.1) con la dirección por la que entró el encargado
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const texto = textoParaVecinos({
    folio: detalle.folio,
    categoria: detalle.categoria.nombre,
    territorio: detalle.territorio.nombre,
    estadoLabel: ESTADO_LABEL[detalle.estado],
    actualizado: hace(detalle.actualizadoEn),
    totalVecinos: detalle.totalRespaldoVecinos,
    urlConsulta: host ? `${proto}://${host}/consulta/${detalle.folio}` : null,
  });

  return (
    <div className="space-y-4">
      <Link href="/encargado/reportes" className="inline-flex items-center gap-1 text-sm text-slate-600">
        <ChevronLeft size={16} /> Mis reportes
      </Link>
      <DetalleReporte r={detalle} vista="encargado" ahora={ahoraMs()} />
      <AccionesEncargado reporteId={detalle.id} abierto={esAbierto(detalle.estado)} textoVecinos={texto} />
    </div>
  );
}
