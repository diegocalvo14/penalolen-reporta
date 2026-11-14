/**
 * Armado del prompt del copiloto (M8). El system prompt vive en el servidor (§2).
 * Funciones puras: se prueban sin LLM ni base de datos.
 */
import { ESTADO_LABEL } from '@/domain/estados';
import { SEVERIDAD_LABEL } from '@/domain/severidad';
import { CANAL_LABEL } from '@/domain/reporte-input';
import type { Metricas } from '@/server/metricas';
import type { ReporteDetalle } from '@/server/reportes/consultas';
import { REFERENCIAS } from './referencias';

export const MARCA_PLAZO = '[plazo a definir por la DOM]';

export function systemPrompt(): string {
  return `Eres el Copiloto de Peñalolén Reporta, asistente para funcionarios municipales de la DOM y la DIDECO de la Municipalidad de Peñalolén (Chile).

Puedes ayudar a:
1. Aclarar dudas sobre normativa y sobre el funcionamiento interno de la plataforma, basándote SOLO en el bloque [REFERENCIAS]. Si la respuesta no está allí, dilo explícitamente ("No tengo esa información en mis referencias") y recomienda verificar con la DOM. No inventes artículos, leyes ni procedimientos.
2. Responder preguntas sobre el trabajo usando SOLO los números del bloque [MÉTRICAS] cuando esté presente. Si los datos no alcanzan para responder, dilo. No inventes cifras.
3. Redactar borradores: resúmenes de casos y respuestas para el encargado barrial. Todo borrador empieza con "Borrador para revisión del funcionario:".

Reglas obligatorias:
- NUNCA menciones plazos de atención, reparación o respuesta (horas, días, semanas ni fechas comprometidas), tampoco en borradores. Si te piden un plazo, escribe exactamente ${MARCA_PLAZO}.
- No puedes modificar datos: no cambias estados, no cierras ni derivas reportes. Si te lo piden, explica que el funcionario debe hacerlo desde el panel.
- No incluyas datos personales de vecinos ni de funcionarios.
- Las respuestas van dirigidas a encargados barriales (no directamente a vecinos): ellos reúnen los problemas que informan los vecinos.
- La severidad del servicio de visión es solo una sugerencia de la IA; nunca la presentes como diagnóstico definitivo.
- Responde en español de Chile, con tono formal, claro y breve.

[REFERENCIAS]
${REFERENCIAS}
[FIN REFERENCIAS]`;
}

/** Quita correos, teléfonos y RUT de un texto libre (descripciones y comentarios). */
export function quitarDatosPersonales(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo omitido]')
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g, '[RUT omitido]')
    .replace(/(\+?56\s?)?(\(?9\)?[\s-]?)\d{4}[\s-]?\d{4}\b/g, '[teléfono omitido]');
}

const recorte = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);
const fecha = (d: Date | string) =>
  new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

function lineaEvento(e: ReporteDetalle['eventos'][number]): string {
  switch (e.tipo) {
    case 'creado':
      return 'Reporte registrado';
    case 'respaldo':
      return 'Se sumó respaldo vecinal';
    case 'estado':
      return `Cambio de estado a ${e.estadoNuevo ? ESTADO_LABEL[e.estadoNuevo] : '?'}`;
    case 'derivado':
      return `Derivado a ${e.organismoDerivado ?? 'otro organismo'}`;
    case 'cierre':
      return 'Cerrado como resuelto';
    case 'comentario':
      return 'Comentario del funcionario';
    case 'analisis':
      return 'Análisis de IA de la foto';
  }
}

/**
 * Bloque [CONTEXTO DEL REPORTE] (RF-8.2): folio, categoría, territorio, estado,
 * respaldos, severidad sugerida, fechas e historial resumido. SIN datos
 * personales: no incluye nombres de encargados ni de funcionarios.
 */
