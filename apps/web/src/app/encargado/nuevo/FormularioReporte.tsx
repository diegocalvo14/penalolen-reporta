'use client';

/**
 * Registro de un problema en 3 pasos (RF-3.1 a 3.4), pensado para hacerse en
 * menos de 60 segundos desde el celular:
 *   1. ¿Qué problema es?   2. Foto y ubicación   3. Detalles y envío
 */
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Crosshair,
  ImagePlus,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Mapa from '@/components/mapa/Mapa';
import IconoCategoria from '@/components/reportes/IconoCategoria';
import Button from '@/components/shared/Button';
import {
  CANAL_LABEL,
  CANALES,
  DESCRIPCION_MAX,
  DIRECCION_MAX,
  FOTO_MAX_BYTES,
  FOTO_TIPOS,
  NuevoReporteSchema,
} from '@/domain/reporte-input';

interface CategoriaOpcion {
  id: number;
  nombre: string;
  slug: string;
  usaIa: boolean;
  color: string;
}

interface Props {
  categorias: CategoriaOpcion[];
  territorio: { nombre: string; centro: { lat: number; lng: number }; tieneCentroide: boolean };
}

type Origen = 'gps' | 'mapa' | 'centroide';
type Canal = (typeof CANALES)[number];
type EstadoGps = 'inactivo' | 'buscando' | 'ok' | 'error' | 'no_disponible';

interface Resultado {
  id: string;
  folio: string;
  fueraDeTerritorio: boolean;
  analisis: { estado: string } | null;
}

interface Cercano {
  id: string;
  folio: string;
  distanciaM: number;
  totalRespaldoVecinos: number;
  descripcion: string;
  territorio: string;
  imagenId: string | null;
}

