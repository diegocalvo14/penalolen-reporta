import { NextResponse } from 'next/server';
import { db } from '@/db';
import { CambioEstadoSchema, FOTO_MAX_BYTES } from '@/domain/reporte-input';
import { ApiError, conErrores, errores, leerJson } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { ImagenInvalidaError, procesarImagen, type ImagenProcesada } from '@/server/imagenes';
import { cambiarEstado } from '@/server/reportes/gestion';

/**
 * PATCH /api/reportes/{id}/estado — funcionario/admin (§6).
 * JSON { estado, comentario?, organismo?, duplicadoDe?, motivo? }, o multipart
 * con los mismos campos + "foto" para cerrar con evidencia.
 * Transición no permitida → 409. Datos faltantes → 400.
 */
export const PATCH = conErrores(async (req: Request, ctx: RouteContext<'/api/reportes/[id]/estado'>) => {
  const usuario = await requerirUsuarioApi('reporte:gestionar');
  const { id } = await ctx.params;

  let cuerpo: unknown;
  let foto: ImagenProcesada | null = null;
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    if (Number(req.headers.get('content-length') ?? 0) > FOTO_MAX_BYTES + 1024 * 1024) {
      throw new ApiError(413, 'ARCHIVO_DEMASIADO_GRANDE', 'La foto supera el máximo de 10 MB.');
    }
    const form = await req.formData();
    const campos: Record<string, FormDataEntryValue> = {};
    form.forEach((v, k) => {
      if (k !== 'foto') campos[k] = v;
    });
    cuerpo = campos;
    const archivo = form.get('foto');
    if (archivo instanceof File && archivo.size > 0) {
      try {
        foto = await procesarImagen(Buffer.from(await archivo.arrayBuffer()));
      } catch (err) {
        if (err instanceof ImagenInvalidaError) throw errores.invalido(err.message);
        throw err;
      }
    }
  } else {
    cuerpo = await leerJson(req);
  }

  const input = CambioEstadoSchema.parse(cuerpo);
  const r = await cambiarEstado(db, usuario, id, input, foto);
  return NextResponse.json(r);
});
