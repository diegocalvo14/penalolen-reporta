CREATE TYPE "public"."canal_respaldo" AS ENUM('junta', 'whatsapp', 'presencial', 'otro');--> statement-breakpoint
CREATE TYPE "public"."estado_analisis" AS ENUM('pendiente', 'listo', 'error');--> statement-breakpoint
CREATE TYPE "public"."estado_reporte" AS ENUM('ingresado', 'en_revision', 'en_gestion', 'derivado', 'resuelto', 'duplicado', 'rechazado');--> statement-breakpoint
CREATE TYPE "public"."origen_ubicacion" AS ENUM('gps', 'mapa', 'centroide');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('encargado', 'funcionario', 'admin');--> statement-breakpoint
CREATE TYPE "public"."severidad" AS ENUM('baja', 'media', 'critica', 'sin_deteccion');--> statement-breakpoint
CREATE TYPE "public"."tipo_evento" AS ENUM('creado', 'respaldo', 'estado', 'derivado', 'comentario', 'cierre', 'analisis');--> statement-breakpoint
CREATE TYPE "public"."tipo_imagen" AS ENUM('original', 'cierre');--> statement-breakpoint
CREATE TYPE "public"."unidad" AS ENUM('DOM', 'DIDECO');--> statement-breakpoint
CREATE TABLE "analisis_ia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporte_id" uuid NOT NULL,
	"imagen_id" uuid NOT NULL,
	"estado" "estado_analisis" DEFAULT 'pendiente' NOT NULL,
	"engine" text,
	"modelo_version" text,
	"bounding_boxes" jsonb,
	"ratio_cobertura" double precision,
	"severidad_sugerida" "severidad",
	"requiere_revision" boolean DEFAULT false NOT NULL,
	"error" text,
	"duracion_ms" integer,
	"creado_en" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"usa_ia" boolean DEFAULT false NOT NULL,
	"radio_duplicado_m" integer DEFAULT 15 NOT NULL,
	"unidad_responsable" "unidad" NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categorias_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "categorias_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "configuracion" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"umbral_media" double precision DEFAULT 8 NOT NULL,
	"umbral_critica" double precision DEFAULT 20 NOT NULL,
	"umbral_alerta_respaldos" integer DEFAULT 10 NOT NULL,
	"vision_timeout_ms" integer DEFAULT 10000 NOT NULL,
	"actualizado_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos_historial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporte_id" uuid NOT NULL,
	"usuario_id" uuid,
	"tipo" "tipo_evento" NOT NULL,
	"estado_anterior" "estado_reporte",
	"estado_nuevo" "estado_reporte",
	"organismo_derivado" text,
	"comentario" text,
	"datos" jsonb,
	"creado_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folio_contadores" (
	"anio" integer PRIMARY KEY NOT NULL,
	"ultimo" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imagenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporte_id" uuid NOT NULL,
	"ruta" text NOT NULL,
	"tipo" "tipo_imagen" NOT NULL,
	"mime" text NOT NULL,
	"tamano_bytes" integer NOT NULL,
	"ancho" integer,
	"alto" integer,
	"creado_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"reporte_id" uuid,
	"tipo" text NOT NULL,
	"mensaje" text NOT NULL,
	"leida" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reportes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folio" text NOT NULL,
	"categoria_id" integer NOT NULL,
	"descripcion" varchar(500) NOT NULL,
	"ubicacion" geography(Point, 4326) NOT NULL,
	"origen_ubicacion" "origen_ubicacion" NOT NULL,
	"precision_m" double precision,
	"direccion_referencia" text,
	"territorio_id" integer NOT NULL,
	"encargado_id" uuid NOT NULL,
	"estado" "estado_reporte" DEFAULT 'ingresado' NOT NULL,
	"total_respaldo_vecinos" integer DEFAULT 0 NOT NULL,
	"fuera_de_territorio" boolean DEFAULT false NOT NULL,
	"duplicado_de_id" uuid,
	"motivo_rechazo" text,
	"organismo_derivado" text,
	"creado_en" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"cerrado_en" timestamp (3) with time zone,
	CONSTRAINT "reportes_folio_unique" UNIQUE("folio")
);
--> statement-breakpoint
CREATE TABLE "respaldos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporte_id" uuid NOT NULL,
	"encargado_id" uuid NOT NULL,
	"n_vecinos" integer NOT NULL,
	"canal" "canal_respaldo" NOT NULL,
	"nota" varchar(300),
	"creado_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territorios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"centroide" geography(Point, 4326),
	"poligono" geography(Polygon, 4326),
	"creado_en" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "territorios_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol" NOT NULL,
	"territorio_id" integer,
	"unidad" "unidad",
	"activo" boolean DEFAULT true NOT NULL,
	"debe_cambiar_password" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "analisis_ia" ADD CONSTRAINT "analisis_ia_reporte_id_reportes_id_fk" FOREIGN KEY ("reporte_id") REFERENCES "public"."reportes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analisis_ia" ADD CONSTRAINT "analisis_ia_imagen_id_imagenes_id_fk" FOREIGN KEY ("imagen_id") REFERENCES "public"."imagenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_historial" ADD CONSTRAINT "eventos_historial_reporte_id_reportes_id_fk" FOREIGN KEY ("reporte_id") REFERENCES "public"."reportes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_historial" ADD CONSTRAINT "eventos_historial_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imagenes" ADD CONSTRAINT "imagenes_reporte_id_reportes_id_fk" FOREIGN KEY ("reporte_id") REFERENCES "public"."reportes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_reporte_id_reportes_id_fk" FOREIGN KEY ("reporte_id") REFERENCES "public"."reportes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_territorio_id_territorios_id_fk" FOREIGN KEY ("territorio_id") REFERENCES "public"."territorios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_encargado_id_usuarios_id_fk" FOREIGN KEY ("encargado_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_duplicado_de_id_reportes_id_fk" FOREIGN KEY ("duplicado_de_id") REFERENCES "public"."reportes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "respaldos" ADD CONSTRAINT "respaldos_reporte_id_reportes_id_fk" FOREIGN KEY ("reporte_id") REFERENCES "public"."reportes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "respaldos" ADD CONSTRAINT "respaldos_encargado_id_usuarios_id_fk" FOREIGN KEY ("encargado_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_territorio_id_territorios_id_fk" FOREIGN KEY ("territorio_id") REFERENCES "public"."territorios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analisis_reporte_idx" ON "analisis_ia" USING btree ("reporte_id");--> statement-breakpoint
CREATE INDEX "eventos_reporte_fecha_idx" ON "eventos_historial" USING btree ("reporte_id","creado_en");--> statement-breakpoint
CREATE INDEX "eventos_tipo_fecha_idx" ON "eventos_historial" USING btree ("tipo","creado_en");--> statement-breakpoint
CREATE INDEX "imagenes_reporte_idx" ON "imagenes" USING btree ("reporte_id");--> statement-breakpoint
CREATE INDEX "notificaciones_usuario_leida_idx" ON "notificaciones" USING btree ("usuario_id","leida");--> statement-breakpoint
CREATE INDEX "reportes_estado_idx" ON "reportes" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "reportes_categoria_estado_idx" ON "reportes" USING btree ("categoria_id","estado");--> statement-breakpoint
CREATE INDEX "reportes_territorio_idx" ON "reportes" USING btree ("territorio_id");--> statement-breakpoint
CREATE INDEX "reportes_encargado_idx" ON "reportes" USING btree ("encargado_id");--> statement-breakpoint
CREATE INDEX "reportes_creado_idx" ON "reportes" USING btree ("creado_en");--> statement-breakpoint
CREATE INDEX "reportes_ubicacion_gist" ON "reportes" USING gist ("ubicacion");--> statement-breakpoint
CREATE INDEX "respaldos_reporte_idx" ON "respaldos" USING btree ("reporte_id");--> statement-breakpoint
CREATE INDEX "usuarios_rol_idx" ON "usuarios" USING btree ("rol");