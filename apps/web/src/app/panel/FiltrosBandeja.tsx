'use client';

import { RotateCcw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ESTADO_LABEL, ESTADOS } from '@/domain/estados';
import { ORDEN_LABEL, ORDENES } from '@/domain/filtros-bandeja';

interface Props {
  categorias: Array<{ id: number; nombre: string }>;
  territorios: Array<{ id: number; nombre: string }>;
}

const SEVERIDADES: Array<[string, string]> = [
  ['critica', 'Crítica'],
  ['media', 'Media'],
  ['baja', 'Baja'],
  ['sin_deteccion', 'Sin detección'],
  ['sin_analisis', 'Sin análisis IA'],
];

/** Filtros de la bandeja: cada cambio actualiza la URL y el servidor vuelve a consultar. */
export default function FiltrosBandeja({ categorias, territorios }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [cargando, startTransition] = useTransition();

  function cambiar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params.toString());
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    nuevos.delete('pagina'); // al filtrar se vuelve a la primera página
    startTransition(() => router.replace(`${pathname}?${nuevos.toString()}`, { scroll: false }));
  }

  const select =
    'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-navy-500 focus:outline-none';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${cargando ? 'opacity-60' : ''}`}>
      <select aria-label="Estado" className={select} value={params.get('estado') ?? ''} onChange={(e) => cambiar('estado', e.target.value)}>
        <option value="">Todos los estados</option>
        <option value="abiertos">Abiertos</option>
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {ESTADO_LABEL[e]}
          </option>
        ))}
      </select>
      <select aria-label="Categoría" className={select} value={params.get('categoria') ?? ''} onChange={(e) => cambiar('categoria', e.target.value)}>
        <option value="">Todas las categorías</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <select aria-label="Territorio" className={select} value={params.get('territorio') ?? ''} onChange={(e) => cambiar('territorio', e.target.value)}>
        <option value="">Todos los territorios</option>
        {territorios.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
      <select aria-label="Severidad" className={select} value={params.get('severidad') ?? ''} onChange={(e) => cambiar('severidad', e.target.value)}>
        <option value="">Toda severidad</option>
        {SEVERIDADES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={params.get('destacados') === '1'}
          onChange={(e) => cambiar('destacados', e.target.checked ? '1' : '')}
        />
        Solo destacados
      </label>
      <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
      <select aria-label="Ordenar por" className={select} value={params.get('orden') ?? 'recientes'} onChange={(e) => cambiar('orden', e.target.value === 'recientes' ? '' : e.target.value)}>
        {ORDENES.map((o) => (
          <option key={o} value={o}>
            {ORDEN_LABEL[o]}
          </option>
        ))}
      </select>
      {params.toString() && (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-100"
        >
          <RotateCcw size={14} /> Limpiar
        </button>
      )}
    </div>
  );
}
