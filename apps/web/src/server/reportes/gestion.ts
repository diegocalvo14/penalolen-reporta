/**
 * Acciones sobre un reporte existente:
 *  - sumarRespaldo (encargado, RF-4.3)
 *  - cambiarEstado (funcionario/admin, §6, RF-4.4, RF-6.3)
 *  - comentar (funcionario/admin, RF-6.3)
 * Cada acción queda en EventoHistorial (RF-11.1) y avisa al encargado (RF-7.1).
 */
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/db';
import { categorias, eventosHistorial, imagenes, reportes, respaldos, type EstadoReporte } from '@/db/schema';
import { esAbierto, ESTADO_LABEL, validarCambioEstado } from '@/domain/estados';
import { parseFolio } from '@/domain/folio';
import { mensajeCambioEstado } from '@/domain/notificaciones';
import { errores } from '@/server/api';
import { borrarArchivo, guardarFoto } from '@/server/almacenamiento';
import type { ImagenProcesada } from '@/server/imagenes';
import { notificar } from '@/server/notificaciones';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function bloquearReporte(tx: Tx, id: string) {
  const [r] = await tx
    .select({
      id: reportes.id,
      folio: reportes.folio,
      estado: reportes.estado,
      encargadoId: reportes.encargadoId,
      total: reportes.totalRespaldoVecinos,
      categoria: categorias.nombre,
    })
    .from(reportes)
    .innerJoin(categorias, eq(categorias.id, reportes.categoriaId))
    .where(eq(reportes.id, id))
    .for('update', { of: reportes });
  return r ?? null;
}

const esUuid = (v: string) => z.string().uuid().safeParse(v).success;

// ------------------------------------------------------------------ Respaldo

export async function sumarRespaldo(
  db: Db,
  usuario: { id: string },
  reporteId: string,
  input: { nVecinos: number; canal: 'junta' | 'whatsapp' | 'presencial' | 'otro'; nota?: string },
) {
  if (!esUuid(reporteId)) throw errores.noEncontrado('El reporte');
  return db.transaction(async (tx) => {
    const r = await bloquearReporte(tx, reporteId);
    if (!r) throw errores.noEncontrado('El reporte');
    if (!esAbierto(r.estado)) {
      throw errores.conflicto('REPORTE_CERRADO', `El reporte ${r.folio} ya está ${ESTADO_LABEL[r.estado].toLowerCase()}; registra uno nuevo si el problema sigue.`);
    }

    await tx.insert(respaldos).values({
      reporteId,
      encargadoId: usuario.id,
      nVecinos: input.nVecinos,
      canal: input.canal,
      nota: input.nota ?? null,
    });
    const [act] = await tx
      .update(reportes)
      .set({ totalRespaldoVecinos: sql`${reportes.totalRespaldoVecinos} + ${input.nVecinos}` })
      .where(eq(reportes.id, reporteId))
      .returning({ total: reportes.totalRespaldoVecinos });

    await tx.insert(eventosHistorial).values({
      reporteId,
      usuarioId: usuario.id,
      tipo: 'respaldo',
      datos: { nVecinos: input.nVecinos, canal: input.canal, totalNuevo: act.total },
    });

    if (r.encargadoId !== usuario.id) {
      await notificar(tx, {
        usuarioId: r.encargadoId,
        reporteId,
        tipo: 'respaldo',
        mensaje: `Otro encargado sumó ${input.nVecinos} ${input.nVecinos === 1 ? 'vecino' : 'vecinos'} a tu reporte ${r.folio}. Total: ${act.total}.`,
      });
    }
    return { reporteId, folio: r.folio, totalRespaldoVecinos: act.total };
  });
}

// ------------------------------------------------------------------ Estados

export interface CambioEstado {
  estado: Exclude<EstadoReporte, 'ingresado'>;
  comentario?: string;
  organismo?: string;
  duplicadoDe?: string;
  motivo?: string;
}

async function resolverOriginal(db: Db, ref: string | undefined): Promise<{ id: string; folio: string } | null> {
  if (!ref) return null;
  const condicion = esUuid(ref) ? eq(reportes.id, ref) : parseFolio(ref) ? eq(reportes.folio, ref.trim().toUpperCase()) : null;
  if (!condicion) throw errores.invalido(`"${ref}" no es un folio válido (ejemplo: PR-2026-00042).`);
  const [o] = await db.select({ id: reportes.id, folio: reportes.folio }).from(reportes).where(condicion).limit(1);
  if (!o) throw errores.invalido(`No existe el reporte ${ref}.`);
  return o;
}

