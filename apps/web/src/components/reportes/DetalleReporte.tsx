import { Calendar, Crosshair, ImageOff, MapPin, User, Users } from 'lucide-react';
import BoundingBoxOverlay from '@/components/inspection/BoundingBoxOverlay';
import PanelAnalisis from '@/components/inspection/PanelAnalisis';
import Mapa from '@/components/mapa/Mapa';
import { Card, CardContent, CardHeader } from '@/components/shared/Card';
import { CANAL_LABEL, ORIGEN_LABEL } from '@/domain/reporte-input';
import { formatoFechaHora, hace } from '@/lib/fechas';
import type { ReporteDetalle } from '@/server/reportes/consultas';
import { EstadoBadge, FueraTerritorioBadge, RevisionBadge, SeveridadBadge } from './Etiquetas';
import Historial from './Historial';
import IconoCategoria from './IconoCategoria';

/**
 * Detalle de un reporte, compartido por la app del encargado y el panel municipal.
 * Las acciones del funcionario (cambiar estado, derivar, cerrar) se agregan en el Hito 3.
 */
export default function DetalleReporte({
  r,
  vista,
  puedeReanalizar = false,
  ahora,
}: {
  r: ReporteDetalle;
  vista: 'encargado' | 'panel';
  puedeReanalizar?: boolean;
  /** Hora del servidor al renderizar (para detectar análisis sin respuesta) */
  ahora: number;
}) {
  const fotos = r.imagenes.filter((i) => i.tipo === 'original');
  const cierre = r.imagenes.filter((i) => i.tipo === 'cierre');

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${r.categoria.color}1a`, color: r.categoria.color }}
        >
          <IconoCategoria slug={r.categoria.slug} size={22} />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-navy-700">{r.folio}</p>
          <h1 className="text-xl font-bold text-slate-800">{r.categoria.nombre}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <EstadoBadge estado={r.estado} />
            {r.categoria.usaIa && <SeveridadBadge analisis={r.analisis} conRotulo />}
            {r.fueraDeTerritorio && <FueraTerritorioBadge />}
            {r.analisis?.requiereRevision && <RevisionBadge />}
          </div>
        </div>
      </div>

      <div className={vista === 'panel' ? 'grid gap-5 lg:grid-cols-2' : 'space-y-5'}>
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-line text-slate-700">{r.descripcion}</p>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <MapPin size={15} className="text-slate-400" />
                  {r.territorio.nombre}
                  {r.direccionReferencia ? ` · ${r.direccionReferencia}` : ''}
                </li>
                <li className="flex items-center gap-2">
                  <Crosshair size={15} className="text-slate-400" />
                  {ORIGEN_LABEL[r.origenUbicacion]}
                  {r.precisionM ? ` (±${Math.round(r.precisionM)} m)` : ''}
                </li>
                <li className="flex items-center gap-2">
                  <Calendar size={15} className="text-slate-400" />
                  {formatoFechaHora(r.creadoEn)} ({hace(r.creadoEn)})
                </li>
                {vista === 'panel' && (
                  <li className="flex items-center gap-2">
                    <User size={15} className="text-slate-400" />
                    Encargado/a: {r.encargado.nombre}
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Users size={15} className="text-slate-400" />
                  <strong className="text-slate-800">{r.totalRespaldoVecinos}</strong>{' '}
                  {r.totalRespaldoVecinos === 1 ? 'vecino lo respalda' : 'vecinos lo respaldan'}
                </li>
              </ul>
              {r.organismoDerivado && (
                <p className="rounded-lg bg-purple-50 p-2 text-sm text-purple-800">Derivado a {r.organismoDerivado}</p>
              )}
              {r.motivoRechazo && (
                <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Rechazado: {r.motivoRechazo}</p>
              )}
            </CardContent>
          </Card>

          <Mapa centro={r.ubicacion} punto={r.ubicacion} color={r.categoria.color} precisionM={r.precisionM} alto={220} />
        </div>

        <div className="space-y-5">
          {fotos.length > 0 ? (
            fotos.map((f) =>
              r.analisis?.estado === 'listo' && r.analisis.imagenId === f.id ? (
                <BoundingBoxOverlay
                  key={f.id}
                  imageUrl={`/api/imagenes/${f.id}`}
                  boundingBoxes={r.analisis.boundingBoxes}
                  alt={`Foto del reporte ${r.folio} con las detecciones de la IA`}
                />
              ) : (
                <div key={f.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element -- la foto pasa por /api/imagenes con control de acceso */}
                  <img src={`/api/imagenes/${f.id}`} alt={`Foto del reporte ${r.folio}`} className="max-h-96 w-full object-contain" />
                </div>
              ),
            )
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              <ImageOff size={18} /> Sin foto
            </div>
          )}
          {r.categoria.usaIa && (
            <PanelAnalisis analisis={r.analisis} reporteId={r.id} puedeReanalizar={puedeReanalizar} ahora={ahora} />
          )}
          {cierre.map((f) => (
            <div key={f.id}>
              <p className="mb-1 text-xs font-medium uppercase text-emerald-700">Evidencia de cierre</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
              <img src={`/api/imagenes/${f.id}`} alt="Foto de cierre" className="max-h-72 w-full rounded-xl object-contain" />
            </div>
          ))}

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">Respaldo vecinal</h2>
            </CardHeader>
            <ul className="divide-y divide-slate-100 text-sm">
              {r.respaldos.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-2.5">
                  <span>
                    <strong>{s.nVecinos}</strong> {s.nVecinos === 1 ? 'vecino' : 'vecinos'} · {CANAL_LABEL[s.canal]}
                    {vista === 'panel' && <span className="text-slate-400"> · {s.encargado}</span>}
                  </span>
                  <span className="text-xs text-slate-400">{formatoFechaHora(s.creadoEn)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">Historial</h2>
            </CardHeader>
            <CardContent>
              <Historial eventos={r.eventos} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
