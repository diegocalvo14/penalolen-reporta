'use client';

import { AlertTriangle, BarChart3, Bot, Check, ClipboardList, Copy, FileText, HelpCircle, Loader2, RefreshCw, Scale, Send, User, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';

interface Mensaje {
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
}

interface Estado {
  active: boolean;
  provider: string | null;
  model: string | null;
  message: string;
}

const MAX = 2000;

export default function ChatCopiloto({
  contexto,
  unidad,
}: {
  contexto: { id: string; folio: string; categoria: string; estado: string } | null;
  unidad: 'DOM' | 'DIDECO' | null;
}) {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [esperando, setEsperando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [copiado, setCopiado] = useState<number | null>(null);
  const fin = useRef<HTMLDivElement>(null);

  const verificar = useCallback(async () => {
    try {
      const res = await fetch('/api/copiloto', { cache: 'no-store' });
      const data = (await res.json()) as Estado;
      setEstado(data);
      setOffline(!data.active);
    } catch {
      setEstado({ active: false, provider: null, model: null, message: 'No se pudo verificar el estado.' });
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(verificar, 0);
    return () => clearTimeout(t);
  }, [verificar]);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, esperando]);

  useEffect(() => {
    if (!esperando) return;
    const inicio = Date.now();
    const t = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 500);
    return () => clearInterval(t);
  }, [esperando]);

  async function preguntar(pregunta: string, extra: { incluirMetricas?: boolean; ambitoMetricas?: 'unidad' } = {}) {
    const limpia = pregunta.trim();
    if (!limpia || esperando) return;
    if (limpia.length > MAX) {
      setError(`La pregunta supera los ${MAX} caracteres.`);
      return;
    }
    const nuevos: Mensaje[] = [...mensajes, { role: 'user', content: limpia }];
    setMensajes(nuevos);
    setTexto('');
    setError(null);
    setSegundos(0);
    setEsperando(true);
    try {
      const res = await fetch('/api/copiloto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nuevos.map(({ role, content }) => ({ role, content })),
          reporteId: contexto?.id ?? null,
          ...extra,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        const meta = [data.usoContexto ? `contexto ${contexto?.folio}` : null, data.usoMetricas ? 'métricas reales' : null, data.plazosOcultados ? 'plazos ocultados' : null]
          .filter(Boolean)
          .join(' · ');
        setMensajes([...nuevos, { role: 'assistant', content: data.reply, meta }]);
        setOffline(false);
      } else {
        if (data?.offline) setOffline(true);
        setError(data?.error ?? data?.error?.message ?? 'No se pudo obtener respuesta.');
        setMensajes(mensajes); // se devuelve la pregunta al cuadro de texto
        setTexto(limpia);
      }
    } catch {
      setError('No hay conexión con el servidor.');
      setMensajes(mensajes);
      setTexto(limpia);
    } finally {
      setEsperando(false);
    }
  }

  async function copiar(i: number, t: string) {
    try {
      await navigator.clipboard.writeText(t);
      setCopiado(i);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // portapapeles no disponible (http)
    }
  }

  const acciones = [
    ...(contexto
      ? [
          { icono: ClipboardList, texto: 'Resumir este caso', pregunta: 'Resume este caso en pocas líneas: qué es, dónde, estado actual, respaldo vecinal y severidad sugerida.' },
          {
            icono: FileText,
            texto: 'Redactar respuesta para el encargado',
            pregunta: 'Redacta una respuesta breve y formal para el encargado barrial que registró este reporte, informando el estado actual. No incluyas plazos.',
          },
          { icono: HelpCircle, texto: '¿Qué información falta?', pregunta: '¿Qué información falta o convendría verificar en este reporte antes de gestionarlo?' },
        ]
      : []),
    {
      icono: BarChart3,
      texto: unidad ? `Métricas de mi unidad (${unidad})` : 'Métricas generales',
      pregunta: 'Dame un resumen de las métricas de trabajo: reportes abiertos, por territorio y por severidad, y tiempos promedio por etapa.',
      extra: { incluirMetricas: true, ambitoMetricas: 'unidad' as const },
    },
    { icono: Scale, texto: 'Bacheo de emergencia: ¿qué dice la norma?', pregunta: '¿Qué dice la normativa sobre la reparación de baches de emergencia por parte del municipio?' },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <Card className="flex min-h-[60vh] flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Bot size={18} className="text-navy-700" />
            {estado === null ? (
              <span className="text-slate-400">Verificando IA local…</span>
            ) : estado.active ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> IA local activa · {estado.model}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> IA local apagada
              </span>
            )}
          </div>
          {contexto && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-navy-50 px-2.5 py-1 text-xs text-navy-800">
              Contexto: <strong className="font-mono">{contexto.folio}</strong> · {contexto.categoria} · {contexto.estado}
              <button type="button" onClick={() => router.replace('/copiloto')} aria-label="Quitar contexto" className="text-navy-500 hover:text-navy-800">
                <X size={13} />
              </button>
            </span>
          )}
        </div>

        {offline && (
          <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={16} /> El modelo local no está disponible
            </p>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs">
              <li>Abre LM Studio y carga un modelo Llama 3 (o usa Ollama).</li>
              <li>En LM Studio, pestaña Developer: inicia el servidor en el puerto 1234.</li>
              <li>Vuelve aquí y presiona Reintentar.</li>
            </ol>
            <Button size="sm" variant="secondary" className="mt-3" onClick={verificar}>
              <RefreshCw size={14} /> Reintentar
            </Button>
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {mensajes.length === 0 && !offline && (
            <div className="py-10 text-center text-sm text-slate-500">
              <Bot size={36} className="mx-auto mb-2 text-slate-300" />
              {contexto ? `Pregunta lo que necesites sobre el reporte ${contexto.folio}.` : 'Haz una pregunta o usa una acción rápida.'}
              <p className="mt-1 text-xs text-slate-400">Las respuestas son borradores para revisar; el copiloto no compromete plazos.</p>
            </div>
          )}
          {mensajes.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && <Bot size={20} className="mt-1 shrink-0 text-navy-700" />}
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.role === 'assistant' && (
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                    <span>{m.meta}</span>
                    <button type="button" onClick={() => copiar(i, m.content)} className="inline-flex items-center gap-1 hover:text-slate-700">
                      {copiado === i ? <Check size={12} /> : <Copy size={12} />} {copiado === i ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                )}
              </div>
              {m.role === 'user' && <User size={20} className="mt-1 shrink-0 text-slate-400" />}
            </div>
          ))}
          {esperando && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Pensando… {segundos} s
            </p>
          )}
          <div ref={fin} />
        </div>

        <form
          className="border-t border-slate-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void preguntar(texto);
          }}
        >
          {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={texto}
              maxLength={MAX}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void preguntar(texto);
                }
              }}
              placeholder="Escribe tu pregunta… (Enter para enviar)"
              className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
            />
            <Button type="submit" disabled={esperando || !texto.trim()} aria-label="Enviar">
              <Send size={16} />
            </Button>
          </div>
          <p className="mt-1 text-right text-[11px] text-slate-400">
            {texto.length}/{MAX}
          </p>
        </form>
      </Card>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
        {acciones.map((a) => (
          <button
            key={a.texto}
            type="button"
            disabled={esperando}
            onClick={() => preguntar(a.pregunta, 'extra' in a ? a.extra : {})}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 shadow-sm hover:border-navy-300 disabled:opacity-50"
          >
            <a.icono size={16} className="shrink-0 text-navy-700" /> {a.texto}
          </button>
        ))}
        {!contexto && (
          <p className="text-xs text-slate-500">
            Para preguntar por un reporte, ábrelo desde la{' '}
            <Link href="/panel" className="text-navy-700 underline">
              bandeja
            </Link>{' '}
            y usa &quot;Consultar al copiloto&quot;.
          </p>
        )}
      </div>
    </div>
  );
}