export async function cambiarEstado(
  db: Db,
  usuario: { id: string },
  reporteId: string,
  input: CambioEstado,
  fotoCierre: ImagenProcesada | null = null,
) {
  if (!esUuid(reporteId)) throw errores.noEncontrado('El reporte');
  if (fotoCierre && input.estado !== 'resuelto') throw errores.invalido('La foto de evidencia solo se adjunta al cerrar.');

  const original = input.estado === 'duplicado' ? await resolverOriginal(db, input.duplicadoDe) : null;
  const rutaFoto = fotoCierre ? await guardarFoto(fotoCierre.buffer) : null;

  try {
    return await db.transaction(async (tx) => {
      const r = await bloquearReporte(tx, reporteId);
      if (!r) throw errores.noEncontrado('El reporte');

      const v = validarCambioEstado({
        reporteId,
        desde: r.estado,
        hacia: input.estado,
        comentario: input.comentario,
        organismo: input.organismo,
        duplicadoDe: original?.id ?? input.duplicadoDe,
        motivo: input.motivo,
      });
      if (!v.ok) {
        throw v.code === 'TRANSICION_INVALIDA' ? errores.conflicto(v.code, v.message) : errores.invalido(v.message);
      }

      const ahora = new Date();
      const cambios: Partial<typeof reportes.$inferInsert> = { estado: input.estado };
      const datos: Record<string, unknown> = {};

      if (input.estado === 'derivado') cambios.organismoDerivado = input.organismo!;
      if (input.estado === 'rechazado') cambios.motivoRechazo = input.motivo!;
      if (input.estado === 'resuelto' || input.estado === 'duplicado' || input.estado === 'rechazado') cambios.cerradoEn = ahora;

      if (input.estado === 'duplicado' && original) {
        const o = await bloquearReporte(tx, original.id);
        if (!o || !esAbierto(o.estado)) {
          throw errores.conflicto('ORIGINAL_CERRADO', `El reporte original ${original.folio} no está abierto.`);
        }
        // RF-4.4: los respaldos pasan al original
        await tx.update(respaldos).set({ reporteId: o.id }).where(eq(respaldos.reporteId, reporteId));
        const [{ suma }] = await tx
          .select({ suma: sql<number>`COALESCE(SUM(${respaldos.nVecinos}), 0)::int` })
          .from(respaldos)
          .where(eq(respaldos.reporteId, o.id));
        await tx.update(reportes).set({ totalRespaldoVecinos: suma }).where(eq(reportes.id, o.id));
        await tx.insert(eventosHistorial).values({
          reporteId: o.id,
          usuarioId: usuario.id,
          tipo: 'respaldo',
          comentario: `Se sumaron los respaldos del reporte duplicado ${r.folio}.`,
          datos: { desdeDuplicado: r.folio, nVecinos: r.total, totalNuevo: suma },
        });
        cambios.duplicadoDeId = o.id;
        cambios.totalRespaldoVecinos = 0;
        datos.duplicadoDe = o.folio;
        datos.respaldosTraspasados = r.total;
      }

      await tx.update(reportes).set(cambios).where(eq(reportes.id, reporteId));

      if (rutaFoto && fotoCierre) {
        const [img] = await tx
          .insert(imagenes)
          .values({
            reporteId,
            ruta: rutaFoto,
            tipo: 'cierre',
            mime: fotoCierre.mime,
            tamanoBytes: fotoCierre.buffer.length,
            ancho: fotoCierre.ancho,
            alto: fotoCierre.alto,
          })
          .returning({ id: imagenes.id });
        datos.imagenCierreId = img.id;
      }

      await tx.insert(eventosHistorial).values({
        reporteId,
        usuarioId: usuario.id,
        tipo: input.estado === 'derivado' ? 'derivado' : input.estado === 'resuelto' ? 'cierre' : 'estado',
        estadoAnterior: r.estado,
        estadoNuevo: input.estado,
        organismoDerivado: input.estado === 'derivado' ? input.organismo! : null,
        comentario: input.estado === 'rechazado' ? input.motivo! : (input.comentario ?? null),
        datos: Object.keys(datos).length ? datos : null,
        creadoEn: ahora,
      });

      await notificar(tx, {
        usuarioId: r.encargadoId,
        reporteId,
        tipo: 'estado',
        mensaje: mensajeCambioEstado(r.folio, r.categoria, input.estado, {
          organismo: input.organismo,
          motivo: input.motivo,
          folioOriginal: original?.folio,
        }),
      });

      return { id: reporteId, folio: r.folio, estadoAnterior: r.estado, estado: input.estado };
    });
  } catch (err) {
    if (rutaFoto) await borrarArchivo(rutaFoto).catch(() => undefined);
    throw err;
  }
}

// ------------------------------------------------------------------ Comentarios

export async function comentar(db: Db, usuario: { id: string }, reporteId: string, comentario: string) {
  if (!esUuid(reporteId)) throw errores.noEncontrado('El reporte');
  const [r] = await db
    .select({ folio: reportes.folio, encargadoId: reportes.encargadoId })
    .from(reportes)
    .where(eq(reportes.id, reporteId))
    .limit(1);
  if (!r) throw errores.noEncontrado('El reporte');

  await db.transaction(async (tx) => {
    await tx.insert(eventosHistorial).values({ reporteId, usuarioId: usuario.id, tipo: 'comentario', comentario });
    await notificar(tx, {
      usuarioId: r.encargadoId,
      reporteId,
      tipo: 'comentario',
      mensaje: `La municipalidad comentó tu reporte ${r.folio}.`,
    });
  });
  return { ok: true };
}

/** ¿El encargado respaldó este reporte (sin ser su autor)? */
export async function encargadoRespaldo(db: Db, encargadoId: string, reporteId: string): Promise<boolean> {
  const [f] = await db
    .select({ id: respaldos.id })
    .from(respaldos)
    .where(and(eq(respaldos.reporteId, reporteId), eq(respaldos.encargadoId, encargadoId)))
    .limit(1);
  return Boolean(f);
}