export function contextoReporte(r: ReporteDetalle): string {
  const sev =
    !r.categoria.usaIa
      ? 'No aplica (la categoría no usa IA)'
      : r.analisis?.estado === 'listo' && r.analisis.severidad
        ? `${SEVERIDAD_LABEL[r.analisis.severidad]} (cobertura ${r.analisis.ratioCobertura ?? 0} %${r.analisis.requiereRevision ? ', requiere revisión humana' : ''})`
        : r.analisis?.estado === 'error'
          ? 'Sin resultado (el análisis falló)'
          : 'Análisis pendiente';

  const lineas = [
    '[CONTEXTO DEL REPORTE]',
    `Folio: ${r.folio}`,
    `Categoría: ${r.categoria.nombre} (unidad responsable: ${r.categoria.unidadResponsable})`,
    `Territorio: ${r.territorio.nombre}${r.fueraDeTerritorio ? ' (registrado por un encargado de otro territorio)' : ''}`,
    `Estado actual: ${ESTADO_LABEL[r.estado]}`,
    `Respaldo vecinal: ${r.totalRespaldoVecinos} vecinos (${r.respaldos.map((s) => `${s.nVecinos} por ${CANAL_LABEL[s.canal]}`).join(', ') || 'sin detalle'})`,
    `Severidad sugerida por IA: ${sev}`,
    `Ubicación: ${r.direccionReferencia ? `referencia "${quitarDatosPersonales(r.direccionReferencia)}"` : 'sin dirección de referencia'}; foto: ${r.imagenes.some((i) => i.tipo === 'original') ? 'sí' : 'no'}`,
    `Creado: ${fecha(r.creadoEn)} · Última actualización: ${fecha(r.actualizadoEn)}`,
  ];
  if (r.organismoDerivado) lineas.push(`Derivado a: ${r.organismoDerivado}`);
  if (r.motivoRechazo) lineas.push(`Motivo de rechazo: ${quitarDatosPersonales(recorte(r.motivoRechazo, 200))}`);
  lineas.push(`Descripción del encargado: "${quitarDatosPersonales(recorte(r.descripcion, 400))}"`);
  lineas.push('Historial resumido:');
  for (const e of r.eventos.slice(-12)) {
    const comentario = e.comentario ? ` — "${quitarDatosPersonales(recorte(e.comentario, 160))}"` : '';
    lineas.push(`- ${fecha(e.creadoEn)}: ${lineaEvento(e)}${comentario}`);
  }
  lineas.push('[FIN CONTEXTO]');
  return lineas.join('\n');
}

