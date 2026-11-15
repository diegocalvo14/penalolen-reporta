import { Hammer } from 'lucide-react';

/** Marcador de una función planificada para un hito siguiente. */
export default function Proximamente({ hito, texto }: { hito: number; texto: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-500">
      <Hammer size={18} className="mt-0.5 shrink-0 text-slate-400" />
      <p>
        <span className="font-semibold text-slate-600">Hito {hito}:</span> {texto}
      </p>
    </div>
  );
}
