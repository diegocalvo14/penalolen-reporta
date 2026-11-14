import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { categorias, reportes } from '@/db/schema';
import { ESTADO_LABEL } from '@/domain/estados';
import { requerirUsuarioPagina } from '@/server/auth/session';
import ChatCopiloto from './ChatCopiloto';

export const metadata = { title: 'Copiloto · Peñalolén Reporta' };

/** Copiloto (M8). Con ?reporte=<id> abre con el contexto de ese reporte (RF-6.5 y RF-8.2). */
export default async function Copiloto({ searchParams }: PageProps<'/copiloto'>) {
  const usuario = await requerirUsuarioPagina(['funcionario', 'admin'], '/copiloto');
  const { reporte } = await searchParams;
  const id = typeof reporte === 'string' && z.string().uuid().safeParse(reporte).success ? reporte : null;

  let contexto: { id: string; folio: string; categoria: string; estado: string } | null = null;
  if (id) {
    const [r] = await db
      .select({ id: reportes.id, folio: reportes.folio, categoria: categorias.nombre, estado: reportes.estado })
      .from(reportes)
      .innerJoin(categorias, eq(categorias.id, reportes.categoriaId))
      .where(eq(reportes.id, id))
      .limit(1);
    if (r) contexto = { ...r, estado: ESTADO_LABEL[r.estado] };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Copiloto</h1>
        <p className="text-sm text-slate-500">
          Asistente con IA local: dudas normativas y del procedimiento, métricas del trabajo y borradores de respuesta. No modifica datos.
        </p>
      </div>
      <ChatCopiloto contexto={contexto} unidad={usuario.unidad} />
    </div>
  );
}
