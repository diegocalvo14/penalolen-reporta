/**
 * Peñalolén Reporta — Esquema de datos (PROMPT_DESARROLLO §5)
 * PostgreSQL + PostGIS con Drizzle ORM.
 *
 * Después de cambiar este archivo: `npm run db:generate` crea la migración SQL
 * en /drizzle y `npm run db:migrate` la aplica.
 */
import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { geographyPoint, geographyPolygon } from './geo';

// ---------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------

export const rolEnum = pgEnum('rol', ['encargado', 'funcionario', 'admin']);
export const unidadEnum = pgEnum('unidad', ['DOM', 'DIDECO']);
export const origenUbicacionEnum = pgEnum('origen_ubicacion', ['gps', 'mapa', 'centroide']);
export const estadoReporteEnum = pgEnum('estado_reporte', [
  'ingresado',
  'en_revision',
  'en_gestion',
  'derivado',
  'resuelto',
  'duplicado',
  'rechazado',
]);
export const canalRespaldoEnum = pgEnum('canal_respaldo', ['junta', 'whatsapp', 'presencial', 'otro']);
export const tipoImagenEnum = pgEnum('tipo_imagen', ['original', 'cierre']);
export const estadoAnalisisEnum = pgEnum('estado_analisis', ['pendiente', 'listo', 'error']);
export const severidadEnum = pgEnum('severidad', ['baja', 'media', 'critica', 'sin_deteccion']);
export const tipoEventoEnum = pgEnum('tipo_evento', [
  'creado',
  'respaldo',
  'estado',
  'derivado',
  'comentario',
  'cierre',
  'analisis',
]);

const creadoEn = () => timestamp('creado_en', { withTimezone: true, precision: 3 }).notNull().defaultNow();
const actualizadoEn = () =>
  timestamp('actualizado_en', { withTimezone: true, precision: 3 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------
// Catálogos y usuarios
// ---------------------------------------------------------------------

export const territorios = pgTable('territorios', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  // Centroide: ubicación aproximada y centro de mapas
  centroide: geographyPoint('centroide'),
  // Polígono opcional para detectar reportes fuera de territorio (RF-3.5)
  poligono: geographyPolygon('poligono'),
  creadoEn: creadoEn(),
});

export const categorias = pgTable('categorias', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  slug: text('slug').notNull().unique(),
  usaIa: boolean('usa_ia').notNull().default(false),
  radioDuplicadoM: integer('radio_duplicado_m').notNull().default(15),
  unidadResponsable: unidadEnum('unidad_responsable').notNull(),
  color: text('color').notNull().default('#64748b'), // color del marcador en el mapa
  activa: boolean('activa').notNull().default(true),
});

export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nombre: text('nombre').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    rol: rolEnum('rol').notNull(),
    territorioId: integer('territorio_id').references(() => territorios.id), // solo encargados
    unidad: unidadEnum('unidad'), // solo funcionarios
    activo: boolean('activo').notNull().default(true),
    debeCambiarPassword: boolean('debe_cambiar_password').notNull().default(false),
    creadoEn: creadoEn(),
  },
  (t) => [index('usuarios_rol_idx').on(t.rol)],
);

// ---------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------

export const reportes = pgTable(
  'reportes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    folio: text('folio').notNull().unique(), // PR-2026-00042
    categoriaId: integer('categoria_id')
      .notNull()
      .references(() => categorias.id),
    descripcion: varchar('descripcion', { length: 500 }).notNull(),
    ubicacion: geographyPoint('ubicacion').notNull(),
    origenUbicacion: origenUbicacionEnum('origen_ubicacion').notNull(),
    precisionM: doublePrecision('precision_m'),
    direccionReferencia: text('direccion_referencia'),
    territorioId: integer('territorio_id')
      .notNull()
      .references(() => territorios.id),
    encargadoId: uuid('encargado_id')
      .notNull()
      .references(() => usuarios.id),
    estado: estadoReporteEnum('estado').notNull().default('ingresado'),
    totalRespaldoVecinos: integer('total_respaldo_vecinos').notNull().default(0),
    fueraDeTerritorio: boolean('fuera_de_territorio').notNull().default(false),
    duplicadoDeId: uuid('duplicado_de_id').references((): AnyPgColumn => reportes.id),
    motivoRechazo: text('motivo_rechazo'),
    organismoDerivado: text('organismo_derivado'),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
    cerradoEn: timestamp('cerrado_en', { withTimezone: true, precision: 3 }),
  },
  (t) => [
    index('reportes_estado_idx').on(t.estado),
    index('reportes_categoria_estado_idx').on(t.categoriaId, t.estado),
    index('reportes_territorio_idx').on(t.territorioId),
    index('reportes_encargado_idx').on(t.encargadoId),
    index('reportes_creado_idx').on(t.creadoEn),
    index('reportes_ubicacion_gist').using('gist', t.ubicacion),
  ],
);