const h = (n: number) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} h`;

/** Bloque [MÉTRICAS] (RF-8.3) en texto compacto. */
export function bloqueMetricas(general: Metricas, esteMes: Metricas | null, ambito: string): string {
  const m = general;
  const l: string[] = [`[MÉTRICAS] Ámbito: ${ambito}. Calculadas desde la base de datos al momento de la consulta.`];
  l.push(`Totales: ${m.totales.reportes} reportes; ${m.totales.abiertos} abiertos; ${m.totales.resueltos} resueltos; ${m.totales.cerrados} cerrados en total; ${m.totales.vecinos} vecinos en respaldos.`);
  l.push(`Por estado: ${m.porEstado.map((e) => `${ESTADO_LABEL[e.estado]} ${e.total}`).join(', ')}.`);
  l.push(`Por territorio (abiertos / total): ${m.porTerritorio.map((t) => `${t.territorio} ${t.abiertos}/${t.total}`).join(', ') || 'sin datos'}.`);
  if (esteMes) {
    l.push(`Creados este mes por territorio: ${esteMes.porTerritorio.map((t) => `${t.territorio} ${t.total}`).join(', ') || 'ninguno'}.`);
    l.push(`Creados este mes por categoría: ${esteMes.porCategoria.map((c) => `${c.categoria} ${c.total}`).join(', ') || 'ninguno'}.`);
  }
  l.push(`Por categoría (abiertos / total): ${m.porCategoria.map((c) => `${c.categoria} ${c.abiertos}/${c.total}`).join(', ') || 'sin datos'}.`);
  l.push(
    `Baches abiertos por severidad sugerida: ${m.abiertosPorSeveridad.map((s) => `${s.severidad === 'sin_analisis' ? 'sin análisis' : (SEVERIDAD_LABEL as Record<string, string>)[s.severidad] ?? s.severidad} ${s.total}`).join(', ') || 'ninguno'}.`,
  );
  l.push(
    `Tiempo promedio en cada etapa (estadística histórica, no es un plazo): ${m.tiempoPorEtapa.map((e) => `${ESTADO_LABEL[e.estado]} ${h(e.horasPromedio)} (n=${e.muestras})`).join(', ') || 'aún sin datos'}.`,
  );
  l.push(`Tiempo promedio de resolución (histórico): ${m.horasPromedioResolucion === null ? 'aún sin reportes resueltos' : h(m.horasPromedioResolucion)}.`);
  l.push(`Top 5 abiertos por respaldo vecinal: ${m.top5Respaldos.map((r) => `${r.folio} (${r.categoria}, ${r.territorio}, ${r.total} vecinos, ${ESTADO_LABEL[r.estado]})`).join('; ') || 'ninguno'}.`);
  l.push(`Creados por semana (últimas 12, lunes de cada semana): ${m.creadosPorSemana.map((s) => `${s.semana}: ${s.total}`).join(', ') || 'sin datos'}.`);
  l.push('[FIN MÉTRICAS]');
  return l.join('\n');
}

const PALABRAS_METRICAS =
  /\b(cu[aá]nt[oa]s?|m[eé]tricas?|estad[ií]sticas?|promedio|demora|tiempo|total(es)?|abiertos?|resueltos?|ranking|top|semana|mes|territorio con m[aá]s|m[aá]s reportes|por territorio|por categor[ií]a|carga de trabajo|pendientes)\b/i;

/** ¿La pregunta necesita datos del trabajo? (RF-8.3) */
export function necesitaMetricas(pregunta: string): boolean {
  return PALABRAS_METRICAS.test(pregunta);
}

// ---------------------------------------------------------------- Regla de no plazos (RF-8.5)

const NUMERO = '(?:\\d+(?:[.,]\\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|veinticuatro|cuarenta y ocho|setenta y dos)';
const UNIDAD = '(?:horas?|hrs?\\.?|d[ií]as?(?:\\s+(?:h[aá]biles|corridos))?|semanas?|meses?)';
const RANGO = `${NUMERO}(?:\\s*(?:a|-|–|o|y)\\s*${NUMERO})?`;

const PATRONES_PLAZO: RegExp[] = [
  // "en (un plazo de|un máximo de|los próximos)? 48 horas", "dentro de 5 días hábiles", "antes de 10 días"
  new RegExp(`\\b(?:en|dentro\\s+de|antes\\s+de|a\\s+m[aá]s\\s+tardar\\s+en)\\s+(?:(?:un\\s+)?(?:plazo|m[aá]ximo|lapso|t[eé]rmino)\\s+(?:de\\s+|m[aá]ximo\\s+de\\s+)?|los\\s+pr[oó]ximos\\s+|las\\s+pr[oó]ximas\\s+|aproximadamente\\s+|unos?\\s+|unas\\s+)?${RANGO}\\s*${UNIDAD}`, 'gi'),
  // "plazo (estimado|máximo)? de 24-48 horas", "plazo: 5 días"
  new RegExp(`\\bplazos?\\s+(?:estimados?\\s+|m[aá]ximos?\\s+|aproximados?\\s+)?(?:de\\s+|:\\s*)${RANGO}\\s*${UNIDAD}`, 'gi'),
  // "24–48 horas" o "5-10 días hábiles" sueltos (rango = típico de compromiso)
  new RegExp(`\\b\\d+\\s*(?:-|–|a)\\s*\\d+\\s*${UNIDAD}`, 'gi'),
];

const CONTEXTO_ESTADISTICO = /(promedio|demor[aó]|tard[aó]|antig[uü]edad|hace|lleva|llevan|hist[oó]ric|estuvo|estuvieron|media de)\s*[^.\n]{0,40}$/i;

/**
 * Reemplaza cualquier plazo comprometido por [plazo a definir por la DOM].
 * Respeta las estadísticas ("tiempo promedio 12 h", "hace 3 días"), que no son plazos.
 * Es la segunda barrera: la primera es la instrucción del system prompt.
 */
export function sanearPlazos(texto: string): { texto: string; reemplazos: number } {
  let reemplazos = 0;
  let salida = texto;
  for (const patron of PATRONES_PLAZO) {
    salida = salida.replace(patron, (coincidencia: string, ...args: unknown[]) => {
      const offset = args[args.length - 2] as number;
      const completo = args[args.length - 1] as string;
      const antes = completo.slice(Math.max(0, offset - 60), offset);
      if (CONTEXTO_ESTADISTICO.test(antes)) return coincidencia;
      reemplazos += 1;
      return MARCA_PLAZO;
    });
  }
  return { texto: salida, reemplazos };
}
