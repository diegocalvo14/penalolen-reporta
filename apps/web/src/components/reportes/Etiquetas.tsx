import { AlertTriangle, MapPinOff, Sparkles } from 'lucide-react';
import Badge from '@/components/shared/Badge';
import type { EstadoReporte, Severidad } from '@/db/schema';
import { ESTADO_LABEL } from '@/domain/estados';
import { SEVERIDAD_LABEL } from '@/domain/severidad';

const ESTADO_ESTILO: Record<EstadoReporte, string> = {
  ingresado: 'bg-blue-100 text-blue-700',
  en_revision: 'bg-indigo-100 text-indigo-700',
  en_gestion: 'bg-amber-100 text-amber-800',
  derivado: 'bg-purple-100 text-purple-700',
  resuelto: 'bg-emerald-100 text-emerald-700',
  duplicado: 'bg-slate-200 text-slate-600',
  rechazado: 'bg-red-100 text-red-700',
};

export function EstadoBadge({ estado }: { estado: EstadoReporte }) {
  return <Badge className={ESTADO_ESTILO[estado]}>{ESTADO_LABEL[estado]}</Badge>;
}

const SEVERIDAD_ESTILO: Record<Severidad, string> = {
  critica: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-800',
  baja: 'bg-emerald-100 text-emerald-700',
  sin_deteccion: 'bg-slate-100 text-slate-600',
};

interface AnalisisResumen {
  estado: 'pendiente' | 'listo' | 'error';
  severidad: Severidad | null;
}

/** Severidad sugerida por IA (siempre se rotula como sugerencia, §2). */
export function SeveridadBadge({ analisis, conRotulo = false }: { analisis: AnalisisResumen | null; conRotulo?: boolean }) {
  if (!analisis) return <span className="text-xs text-slate-400">—</span>;
  if (analisis.estado === 'pendiente') {
    return <Badge className="bg-violet-50 text-violet-700">IA analizando…</Badge>;
  }
  if (analisis.estado === 'error' || !analisis.severidad) {
    return <Badge className="bg-slate-100 text-slate-500">IA sin resultado</Badge>;
  }
  return (
    <Badge className={SEVERIDAD_ESTILO[analisis.severidad]}>
      <Sparkles size={11} />
      {conRotulo ? `Severidad sugerida por IA: ${SEVERIDAD_LABEL[analisis.severidad]}` : SEVERIDAD_LABEL[analisis.severidad]}
    </Badge>
  );
}

export function FueraTerritorioBadge() {
  return (
    <Badge className="bg-orange-100 text-orange-800">
      <MapPinOff size={11} /> Fuera de territorio
    </Badge>
  );
}

export function RevisionBadge() {
  return (
    <Badge className="bg-yellow-100 text-yellow-800">
      <AlertTriangle size={11} /> Revisar IA
    </Badge>
  );
}

export function CategoriaPunto({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}
