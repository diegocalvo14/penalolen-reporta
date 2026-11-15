'use client';

/** Acciones del encargado en el detalle: sumar respaldo (RF-4.3) y copiar texto para vecinos (RF-7.3). */
import { Check, Copy, Loader2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import { CANAL_LABEL, CANALES } from '@/domain/reporte-input';

type Canal = (typeof CANALES)[number];

export default function AccionesEncargado({
  reporteId,
  abierto,
  textoVecinos,
}: {
  reporteId: string;
  abierto: boolean;
  textoVecinos: string;
}) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [formulario, setFormulario] = useState(false);
  const [nVecinos, setNVecinos] = useState(1);
  const [canal, setCanal] = useState<Canal | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoVecinos);
    } catch {
      // Respaldo para navegadores sin portapapeles en http
      const t = document.createElement('textarea');
      t.value = textoVecinos;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  async function sumar() {
    if (!canal) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/${reporteId}/respaldos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nVecinos, canal }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo sumar el respaldo.');
        return;
      }
      setFormulario(false);
      setNVecinos(1);
      setCanal(null);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={copiar}>
          {copiado ? <Check size={16} /> : <Copy size={16} />}
          {copiado ? 'Copiado' : 'Copiar para vecinos'}
        </Button>
        {abierto && (
          <Button variant="outline" onClick={() => setFormulario((f) => !f)}>
            <Users size={16} /> Sumar vecinos
          </Button>
        )}
      </div>
      {formulario && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="block text-sm font-medium text-slate-700">
            Vecinos que se suman
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={nVecinos}
              onChange={(e) => setNVecinos(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="mt-1 block w-24 rounded-lg border border-slate-300 px-3 py-2 text-center text-lg font-bold"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CANALES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCanal(c)}
                className={`rounded-lg border-2 px-2 py-2 text-sm font-semibold ${canal === c ? 'border-navy-600 bg-navy-50 text-navy-800' : 'border-slate-200 text-slate-700'}`}
              >
                {CANAL_LABEL[c]}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button className="w-full" disabled={!canal || enviando} onClick={sumar}>
            {enviando && <Loader2 size={16} className="animate-spin" />} Sumar respaldo
          </Button>
        </div>
      )}
    </div>
  );
}
