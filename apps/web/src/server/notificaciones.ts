/** Notificaciones internas (RF-7.1): campana con contador para el encargado. */
import { and, count, desc, eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { notificaciones, reportes } from '@/db/schema';

export type DbOTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export async function notificar(
  db: DbOTx,
  n: { usuarioId: string; reporteId?: string | null; tipo: string; mensaje: string },
): Promise<void> {
  await db.insert(notificaciones).values({
    usuarioId: n.usuarioId,
    reporteId: n.reporteId ?? null,
    tipo: n.tipo,
    mensaje: n.mensaje,
  });
}

export async function listarNotificaciones(db: Db, usuarioId: string, limite = 30) {
  const [items, [{ noLeidas }]] = await Promise.all([
    db
      .select({
        id: notificaciones.id,
        tipo: notificaciones.tipo,
        mensaje: notificaciones.mensaje,
        leida: notificaciones.leida,
        creadoEn: notificaciones.creadoEn,
        reporteId: notificaciones.reporteId,
        folio: reportes.folio,
      })
      .from(notificaciones)
      .leftJoin(reportes, eq(reportes.id, notificaciones.reporteId))
      .where(eq(notificaciones.usuarioId, usuarioId))
      .orderBy(desc(notificaciones.creadoEn))
      .limit(limite),
    db
      .select({ noLeidas: count() })
      .from(notificaciones)
      .where(and(eq(notificaciones.usuarioId, usuarioId), eq(notificaciones.leida, false))),
  ]);
  return { items, noLeidas };
}

/** Marca como leída una notificación propia, o todas con id = "todas". Devuelve cuántas cambió. */
export async function marcarLeida(db: Db, usuarioId: string, id: string): Promise<number> {
  const condicion =
    id === 'todas'
      ? and(eq(notificaciones.usuarioId, usuarioId), eq(notificaciones.leida, false))
      : and(eq(notificaciones.usuarioId, usuarioId), eq(notificaciones.id, id));
  const filas = await db.update(notificaciones).set({ leida: true }).where(condicion).returning({ id: notificaciones.id });
  return filas.length;
}
