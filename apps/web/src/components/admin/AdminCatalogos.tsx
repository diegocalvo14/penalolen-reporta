'use client';

import { Plus, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import Button from '@/components/shared/Button';
import { useAccion } from './useAccion';

interface Categoria {
  id: number;
  nombre: string;
  radioDuplicadoM: number;
  usaIa: boolean;
  color: string;
  unidadResponsable: 'DOM' | 'DIDECO';
  activa: boolean;
}

const inp = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';

function FilaCategoria({ c }: { c: Categoria }) {
  const [v, setV] = useState(c);
  const { ejecutar, cargando, error } = useAccion();
  const cambiado = JSON.stringify(v) !== JSON.stringify(c);
  return (
    <tr>
      <td className="px-3 py-2">
        <input aria-label="Nombre" className={`${inp} w-40`} value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>
      <td className="px-3 py-2">
        <input aria-label="Color" type="color" className="h-8 w-10 rounded border border-slate-300" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <input aria-label="Radio de duplicado (m)" type="number" min={1} max={500} className={`${inp} w-20`} value={v.radioDuplicadoM} onChange={(e) => setV({ ...v, radioDuplicadoM: Number(e.target.value) })} />
      </td>
      <td className="px-3 py-2">
        <select aria-label="Unidad" className={inp} value={v.unidadResponsable} onChange={(e) => setV({ ...v, unidadResponsable: e.target.value as 'DOM' | 'DIDECO' })}>
          <option>DOM</option>
          <option>DIDECO</option>
        </select>
      </td>
      <td className="px-3 py-2 text-center">
        <input aria-label="Usa IA" type="checkbox" checked={v.usaIa} onChange={(e) => setV({ ...v, usaIa: e.target.checked })} />
      </td>
      <td className="px-3 py-2 text-center">
        <input aria-label="Activa" type="checkbox" checked={v.activa} onChange={(e) => setV({ ...v, activa: e.target.checked })} />
      </td>
      <td className="px-3 py-2 text-right">
        <Button
          size="sm"
          disabled={!cambiado || cargando}
          onClick={() =>
            ejecutar(`/api/admin/categorias/${c.id}`, 'PATCH', {
              nombre: v.nombre,
              color: v.color,
              radioDuplicadoM: v.radioDuplicadoM,
              unidadResponsable: v.unidadResponsable,
              usaIa: v.usaIa,
              activa: v.activa,
            })
          }
        >
          <Save size={14} />
        </Button>
      </td>
    </tr>
  );
}

export function AdminCategorias({ categorias }: { categorias: Categoria[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Color</th>
            <th className="px-3 py-2">Radio dup. (m)</th>
            <th className="px-3 py-2">Unidad</th>
            <th className="px-3 py-2 text-center">IA</th>
            <th className="px-3 py-2 text-center">Activa</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {categorias.map((c) => (
            <FilaCategoria key={`${c.id}-${c.nombre}-${c.radioDuplicadoM}-${c.color}-${c.usaIa}-${c.activa}-${c.unidadResponsable}`} c={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Territorio {
  id: number;
  nombre: string;
  lat: number | null;
  lng: number | null;
}

function FilaTerritorio({ t }: { t: Territorio }) {
  const [v, setV] = useState({ nombre: t.nombre, lat: String(t.lat ?? ''), lng: String(t.lng ?? '') });
  const { ejecutar, cargando, error } = useAccion();
  const cambiado = v.nombre !== t.nombre || v.lat !== String(t.lat ?? '') || v.lng !== String(t.lng ?? '');
  return (
    <tr>
      <td className="px-3 py-2">
        <input aria-label="Nombre" className={`${inp} w-44`} value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>
      <td className="px-3 py-2">
        <input aria-label="Latitud" className={`${inp} w-28 font-mono`} value={v.lat} onChange={(e) => setV({ ...v, lat: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <input aria-label="Longitud" className={`${inp} w-28 font-mono`} value={v.lng} onChange={(e) => setV({ ...v, lng: e.target.value })} />
      </td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" disabled={!cambiado || cargando} onClick={() => ejecutar(`/api/admin/territorios/${t.id}`, 'PATCH', v)}>
          <Save size={14} />
        </Button>
      </td>
    </tr>
  );
}

export function AdminTerritorios({ territorios }: { territorios: Territorio[] }) {
  const [nuevo, setNuevo] = useState({ nombre: '', lat: '', lng: '' });
  const { ejecutar, cargando, error } = useAccion();
  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Latitud</th>
            <th className="px-3 py-2">Longitud</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {territorios.map((t) => (
            <FilaTerritorio key={`${t.id}-${t.nombre}-${t.lat}-${t.lng}`} t={t} />
          ))}
          <tr>
            <td className="px-3 py-2">
              <input placeholder="Nuevo territorio" className={`${inp} w-44`} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
              {error && <p className="text-xs text-red-600">{error}</p>}
            </td>
            <td className="px-3 py-2">
              <input placeholder="-33.48" className={`${inp} w-28 font-mono`} value={nuevo.lat} onChange={(e) => setNuevo({ ...nuevo, lat: e.target.value })} />
            </td>
            <td className="px-3 py-2">
              <input placeholder="-70.56" className={`${inp} w-28 font-mono`} value={nuevo.lng} onChange={(e) => setNuevo({ ...nuevo, lng: e.target.value })} />
            </td>
            <td className="px-3 py-2 text-right">
              <Button
                size="sm"
                variant="outline"
                disabled={cargando || !nuevo.nombre || !nuevo.lat || !nuevo.lng}
                onClick={async () => {
                  if (await ejecutar('/api/admin/territorios', 'POST', nuevo)) setNuevo({ nombre: '', lat: '', lng: '' });
                }}
              >
                <Plus size={14} />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-slate-500">El centroide se usa para la ubicación aproximada y para decidir el territorio de cada reporte.</p>
    </div>
  );
}

export function AdminConfiguracion({
  config,
}: {
  config: { umbralMedia: number; umbralCritica: number; umbralAlertaRespaldos: number; visionTimeoutMs: number };
}) {
  const [v, setV] = useState({ ...config, visionTimeoutS: config.visionTimeoutMs / 1000 });
  const { ejecutar, cargando, error } = useAccion();
  const [ok, setOk] = useState(false);
  const campo = (k: 'umbralMedia' | 'umbralCritica' | 'umbralAlertaRespaldos' | 'visionTimeoutS', etiqueta: string, sufijo: string) => (
    <label className="block text-sm text-slate-700">
      {etiqueta}
      <span className="mt-1 flex items-center gap-1.5">
        <input type="number" className={`${inp} w-24`} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
        <span className="text-slate-500">{sufijo}</span>
      </span>
    </label>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-4">
        {campo('umbralMedia', 'Media desde', '% de cobertura')}
        {campo('umbralCritica', 'Crítica sobre', '% de cobertura')}
        {campo('umbralAlertaRespaldos', 'Alerta con', 'vecinos o más')}
        {campo('visionTimeoutS', 'Tiempo máx. visión', 'segundos')}
      </div>
      <p className="text-xs text-slate-500">
        Severidad sugerida: Baja &lt; {v.umbralMedia} % · Media {v.umbralMedia}–{v.umbralCritica} % · Crítica &gt; {v.umbralCritica} %. Se aplica a los próximos análisis y reanálisis.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {ok && !error && <p className="text-sm text-emerald-700">Configuración guardada.</p>}
      <Button
        size="sm"
        disabled={cargando}
        onClick={async () => {
          setOk(false);
          const r = await ejecutar('/api/admin/configuracion', 'PATCH', {
            umbralMedia: v.umbralMedia,
            umbralCritica: v.umbralCritica,
            umbralAlertaRespaldos: v.umbralAlertaRespaldos,
            visionTimeoutMs: Math.round(v.visionTimeoutS * 1000),
          });
          if (r) setOk(true);
        }}
      >
        <Save size={14} /> Guardar
      </Button>
    </div>
  );
}

export function SelectorMotor() {
  const [estado, setEstado] = useState<{ engine: string; available_engines: string[] } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch('/api/admin/vision')
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!vivo) return;
        if (r.ok) setEstado(d);
        else setMensaje(d?.error?.message ?? 'El servicio de visión no responde.');
      })
      .catch(() => vivo && setMensaje('El servicio de visión no responde.'));
    return () => {
      vivo = false;
    };
  }, []);

  async function cambiar(engine: string) {
    setCargando(true);
    setMensaje(null);
    try {
      const r = await fetch('/api/admin/vision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ engine }) });
      const d = await r.json().catch(() => null);
      if (r.ok) setEstado((e) => (e ? { ...e, engine: d.engine } : e));
      else setMensaje(d?.error?.message ?? 'No se pudo cambiar el motor.');
    } finally {
      setCargando(false);
    }
  }

  const etiquetas: Record<string, string> = { ensemble: 'Ensemble (ambos modelos)', local: 'Modelo propio (YOLOv8s-OBB)', pretrained: 'Preentrenado' };
  return (
    <div className="space-y-2 text-sm">
      {estado ? (
        <div className="flex flex-wrap gap-2">
          {['ensemble', 'local', 'pretrained'].map((m) => (
            <button
              key={m}
              type="button"
              disabled={cargando || (m !== 'ensemble' && !estado.available_engines.includes(m))}
              onClick={() => cambiar(m)}
              className={`rounded-lg border-2 px-3 py-2 disabled:opacity-40 ${estado.engine === m ? 'border-navy-600 bg-navy-50 font-semibold text-navy-800' : 'border-slate-200'}`}
            >
              {etiquetas[m]}
            </button>
          ))}
        </div>
      ) : (
        !mensaje && <p className="text-slate-500">Consultando el servicio de visión…</p>
      )}
      {mensaje && <p className="text-amber-700">{mensaje}</p>}
      <p className="text-xs text-slate-500">Para reanalizar un bache con el motor elegido, usa &quot;Reanalizar&quot; en su detalle.</p>
    </div>
  );
}
