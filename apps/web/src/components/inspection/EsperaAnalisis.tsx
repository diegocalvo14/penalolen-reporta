'use client';

/** Mientras el análisis está pendiente, refresca la vista cada 2,5 s (hasta 1 minuto). */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function EsperaAnalisis() {
  const router = useRouter();
  useEffect(() => {
    const inicio = Date.now();
    const t = setInterval(() => {
      if (Date.now() - inicio > 60_000) clearInterval(t);
      else router.refresh();
    }, 2500);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
