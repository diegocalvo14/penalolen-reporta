import { MapPinned } from 'lucide-react';

/** Logotipo textual de la plataforma. */
export default function Marca({ subtitulo }: { subtitulo?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-700 text-white">
        <MapPinned size={20} />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-navy-900">Peñalolén Reporta</p>
        {subtitulo && <p className="text-[11px] text-slate-500">{subtitulo}</p>}
      </div>
    </div>
  );
}
