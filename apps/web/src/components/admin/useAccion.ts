'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Llama a un endpoint JSON del admin, muestra el error uniforme y refresca la vista. */
export function useAccion() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar<T = unknown>(url: string, metodo: 'POST' | 'PATCH', cuerpo: unknown): Promise<T | null> {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo guardar.');
        return null;
      }
      router.refresh();
      return data as T;
    } catch {
      setError('No hay conexión con el servidor.');
      return null;
    } finally {
      setCargando(false);
    }
  }
  return { ejecutar, cargando, error, setError };
}
