/**
 * Validación de los datos de un nuevo reporte (RF-3.1). La usan el formulario
 * del encargado y la API, para que ambos apliquen exactamente las mismas reglas.
 */
import { z } from 'zod';

export const DESCRIPCION_MAX = 500;
export const DIRECCION_MAX = 200;
export const NOTA_RESPALDO_MAX = 300;
export const FOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VECINOS_MAX = 1000;

export const ORIGENES_UBICACION = ['gps', 'mapa', 'centroide'] as const;
export const CANALES = ['junta', 'whatsapp', 'presencial', 'otro'] as const;

export const CANAL_LABEL: Record<(typeof CANALES)[number], string> = {
  junta: 'Junta de vecinos',
  whatsapp: 'WhatsApp',
  presencial: 'En persona',
  otro: 'Otro',
};

export const ORIGEN_LABEL: Record<(typeof ORIGENES_UBICACION)[number], string> = {
  gps: 'GPS del celular',
  mapa: 'Marcado en el mapa',
  centroide: 'Aproximada (centro del territorio)',
};

/** Convierte "" en undefined para los campos opcionales que llegan desde un formulario. */
const opcional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

export const NuevoReporteSchema = z
  .object({
    categoriaId: z.coerce.number().int().positive({ message: 'Elige una categoría.' }),
    descripcion: z
      .string()
      .trim()
      .min(5, { message: 'Describe el problema (al menos 5 caracteres).' })
      .max(DESCRIPCION_MAX, { message: `La descripción admite hasta ${DESCRIPCION_MAX} caracteres.` }),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    origen: z.enum(ORIGENES_UBICACION),
    precision: opcional(z.coerce.number().min(0).max(100000)),
    direccionReferencia: opcional(z.string().trim().max(DIRECCION_MAX)),
    nVecinos: z.coerce
      .number()
      .int({ message: 'El número de vecinos debe ser entero.' })
      .min(1, { message: 'Indica cuántos vecinos lo informaron (mínimo 1).' })
      .max(VECINOS_MAX),
    canal: z.enum(CANALES, { message: 'Indica por qué canal te lo informaron.' }),
  })
  .refine((d) => d.origen !== 'gps' || d.precision !== undefined, {
    message: 'La ubicación por GPS debe incluir su precisión.',
    path: ['precision'],
  });

export type NuevoReporte = z.infer<typeof NuevoReporteSchema>;

// ---------------------------------------------------------------------
// Hito 3: duplicados, respaldo vecinal y cambios de estado
// ---------------------------------------------------------------------

/** POST /api/reportes/duplicados (RF-4.1) */
export const BuscarDuplicadosSchema = z.object({
  categoriaId: z.coerce.number().int().positive(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  origen: z.enum(ORIGENES_UBICACION),
  precision: opcional(z.coerce.number().min(0).max(100000)),
});

/** POST /api/reportes/{id}/respaldos (RF-4.3) */
export const NuevoRespaldoSchema = z.object({
  nVecinos: z.coerce
    .number()
    .int({ message: 'El número de vecinos debe ser entero.' })
    .min(1, { message: 'Indica cuántos vecinos lo informaron (mínimo 1).' })
    .max(VECINOS_MAX),
  canal: z.enum(CANALES, { message: 'Indica por qué canal te lo informaron.' }),
  nota: opcional(z.string().trim().max(NOTA_RESPALDO_MAX)),
});

export const COMENTARIO_MAX = 1000;

/** PATCH /api/reportes/{id}/estado (§8.1) */
export const CambioEstadoSchema = z.object({
  estado: z.enum(['en_revision', 'en_gestion', 'derivado', 'resuelto', 'duplicado', 'rechazado']),
  comentario: opcional(z.string().trim().max(COMENTARIO_MAX)),
  organismo: opcional(z.string().trim().max(120)),
  /** id (uuid) o folio (PR-2026-00042) del reporte original */
  duplicadoDe: opcional(z.string().trim().max(60)),
  motivo: opcional(z.string().trim().max(COMENTARIO_MAX)),
});

export const NuevoComentarioSchema = z.object({
  comentario: z.string().trim().min(1, { message: 'Escribe un comentario.' }).max(COMENTARIO_MAX),
});

/** Organismos sugeridos al derivar (el funcionario puede escribir otro). */
export const ORGANISMOS_SUGERIDOS = [
  'SERVIU Metropolitano',
  'Empresa eléctrica (Enel)',
  'Empresa sanitaria (Aguas Andinas)',
  'Dirección de Aseo y Ornato',
  'Dirección de Tránsito',
  'Otra unidad municipal',
] as const;