export default function FormularioReporte({ categorias, territorio }: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [categoria, setCategoria] = useState<CategoriaOpcion | null>(null);

  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(null);
  const [origen, setOrigen] = useState<Origen | null>(null);
  const [precision, setPrecision] = useState<number | null>(null);
  const [gps, setGps] = useState<EstadoGps>('inactivo');
  const [mensajeGps, setMensajeGps] = useState<string | null>(null);

  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [nVecinos, setNVecinos] = useState(1);
  const [canal, setCanal] = useState<Canal | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // RF-4.1/4.2: reportes cercanos antes de crear uno nuevo
  const [verificando, setVerificando] = useState(false);
  const [cercanos, setCercanos] = useState<Cercano[] | null>(null);
  const [respaldando, setRespaldando] = useState<Cercano | null>(null);
  const [nota, setNota] = useState('');
  const [respaldoListo, setRespaldoListo] = useState<{ reporteId: string; folio: string; total: number } | null>(null);

  // Libera la vista previa de la foto
  useEffect(() => () => void (fotoUrl && URL.revokeObjectURL(fotoUrl)), [fotoUrl]);

  const pedirGps = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      setGps('no_disponible');
      setMensajeGps('El GPS del navegador solo funciona con HTTPS. Marca el punto tocando el mapa.');
      return;
    }
    setGps('buscando');
    setMensajeGps(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPunto({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPrecision(Math.round(pos.coords.accuracy));
        setOrigen('gps');
        setGps('ok');
      },
      (err) => {
        setGps('error');
        setMensajeGps(
          err.code === err.PERMISSION_DENIED
            ? 'No diste permiso de ubicación. Puedes marcar el punto tocando el mapa.'
            : 'No se pudo obtener la ubicación. Marca el punto tocando el mapa.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }, []);

  function elegirFoto(archivo: File | undefined) {
    setErrorFoto(null);
    if (!archivo) return;
    if (!(FOTO_TIPOS as readonly string[]).includes(archivo.type)) {
      setErrorFoto('La foto debe ser JPG, PNG o WEBP.');
      return;
    }
    if (archivo.size > FOTO_MAX_BYTES) {
      setErrorFoto('La foto supera el máximo de 10 MB.');
      return;
    }
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    setFoto(archivo);
    setFotoUrl(URL.createObjectURL(archivo));
  }

  function quitarFoto() {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    setFoto(null);
    setFotoUrl(null);
    if (inputFoto.current) inputFoto.current.value = '';
  }

  function marcarEnMapa(p: { lat: number; lng: number }) {
    setPunto(p);
    setOrigen('mapa');
    setPrecision(null);
  }

  function usarCentroide() {
    setPunto(territorio.centro);
    setOrigen('centroide');
    setPrecision(null);
  }

  const fotoObligatoria = Boolean(categoria?.usaIa);
  const paso2Listo = Boolean(punto && origen) && (!fotoObligatoria || Boolean(foto));

  /** Al terminar el paso 2 se buscan reportes cercanos de la misma categoría (RF-4.1). */
  async function continuarDesdePaso2() {
    if (!categoria || !punto || !origen) return;
    setVerificando(true);
    try {
      const res = await fetch('/api/reportes/duplicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaId: categoria.id, lat: punto.lat, lng: punto.lng, origen, precision }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.cercanos?.length) {
        setCercanos(data.cercanos as Cercano[]);
        return;
      }
    } catch {
      // Si la verificación falla, no se bloquea el registro
    } finally {
      setVerificando(false);
    }
    setPaso(3);
  }

  async function enviarRespaldo() {
    if (!respaldando || !canal) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/${respaldando.id}/respaldos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nVecinos, canal, nota }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo sumar el respaldo.');
        return;
      }
      setRespaldoListo({ reporteId: data.reporteId, folio: data.folio, total: data.totalRespaldoVecinos });
    } catch {
      setError('No hay conexión con el servidor.');
    } finally {
      setEnviando(false);
    }
  }

  async function enviar() {
    if (!categoria || !punto || !origen || !canal) return;
    setError(null);

    const campos = {
      categoriaId: String(categoria.id),
      descripcion,
      lat: String(punto.lat),
      lng: String(punto.lng),
      origen,
      precision: precision === null ? '' : String(precision),
      direccionReferencia: direccion,
      nVecinos: String(nVecinos),
      canal,
    };
    const validacion = NuevoReporteSchema.safeParse(campos);
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? 'Revisa los datos del formulario.');
      return;
    }

    const form = new FormData();
    for (const [k, v] of Object.entries(campos)) form.append(k, v);
    if (foto) form.append('foto', foto);

    setEnviando(true);
    try {
      const res = await fetch('/api/reportes', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        router.replace('/login?next=/encargado/nuevo');
        return;
      }
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo registrar el reporte. Intenta nuevamente.');
        return;
      }
      setResultado(data as Resultado);
    } catch {
      setError('No hay conexión con el servidor. Revisa que sigas en la red de la demo.');
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    quitarFoto();
    setPaso(1);
    setCategoria(null);
    setPunto(null);
    setOrigen(null);
    setPrecision(null);
    setGps('inactivo');
    setDescripcion('');
    setDireccion('');
    setNVecinos(1);
    setCanal(null);
    setResultado(null);
    setError(null);
    setCercanos(null);
    setRespaldando(null);
    setNota('');
    setRespaldoListo(null);
  }

  // ------------------------------------------------------------------ Éxito
  if (resultado) {
    return (
      <div className="space-y-5 py-4 text-center">
        <CheckCircle2 size={56} className="mx-auto text-emerald-600" />
        <div>
          <p className="text-sm text-slate-500">Reporte registrado con el folio</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-wide text-navy-800">{resultado.folio}</p>
        </div>
        {resultado.analisis && (
          <p className="mx-auto flex max-w-xs items-start gap-2 rounded-xl bg-violet-50 p-3 text-left text-sm text-violet-800">
            <Sparkles size={18} className="mt-0.5 shrink-0" />
            La IA revisará la foto y sugerirá una severidad. La verás en &quot;Mis reportes&quot;.
          </p>
        )}
        {resultado.fueraDeTerritorio && (
          <p className="mx-auto max-w-xs rounded-xl bg-orange-50 p-3 text-sm text-orange-800">
            El punto quedó fuera de tu territorio. Se registró igual y la municipalidad lo verá marcado.
          </p>
        )}
        <div className="grid gap-3 pt-2">
          <Button size="lg" onClick={reiniciar}>
            <Plus size={18} /> Registrar otro problema
          </Button>
          <Link
            href={`/encargado/reportes/${resultado.id}`}
            className="rounded-lg border border-slate-300 px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver el reporte
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ Respaldo sumado
  if (respaldoListo) {
    return (
      <div className="space-y-5 py-4 text-center">
        <CheckCircle2 size={56} className="mx-auto text-emerald-600" />
        <div>
          <p className="text-sm text-slate-500">Sumaste respaldo al reporte</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-wide text-navy-800">{respaldoListo.folio}</p>
          <p className="mt-2 text-lg font-semibold text-slate-700">
            Ahora lo respaldan {respaldoListo.total} vecinos
          </p>
        </div>
        <div className="grid gap-3 pt-2">
          <Button size="lg" onClick={reiniciar}>
            <Plus size={18} /> Registrar otro problema
          </Button>
          <Link
            href={`/encargado/reportes/${respaldoListo.reporteId}`}
            className="rounded-lg border border-slate-300 px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver el reporte
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ Ya existe un reporte cerca (RF-4.2)
  if (cercanos && categoria) {
    return (
      <div className="space-y-5 pb-28">
        <button
          type="button"
          onClick={() => {
            setCercanos(null);
            setRespaldando(null);
          }}
          className="inline-flex items-center gap-1 text-sm text-slate-600"
        >
          <ChevronLeft size={16} /> Volver
        </button>
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <Users size={22} className="mt-0.5 shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Ya existe un reporte cerca</h1>
            <p className="text-sm">
              Si es el mismo problema, suma tus vecinos a ese reporte: así la municipalidad ve cuántos lo piden.
            </p>
          </div>
        </div>

        <ul className="space-y-3">
          {cercanos.map((c) => (
            <li
              key={c.id}
              className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm ${respaldando?.id === c.id ? 'border-navy-600' : 'border-slate-200'}`}
            >
              {c.imagenId && (
                // eslint-disable-next-line @next/next/no-img-element -- foto con control de acceso
                <img src={`/api/imagenes/${c.imagenId}`} alt={`Foto del reporte ${c.folio}`} className="h-40 w-full bg-slate-900 object-contain" />
              )}
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-navy-700">{c.folio}</span>
                  <span className="text-sm font-medium text-slate-600">a {Math.round(c.distanciaM)} m</span>
                </div>
                <p className="line-clamp-2 text-sm text-slate-700">{c.descripcion}</p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Users size={12} /> {c.totalRespaldoVecinos} vecinos · {c.territorio}
                </p>
                {respaldando?.id !== c.id && (
                  <Button className="w-full" onClick={() => setRespaldando(c)}>
                    <Users size={16} /> Sumar respaldo
                  </Button>
                )}
              </div>

              {respaldando?.id === c.id && (
                <div className="space-y-4 border-t border-slate-100 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700">¿Cuántos vecinos te lo informaron?</p>
                    <ContadorVecinos valor={nVecinos} onCambio={setNVecinos} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">¿Por qué canal?</p>
                    <SelectorCanal valor={canal} onCambio={setCanal} />
                  </div>
                  <div>
                    <label htmlFor="nota" className="text-sm font-medium text-slate-700">
                      Nota <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <input
                      id="nota"
                      maxLength={300}
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      placeholder="Ej.: el bache creció esta semana"
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
                    />
                  </div>
                  {error && (
                    <p role="alert" className="text-sm text-red-700">
                      {error}
                    </p>
                  )}
                  <Button size="lg" className="w-full" disabled={enviando || !canal} onClick={enviarRespaldo}>
                    {enviando ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                    {enviando ? 'Enviando…' : !canal ? 'Elige el canal' : `Sumar ${nVecinos} ${nVecinos === 1 ? 'vecino' : 'vecinos'}`}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <BarraInferior>
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => {
              setCercanos(null);
              setRespaldando(null);
              setPaso(3);
            }}
          >
            Es otro problema: continuar con el registro
          </Button>
        </BarraInferior>
      </div>
    );
  }

  // ------------------------------------------------------------------ Pasos
  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-3">
        {paso > 1 ? (
          <button
            type="button"
            onClick={() => setPaso((p) => (p === 3 ? 2 : 1))}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Volver al paso anterior"
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <Link href="/encargado" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Cancelar">
            <X size={22} />
          </Link>
        )}
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paso {paso} de 3</p>
          <div className="mt-1 flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= paso ? 'bg-navy-700' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------- Paso 1 */}
      {paso === 1 && (
        <section className="space-y-4">
          <h1 className="text-xl font-bold text-slate-800">¿Qué problema te informaron?</h1>
          <div className="grid grid-cols-2 gap-3">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategoria(c);
                  setPaso(2);
                  // Al llegar al paso 2 se intenta el GPS automáticamente
                  if (gps === 'inactivo' && !punto) pedirGps();
                }}
                className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-white p-4 text-center shadow-sm transition active:scale-[0.98] ${
                  categoria?.id === c.id ? 'border-navy-600' : 'border-transparent hover:border-slate-300'
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${c.color}1a`, color: c.color }}>
                  <IconoCategoria slug={c.slug} size={26} />
                </span>
                <span className="text-sm font-semibold text-slate-800">{c.nombre}</span>
                {c.usaIa && <span className="text-[11px] font-medium text-violet-700">Con análisis IA</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- Paso 2 */}
      {paso === 2 && categoria && (
        <section className="space-y-5">
          <h1 className="text-xl font-bold text-slate-800">{categoria.nombre}: foto y ubicación</h1>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Foto {fotoObligatoria ? <span className="text-red-600">(obligatoria: la usa la IA)</span> : <span className="text-slate-400">(opcional)</span>}
            </p>
            <input
              ref={inputFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => elegirFoto(e.target.files?.[0])}
            />
            {fotoUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (object URL) */}
                <img src={fotoUrl} alt="Vista previa de la foto" className="max-h-64 w-full object-contain" />
                <button
                  type="button"
                  onClick={quitarFoto}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                  aria-label="Quitar foto"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputFoto.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white py-7 text-slate-600 active:bg-slate-50"
              >
                <Camera size={30} className="text-navy-700" />
                <span className="text-sm font-semibold">Tomar o elegir foto</span>
                <span className="text-xs text-slate-400">JPG, PNG o WEBP · máximo 10 MB</span>
              </button>
            )}
            {errorFoto && <p className="text-sm text-red-600">{errorFoto}</p>}
            <p className="flex items-start gap-1.5 text-xs text-amber-800">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              Que no aparezcan rostros, patentes ni datos de vecinos.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Ubicación</p>
            <Mapa
              centro={territorio.centro}
              punto={punto}
              onCambio={marcarEnMapa}
              precisionM={origen === 'gps' ? precision : null}
              color={categoria.color}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {gps === 'buscando' && (
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Loader2 size={15} className="animate-spin" /> Buscando tu ubicación…
                </span>
              )}
              {origen === 'gps' && (
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <Crosshair size={15} /> GPS · precisión ±{precision} m
                </span>
              )}
              {origen === 'mapa' && (
                <span className="flex items-center gap-1.5 text-navy-700">
                  <MapPin size={15} /> Punto marcado en el mapa
                </span>
              )}
              {origen === 'centroide' && (
                <span className="flex items-center gap-1.5 text-slate-600">
                  <MapPin size={15} /> Aproximada: centro de {territorio.nombre}
                </span>
              )}
              {!punto && gps !== 'buscando' && <span className="text-slate-500">Toca el mapa para marcar el lugar.</span>}
            </div>
            {mensajeGps && <p className="text-xs text-slate-500">{mensajeGps}</p>}
            <div className="flex flex-wrap gap-2">
              {gps !== 'no_disponible' && (
                <button
                  type="button"
                  onClick={pedirGps}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <Crosshair size={15} /> Usar mi GPS
                </button>
              )}
              {territorio.tieneCentroide && (
                <button
                  type="button"
                  onClick={usarCentroide}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <MapPin size={15} /> No sé el punto exacto
                </button>
              )}
            </div>
          </div>

          <BarraInferior>
            <Button size="lg" className="w-full" disabled={!paso2Listo || verificando} onClick={continuarDesdePaso2}>
              {verificando ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Revisando reportes cercanos…
                </>
              ) : !foto && fotoObligatoria ? (
                <>
                  <ImagePlus size={18} /> Falta la foto
                </>
              ) : !punto ? (
                <>
                  <MapPin size={18} /> Falta la ubicación
                </>
              ) : (
                'Continuar'
              )}
            </Button>
          </BarraInferior>
        </section>
      )}

      {/* ----------------------------------------------------- Paso 3 */}
      {paso === 3 && categoria && (
        <section className="space-y-5">
          <h1 className="text-xl font-bold text-slate-800">Detalles</h1>

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <p>
              <strong>No incluyas datos personales de vecinos</strong> (nombres, teléfonos ni rostros).
            </p>
          </div>

          <div>
            <label htmlFor="descripcion" className="text-sm font-medium text-slate-700">
              ¿Qué pasa?
            </label>
            <textarea
              id="descripcion"
              rows={3}
              maxLength={DESCRIPCION_MAX}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej.: bache profundo en la pista hacia el norte, los autos lo esquivan."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {descripcion.length}/{DESCRIPCION_MAX}
            </p>
          </div>

          <div>
            <label htmlFor="direccion" className="text-sm font-medium text-slate-700">
              Dirección de referencia <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              id="direccion"
              maxLength={DIRECCION_MAX}
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej.: Av. Grecia con Los Presidentes"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">¿Cuántos vecinos te lo informaron?</p>
            <ContadorVecinos valor={nVecinos} onCambio={setNVecinos} />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">¿Por qué canal?</p>
            <SelectorCanal valor={canal} onCambio={setCanal} />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <BarraInferior>
            <Button
              size="lg"
              className="w-full"
              disabled={enviando || descripcion.trim().length < 5 || !canal}
              onClick={enviar}
            >
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {enviando ? 'Enviando…' : !canal ? 'Elige el canal' : descripcion.trim().length < 5 ? 'Describe el problema' : 'Enviar reporte'}
            </Button>
          </BarraInferior>
        </section>
      )}
    </div>
  );
}

function ContadorVecinos({ valor, onCambio }: { valor: number; onCambio: (n: number) => void }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={() => onCambio(Math.max(1, valor - 1))}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700"
        aria-label="Menos vecinos"
      >
        <Minus size={20} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={valor}
        onChange={(e) => onCambio(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
        className="h-12 w-20 rounded-xl border border-slate-300 text-center text-xl font-bold"
        aria-label="Número de vecinos"
      />
      <button
        type="button"
        onClick={() => onCambio(valor + 1)}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700"
        aria-label="Más vecinos"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}

function SelectorCanal({ valor, onCambio }: { valor: Canal | null; onCambio: (c: Canal) => void }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {CANALES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onCambio(c)}
          className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold ${
            valor === c ? 'border-navy-600 bg-navy-50 text-navy-800' : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          {CANAL_LABEL[c]}
        </button>
      ))}
    </div>
  );
}

/** Botón principal fijo abajo, al alcance del pulgar. */
function BarraInferior({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1100] border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}
