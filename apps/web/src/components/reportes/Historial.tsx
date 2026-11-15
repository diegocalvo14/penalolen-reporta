import { ArrowRightLeft, CheckCircle2, MessageSquare, PlusCircle, Send, Sparkles, Users } from 'lucide-react';
import { ESTADO_LABEL } from '@/domain/estados';
import { formatoFechaHora } from '@/lib/fechas';
import type { ReporteDetalle } from '@/server/reportes/consultas';

const ICONO = {
  creado: PlusCircle,
  respaldo: Users,
  estado: ArrowRightLeft,
  derivado: Send,
  comentario: MessageSquare,
  cierre: CheckCircle2,
  analisis: Sparkles,
} as const;

function texto(e: ReporteDetalle['eventos'][number]): string {
  switch (e.tipo) {
    case 'creado':
      return 'Reporte registrado';
    case 'respaldo':
      return 'Se sumó respaldo vecinal';
    case 'estado':
      return e.estadoNuevo
        ? `Estado: ${e.estadoAnterior ? `${ESTADO_LABEL[e.estadoAnterior]} → ` : ''}${ESTADO_LABEL[e.estadoNuevo]}`
        : 'Cambio de estado';
    case 'derivado':
      return `Derivado a ${e.organismoDerivado ?? 'otro organismo'}`;
    case 'comentario':
      return 'Comentario';
    case 'cierre':
      return 'Reporte resuelto';
    case 'analisis':
      return 'Análisis de IA';
  }
}

/** Historial completo del reporte (RF-3.6 y RF-6.3), desde EventoHistorial. */
export default function Historial({ eventos }: { eventos: ReporteDetalle['eventos'] }) {
  if (eventos.length === 0) return <p className="text-sm text-slate-500">Sin movimientos.</p>;
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {eventos.map((e) => {
        const Icono = ICONO[e.tipo];
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-navy-700">
              <Icono size={13} />
            </span>
            <p className="text-sm font-medium text-slate-800">{texto(e)}</p>
            {e.comentario && <p className="mt-0.5 text-sm text-slate-600">{e.comentario}</p>}
            <p className="text-xs text-slate-400">
              {formatoFechaHora(e.creadoEn)}
              {e.usuario ? ` · ${e.usuario}` : ' · Sistema'}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
