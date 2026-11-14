'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/shared/Button';

/** Reintentar / reanalizar la foto con el servicio de visión (RF-5.1 y RF-5.4). */
export default function BotonReanalizar({ reporteId, texto = 'Reintentar análisis' }: { reporteId: string; texto?: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function reanalizar() {
    setCargando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/reportes/${reporteId}/analisis/reintentar`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) setMensaje(data?.error?.message ?? 'No se pudo reanalizar.');
      else if (data?.estado === 'error') setMensaje(data.error);
      router.refresh();
    } catch {
      setMensaje('No hay conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button size="sm" variant="secondary" onClick={reanalizar} disabled={cargando}>
        {cargando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {cargando ? 'Analizando…' : texto}
      </Button>
      {mensaje && <p className="text-xs text-red-700">{mensaje}</p>}
    </div>
  );
}
