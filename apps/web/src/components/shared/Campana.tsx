'use client';

/** Campana con contador de notificaciones (RF-7.1). Consulta cada 30 s. */
import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hace } from '@/lib/fechas';

interface Notificacion {
  id: string;
  mensaje: string;
  leida: boolean;
  creadoEn: string;
  reporteId: string | null;
}

export default function Campana({ prefijoReporte }: { prefijoReporte: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/notificaciones', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items);
      setNoLeidas(data.noLeidas);
    } catch {
      // sin conexión: se reintenta en el próximo ciclo
    }
  }, []);

  useEffect(() => {
    const primera = setTimeout(cargar, 0);
    const t = setInterval(cargar, 30_000);
    return () => {
      clearTimeout(primera);
      clearInterval(t);
    };
  }, [cargar]);

  useEffect(() => {
    if (!abierta) return;
    const cerrar = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierta]);

  async function abrir(n: Notificacion) {
    if (!n.leida) {
      await fetch(`/api/notificaciones/${n.id}`, { method: 'PATCH' }).catch(() => undefined);
      void cargar();
    }
    setAbierta(false);
    if (n.reporteId) router.push(`${prefijoReporte}${n.reporteId}`);
  }

  async function leerTodas() {
    await fetch('/api/notificaciones/todas', { method: 'PATCH' }).catch(() => undefined);
    void cargar();
  }

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        onClick={() => {
          setAbierta((a) => !a);
          void cargar();
        }}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label={noLeidas ? `Notificaciones: ${noLeidas} sin leer` : 'Notificaciones'}
      >
        <Bell size={20} />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierta && (
        <div className="absolute right-0 z-[1200] mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-800">Notificaciones</p>
            {noLeidas > 0 && (
              <button type="button" onClick={leerTodas} className="inline-flex items-center gap-1 text-xs text-navy-700">
                <CheckCheck size={14} /> Marcar todas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No tienes notificaciones.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => abrir(n)}
                    className={`flex w-full gap-2 px-4 py-3 text-left hover:bg-slate-50 ${n.leida ? '' : 'bg-navy-50/50'}`}
                  >
                    {!n.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-navy-600" />}
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-700">{n.mensaje}</span>
                      <span className="text-xs text-slate-400">{hace(n.creadoEn)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
