/**
 * Resultado del análisis de visión (RF-5.2 y 5.3). Basado en InspectionBadge de
 * Soluciones Barriales. Siempre rotulado como "sugerida por IA" (§2).
 */
import { AlertTriangle, Gauge, HelpCircle, Loader2, ScanEye, Sparkles, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/shared/Card';
import { SeveridadBadge } from '@/components/reportes/Etiquetas';
import type { ReporteDetalle } from '@/server/reportes/consultas';
import BotonReanalizar from './BotonReanalizar';
import EsperaAnalisis from './EsperaAnalisis';

const ATASCADO_MS = 90_000;

export default function PanelAnalisis({
  analisis,
  reporteId,
  puedeReanalizar,
  ahora,
}: {
  analisis: ReporteDetalle['analisis'];
  reporteId: string;
  puedeReanalizar: boolean;
  ahora: number;
}) {
  if (!analisis) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 text-sm text-slate-500">
          <span>Sin análisis de IA.</span>
          {puedeReanalizar && <BotonReanalizar reporteId={reporteId} texto="Analizar foto" />}
        </CardContent>
      </Card>
    );
  }

  if (analisis.estado === 'pendiente') {
    const atascado = ahora - new Date(analisis.creadoEn).getTime() > ATASCADO_MS;
    return (
      <Card>
        <CardContent className="space-y-2 text-sm">
          {!atascado && <EsperaAnalisis />}
          <p className="flex items-center gap-2 font-medium text-violet-700">
            {atascado ? <AlertTriangle size={16} /> : <Loader2 size={16} className="animate-spin" />}
            {atascado ? 'El servicio de visión no respondió.' : 'La IA está analizando la foto…'}
          </p>
          {atascado && puedeReanalizar && <BotonReanalizar reporteId={reporteId} />}
        </CardContent>
      </Card>
    );
  }

  if (analisis.estado === 'error') {
    return (
      <Card>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-medium text-slate-700">
            <AlertTriangle size={16} className="text-amber-600" /> No se pudo analizar la foto
          </p>
          <p className="text-xs text-slate-500">{analisis.error}</p>
          <p className="text-xs text-slate-500">El reporte quedó registrado igual; la IA es solo una ayuda.</p>
          {puedeReanalizar && <BotonReanalizar reporteId={reporteId} />}
        </CardContent>
      </Card>
    );
  }

  const n = analisis.boundingBoxes.length;
  const confianza = n ? Math.round((analisis.boundingBoxes.reduce((s, b) => s + b.confidence, 0) / n) * 100) : null;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ScanEye size={17} className="text-navy-700" /> Análisis de la foto
          </p>
          <SeveridadBadge analisis={{ estado: 'listo', severidad: analisis.severidad }} conRotulo />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metrica icono={<Target size={14} />} etiqueta="Detecciones" valor={n === 1 ? '1 bache' : `${n} baches`} />
          <Metrica icono={<Gauge size={14} />} etiqueta="Confianza" valor={confianza === null ? '—' : `${confianza}%`} />
          <Metrica icono={<Sparkles size={14} />} etiqueta="Cobertura" valor={`${analisis.ratioCobertura ?? 0}%`} />
        </div>
        {analisis.requiereRevision && (
          <p className="flex items-start gap-2 rounded-lg bg-yellow-50 p-2.5 text-xs text-yellow-800">
            <HelpCircle size={14} className="mt-0.5 shrink-0" />
            {analisis.severidad === 'sin_deteccion'
              ? 'No se detectó un bache claro en la foto. Puede deberse a la luz o al ángulo: conviene revisarlo en terreno.'
              : 'La IA tiene baja confianza en esta detección: revisa la foto antes de priorizar.'}
          </p>
        )}
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Sugerencia automática{analisis.engine ? ` · motor ${analisis.engine}` : ''}. La decisión es del funcionario.
          </span>
          {puedeReanalizar && <BotonReanalizar reporteId={reporteId} texto="Reanalizar" />}
        </div>
      </CardContent>
    </Card>
  );
}

function Metrica({ icono, etiqueta, valor }: { icono: React.ReactNode; etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
        {icono} {etiqueta}
      </p>
      <p className="text-sm font-bold text-slate-800">{valor}</p>
    </div>
  );
}
