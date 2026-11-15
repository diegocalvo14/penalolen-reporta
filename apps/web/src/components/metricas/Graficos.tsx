/**
 * Gráficos simples en HTML/SVG (sin librerías) para la vista de métricas (RF-9.2).
 * Un solo tono (magnitud) en barras; la identidad de categoría va en el punto de
 * color junto a la etiqueta, nunca solo en el color. Cada barra tiene tooltip
 * nativo y el valor escrito al lado.
 */
const TONO = '#1e3a8a';

export function BarrasHorizontales({
  datos,
  vacio = 'Sin datos para el período.',
}: {
  datos: Array<{ etiqueta: string; valor: number; color?: string; detalle?: string }>;
  vacio?: string;
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  if (datos.every((d) => d.valor === 0)) return <p className="text-sm text-slate-500">{vacio}</p>;
  return (
    <ul className="space-y-2.5" role="list">
      {datos.map((d) => (
        <li key={d.etiqueta} className="grid grid-cols-[minmax(7rem,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="flex items-center gap-2 truncate text-slate-700">
            {d.color && <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />}
            {d.etiqueta}
          </span>
          <span className="h-3 rounded-r bg-slate-100" title={`${d.etiqueta}: ${d.valor}${d.detalle ? ` (${d.detalle})` : ''}`}>
            <span
              className="block h-3 rounded-r"
              style={{ width: `${(d.valor / max) * 100}%`, backgroundColor: TONO, minWidth: d.valor > 0 ? 4 : 0 }}
            />
          </span>
          <span className="w-16 text-right font-semibold tabular-nums text-slate-800">
            {d.valor}
            {d.detalle && <span className="ml-1 text-xs font-normal text-slate-400">{d.detalle}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Columnas por semana (una serie). Eje base recesivo, valores en tooltip y en la columna más alta. */
export function ColumnasSemanales({ datos }: { datos: Array<{ semana: string; total: number }> }) {
  if (datos.length === 0) return <p className="text-sm text-slate-500">Aún no hay reportes en las últimas 12 semanas.</p>;
  const W = 640;
  const H = 180;
  const pad = { izq: 8, der: 8, arr: 18, aba: 28 };
  const max = Math.max(1, ...datos.map((d) => d.total));
  const ancho = (W - pad.izq - pad.der) / datos.length;
  const barra = Math.max(6, Math.min(36, ancho - 6));
  const fmt = (s: string) => {
    const [, m, d] = s.split('-');
    return `${Number(d)}/${Number(m)}`;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Reportes creados por semana">
      <line x1={pad.izq} x2={W - pad.der} y1={H - pad.aba} y2={H - pad.aba} stroke="#cbd5e1" strokeWidth={1} />
      {datos.map((d, i) => {
        const h = ((H - pad.arr - pad.aba) * d.total) / max;
        const x = pad.izq + i * ancho + (ancho - barra) / 2;
        const y = H - pad.aba - h;
        return (
          <g key={d.semana}>
            <title>{`Semana del ${fmt(d.semana)}: ${d.total} ${d.total === 1 ? 'reporte' : 'reportes'}`}</title>
            {/* zona de hover más grande que la barra */}
            <rect x={pad.izq + i * ancho} y={pad.arr} width={ancho} height={H - pad.arr - pad.aba} fill="transparent" />
            <path
              d={`M${x},${H - pad.aba} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + barra - 4} Q${x + barra},${y} ${x + barra},${y + 4} V${H - pad.aba} Z`}
              fill={TONO}
            />
            {(d.total === max || datos.length <= 6) && (
              <text x={x + barra / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="#334155" fontWeight={600}>
                {d.total}
              </text>
            )}
            <text x={x + barra / 2} y={H - 10} textAnchor="middle" fontSize={10} fill="#64748b">
              {fmt(d.semana)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