export const respaldos = pgTable(
  'respaldos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporteId: uuid('reporte_id')
      .notNull()
      .references(() => reportes.id, { onDelete: 'cascade' }),
    encargadoId: uuid('encargado_id')
      .notNull()
      .references(() => usuarios.id),
    nVecinos: integer('n_vecinos').notNull(),
    canal: canalRespaldoEnum('canal').notNull(),
    nota: varchar('nota', { length: 300 }),
    creadoEn: creadoEn(),
  },
  (t) => [index('respaldos_reporte_idx').on(t.reporteId)],
);

export const imagenes = pgTable(
  'imagenes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporteId: uuid('reporte_id')
      .notNull()
      .references(() => reportes.id, { onDelete: 'cascade' }),
    ruta: text('ruta').notNull(), // ruta relativa dentro de UPLOAD_DIR (nunca base64)
    tipo: tipoImagenEnum('tipo').notNull(),
    mime: text('mime').notNull(),
    tamanoBytes: integer('tamano_bytes').notNull(),
    ancho: integer('ancho'),
    alto: integer('alto'),
    creadoEn: creadoEn(),
  },
  (t) => [index('imagenes_reporte_idx').on(t.reporteId)],
);

export interface BoundingBox {
  x1: number; // normalizadas 0–1
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  label: string;
}

export const analisisIa = pgTable(
  'analisis_ia',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporteId: uuid('reporte_id')
      .notNull()
      .references(() => reportes.id, { onDelete: 'cascade' }),
    imagenId: uuid('imagen_id')
      .notNull()
      .references(() => imagenes.id, { onDelete: 'cascade' }),
    estado: estadoAnalisisEnum('estado').notNull().default('pendiente'),
    engine: text('engine'),
    modeloVersion: text('modelo_version'),
    boundingBoxes: jsonb('bounding_boxes').$type<BoundingBox[]>(),
    ratioCobertura: doublePrecision('ratio_cobertura'),
    severidadSugerida: severidadEnum('severidad_sugerida'),
    requiereRevision: boolean('requiere_revision').notNull().default(false),
    error: text('error'),
    duracionMs: integer('duracion_ms'),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [index('analisis_reporte_idx').on(t.reporteId)],
);

/** Fuente de las métricas del copiloto (§7 M8 y M9). usuario_id null = sistema. */
export const eventosHistorial = pgTable(
  'eventos_historial',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporteId: uuid('reporte_id')
      .notNull()
      .references(() => reportes.id, { onDelete: 'cascade' }),
    usuarioId: uuid('usuario_id').references(() => usuarios.id),
    tipo: tipoEventoEnum('tipo').notNull(),
    estadoAnterior: estadoReporteEnum('estado_anterior'),
    estadoNuevo: estadoReporteEnum('estado_nuevo'),
    organismoDerivado: text('organismo_derivado'),
    comentario: text('comentario'),
    datos: jsonb('datos').$type<Record<string, unknown>>(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index('eventos_reporte_fecha_idx').on(t.reporteId, t.creadoEn),
    index('eventos_tipo_fecha_idx').on(t.tipo, t.creadoEn),
  ],
);

export const notificaciones = pgTable(
  'notificaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    reporteId: uuid('reporte_id').references(() => reportes.id, { onDelete: 'cascade' }),
    tipo: text('tipo').notNull(),
    mensaje: text('mensaje').notNull(),
    leida: boolean('leida').notNull().default(false),
    creadoEn: creadoEn(),
  },
  (t) => [index('notificaciones_usuario_leida_idx').on(t.usuarioId, t.leida)],
);

