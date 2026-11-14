'use client';

/**
 * Acciones del funcionario sobre un reporte (RF-6.3): avanzar estado, derivar,
 * marcar duplicado o rechazado, cerrar con evidencia y comentar. Solo muestra
 * las transiciones permitidas desde el estado actual (§6); el servidor valida igual.
 */
import { ArrowRight, Camera, CheckCircle2, Copy, Loader2, MessageSquare, Send, X, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import { Card, CardContent, CardHeader } from '@/components/shared/Card';
import type { EstadoReporte } from '@/db/schema';
import { ESTADO_LABEL, TRANSICIONES } from '@/domain/estados';
import { ORGANISMOS_SUGERIDOS } from '@/domain/reporte-input';

type Accion = EstadoReporte | 'comentario';

const ESTILO: Partial<Record<EstadoReporte, { icono: typeof ArrowRight; variante: 'primary' | 'secondary' | 'destructive' | 'outline'; texto: string }>> = {
  en_revision: { icono: ArrowRight, variante: 'primary', texto: 'Pasar a revisión' },
  en_gestion: { icono: ArrowRight, variante: 'primary', texto: 'Pasar a gestión' },
  derivado: { icono: Send, variante: 'outline', texto: 'Derivar' },
  resuelto: { icono: CheckCircle2, variante: 'primary', texto: 'Cerrar como resuelto' },
  duplicado: { icono: Copy, variante: 'secondary', texto: 'Marcar duplicado' },
  rechazado: { icono: XCircle, variante: 'destructive', texto: 'Rechazar' },
};

export default function AccionesFuncionario({ reporteId, estado }: { reporteId: string; estado: EstadoReporte }) {
  const router = useRouter();
  const [accion, setAccion] = useState<Accion | null>(null);
  const [comentario, setComentario] = useState('');
  const [organismo, setOrganismo] = useState<string>(ORGANISMOS_SUGERIDOS[0]);
  const [organismoOtro, setOrganismoOtro] = useState('');
  const [folioOriginal, setFolioOriginal] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transiciones = TRANSICIONES[estado];

  function elegir(a: Accion) {
    setAccion(a);
    setError(null);
    setComentario('');
    setFoto(null);
  }

  async function confirmar() {
    if (!accion) return;
    setEnviando(true);
    setError(null);
    try {
      let res: Response;
      if (accion === 'comentario') {
        res = await fetch(`/api/reportes/${reporteId}/comentarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comentario }),
        });
      } else {
        const campos: Record<string, string> = { estado: accion };
        if (accion === 'rechazado') campos.motivo = comentario;
        else if (comentario) campos.comentario = comentario;
        if (accion === 'derivado') campos.organismo = organismo === 'Otro' ? organismoOtro : organismo;
        if (accion === 'duplicado') campos.duplicadoDe = folioOriginal;

        if (accion === 'resuelto' && foto) {
          const form = new FormData();
          for (const [k, v] of Object.entries(campos)) form.append(k, v);
          form.append('foto', foto);
          res = await fetch(`/api/reportes/${reporteId}/estado`, { method: 'PATCH', body: form });
        } else {
          res = await fetch(`/api/reportes/${reporteId}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(campos),
          });
        }
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo completar la acción.');
        return;
      }
      setAccion(null);
      router.refresh();
    } catch {
      setError('No hay conexión con el servidor.');
    } finally {
      setEnviando(false);
    }
  }

  const necesitaTexto = accion === 'resuelto' || accion === 'rechazado' || accion === 'comentario';
  const listo =
    !enviando &&
    (!necesitaTexto || comentario.trim().length > 0) &&
    (accion !== 'derivado' || (organismo !== 'Otro' ? true : organismoOtro.trim().length > 0)) &&
    (accion !== 'duplicado' || folioOriginal.trim().length > 0);

  const etiquetaTexto =
    accion === 'resuelto'
      ? 'Comentario de cierre (obligatorio)'
      : accion === 'rechazado'
        ? 'Motivo del rechazo (obligatorio)'
        : accion === 'comentario'
          ? 'Comentario (lo verá el encargado)'
          : 'Comentario (opcional)';

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-800">Acciones</h2>
        <p className="text-xs text-slate-500">Estado actual: {ESTADO_LABEL[estado]}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {transiciones.map((t) => {
            const e = ESTILO[t]!;
            const Icono = e.icono;
            return (
              <Button key={t} size="sm" variant={accion === t ? 'primary' : e.variante} onClick={() => elegir(t)}>
                <Icono size={14} /> {e.texto}
              </Button>
            );
          })}
          <Button size="sm" variant="ghost" onClick={() => elegir('comentario')}>
            <MessageSquare size={14} /> Comentar
          </Button>
        </div>
        {transiciones.length === 0 && (
          <p className="text-sm text-slate-500">El reporte está cerrado; solo se pueden agregar comentarios.</p>
        )}

        {accion && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">
                {accion === 'comentario' ? 'Nuevo comentario' : ESTILO[accion as EstadoReporte]?.texto}
              </p>
              <button type="button" onClick={() => setAccion(null)} className="text-slate-400 hover:text-slate-600" aria-label="Cancelar">
                <X size={16} />
              </button>
            </div>

            {accion === 'derivado' && (
              <div className="space-y-2">
                <label className="block text-sm text-slate-700">
                  Organismo
                  <select
                    value={organismo}
                    onChange={(e) => setOrganismo(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {ORGANISMOS_SUGERIDOS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                    <option value="Otro">Otro…</option>
                  </select>
                </label>
                {organismo === 'Otro' && (
                  <input
                    value={organismoOtro}
                    onChange={(e) => setOrganismoOtro(e.target.value)}
                    placeholder="Nombre del organismo"
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </div>
            )}

            {accion === 'duplicado' && (
              <label className="block text-sm text-slate-700">
                Folio del reporte original
                <input
                  value={folioOriginal}
                  onChange={(e) => setFolioOriginal(e.target.value.toUpperCase())}
                  placeholder="PR-2026-00001"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
                <span className="text-xs text-slate-500">Los respaldos vecinales de este reporte pasarán al original.</span>
              </label>
            )}

            <label className="block text-sm text-slate-700">
              {etiquetaTexto}
              <textarea
                rows={2}
                maxLength={1000}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            {accion === 'resuelto' && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Camera size={16} className="text-slate-500" />
                <span>{foto ? foto.name : 'Foto de evidencia (opcional)'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                />
              </label>
            )}

            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button size="sm" disabled={!listo} onClick={confirmar}>
              {enviando && <Loader2 size={14} className="animate-spin" />} Confirmar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
