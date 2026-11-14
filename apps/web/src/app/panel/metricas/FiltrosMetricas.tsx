'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export default function FiltrosMetricas({
  territorios,
  categorias,
}: {
  territorios: Array<{ id: number; nombre: string }>;
  categorias: Array<{ id: number; nombre: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [cargando, start] = useTransition();
  const cambiar = (k: string, v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    start(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  const sel = 'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700';
  return (
    <div className={`flex flex-wrap gap-2 ${cargando ? 'opacity-60' : ''}`}>
      <select aria-label="Período" className={sel} value={params.get('periodo') ?? ''} onChange={(e) => cambiar('periodo', e.target.value)}>
        <option value="">Todo el período</option>
        <option value="mes">Este mes</option>
        <option value="30d">Últimos 30 días</option>
        <option value="90d">Últimos 90 días</option>
      </select>
      <select aria-label="Territorio" className={sel} value={params.get('territorio') ?? ''} onChange={(e) => cambiar('territorio', e.target.value)}>
        <option value="">Todos los territorios</option>
        {territorios.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
      <select aria-label="Categoría" className={sel} value={params.get('categoria') ?? ''} onChange={(e) => cambiar('categoria', e.target.value)}>
        <option value="">Todas las categorías</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <select aria-label="Unidad" className={sel} value={params.get('unidad') ?? ''} onChange={(e) => cambiar('unidad', e.target.value)}>
        <option value="">DOM y DIDECO</option>
        <option value="DOM">DOM</option>
        <option value="DIDECO">DIDECO</option>
      </select>
    </div>
  );
}
