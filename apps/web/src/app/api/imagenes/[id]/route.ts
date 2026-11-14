import { z } from 'zod';
import { db } from '@/db';
import { puede } from '@/domain/permisos';
import { conErrores, errores } from '@/server/api';
import { leerArchivo } from '@/server/almacenamiento';
import { requerirUsuarioApi } from '@/server/auth/session';
import { duenoImagen } from '@/server/reportes/consultas';
import { encargadoRespaldo } from '@/server/reportes/gestion';
import { esAbierto } from '@/domain/estados';

/**
 * GET /api/imagenes/{id} — entrega una foto si el usuario puede ver su reporte.
 * Las fotos no se sirven como archivos públicos: siempre pasan por este control.
 */
export const GET = conErrores(async (_req: Request, ctx: RouteContext<'/api/imagenes/[id]'>) => {
  const usuario = await requerirUsuarioApi();
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw errores.noEncontrado('La imagen');

  const img = await duenoImagen(db, id);
  if (!img) throw errores.noEncontrado('La imagen');
  // Funcionarios: todas. Encargados: las de sus reportes, las de reportes que respaldaron y las fotos
  // originales de reportes abiertos (se muestran al sugerir "Sumar respaldo", RF-4.2).
  let permitido = puede(usuario.rol, 'reporte:ver_todos');
  if (!permitido && puede(usuario.rol, 'reporte:ver_propios')) {
    permitido =
      img.encargadoId === usuario.id ||
      (img.tipo === 'original' && esAbierto(img.estado)) ||
      (await encargadoRespaldo(db, usuario.id, img.reporteId));
  }
  if (!permitido) throw errores.noEncontrado('La imagen');

  let contenido: Buffer;
  try {
    contenido = await leerArchivo(img.ruta);
  } catch {
    throw errores.noEncontrado('El archivo de la imagen');
  }

  return new Response(new Uint8Array(contenido), {
    headers: {
      'Content-Type': img.mime,
      'Content-Length': String(contenido.length),
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