// ---------------------------------------------------------------------
// Configuración (una sola fila, id = 1) y contador de folios
// ---------------------------------------------------------------------

export const configuracion = pgTable('configuracion', {
  id: integer('id').primaryKey().default(1),
  umbralMedia: doublePrecision('umbral_media').notNull().default(8), // % de cobertura
  umbralCritica: doublePrecision('umbral_critica').notNull().default(20), // % de cobertura
  umbralAlertaRespaldos: integer('umbral_alerta_respaldos').notNull().default(10),
  visionTimeoutMs: integer('vision_timeout_ms').notNull().default(10000),
  actualizadoEn: actualizadoEn(),
});

export const folioContadores = pgTable('folio_contadores', {
  anio: integer('anio').primaryKey(),
  ultimo: integer('ultimo').notNull().default(0),
});

// ---------------------------------------------------------------------
// Relaciones (para consultas con `db.query.*`)
// ---------------------------------------------------------------------

export const territoriosRelations = relations(territorios, ({ many }) => ({
  usuarios: many(usuarios),
  reportes: many(reportes),
}));

export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
  territorio: one(territorios, { fields: [usuarios.territorioId], references: [territorios.id] }),
  reportes: many(reportes),
  notificaciones: many(notificaciones),
}));

export const categoriasRelations = relations(categorias, ({ many }) => ({
  reportes: many(reportes),
}));

export const reportesRelations = relations(reportes, ({ one, many }) => ({
  categoria: one(categorias, { fields: [reportes.categoriaId], references: [categorias.id] }),
  territorio: one(territorios, { fields: [reportes.territorioId], references: [territorios.id] }),
  encargado: one(usuarios, { fields: [reportes.encargadoId], references: [usuarios.id] }),
  duplicadoDe: one(reportes, {
    fields: [reportes.duplicadoDeId],
    references: [reportes.id],
    relationName: 'duplicados',
  }),
  duplicados: many(reportes, { relationName: 'duplicados' }),
  respaldos: many(respaldos),
  imagenes: many(imagenes),
  analisis: many(analisisIa),
  eventos: many(eventosHistorial),
}));

export const respaldosRelations = relations(respaldos, ({ one }) => ({
  reporte: one(reportes, { fields: [respaldos.reporteId], references: [reportes.id] }),
  encargado: one(usuarios, { fields: [respaldos.encargadoId], references: [usuarios.id] }),
}));

export const imagenesRelations = relations(imagenes, ({ one, many }) => ({
  reporte: one(reportes, { fields: [imagenes.reporteId], references: [reportes.id] }),
  analisis: many(analisisIa),
}));

export const analisisIaRelations = relations(analisisIa, ({ one }) => ({
  reporte: one(reportes, { fields: [analisisIa.reporteId], references: [reportes.id] }),
  imagen: one(imagenes, { fields: [analisisIa.imagenId], references: [imagenes.id] }),
}));

export const eventosHistorialRelations = relations(eventosHistorial, ({ one }) => ({
  reporte: one(reportes, { fields: [eventosHistorial.reporteId], references: [reportes.id] }),
  usuario: one(usuarios, { fields: [eventosHistorial.usuarioId], references: [usuarios.id] }),
}));

export const notificacionesRelations = relations(notificaciones, ({ one }) => ({
  usuario: one(usuarios, { fields: [notificaciones.usuarioId], references: [usuarios.id] }),
  reporte: one(reportes, { fields: [notificaciones.reporteId], references: [reportes.id] }),
}));

// Tipos inferidos útiles en toda la app
export type Usuario = typeof usuarios.$inferSelect;
export type Rol = (typeof rolEnum.enumValues)[number];
export type Unidad = (typeof unidadEnum.enumValues)[number];
export type EstadoReporte = (typeof estadoReporteEnum.enumValues)[number];
export type Severidad = (typeof severidadEnum.enumValues)[number];
export type OrigenUbicacion = (typeof origenUbicacionEnum.enumValues)[number];
export type CanalRespaldo = (typeof canalRespaldoEnum.enumValues)[number];
export type Configuracion = typeof configuracion.$inferSelect;
