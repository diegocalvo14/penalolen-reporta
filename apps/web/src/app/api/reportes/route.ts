import { after, NextResponse } from 'next/server';
import { db } from '@/db';
import { leerFiltros } from '@/domain/filtros-bandeja';
import { FOTO_MAX_BYTES, NuevoReporteSchema } from '@/domain/reporte-input';
import { conErrores, errores, ApiError } from '@/server/api';
import { requerirUsuarioApi } from '@/server/auth/session';
import { ImagenInvalidaError, procesarImagen, type ImagenProcesada } from '@/server/imagenes';
import { listarBandeja } from '@/server/reportes/consultas';
import { crearReporte } from '@/server/reportes/crear';
import { procesarAnalisis } from '@/server/vision';

/**
 * POST /api/reportes — el encargado registra un reporte (RF-3.1).
 * multipart/form-data: categoriaId, descripcion, lat, lng, origen, precision?,
 * direccionReferencia?, nVecinos, canal, foto? (obligatoria si la categoría usa IA)
 * → 201 { id, folio, estado, analisis: { estado: "pendiente" } | null, ... }
 */
export const POST = conErrores(async (req: Request) => {
  const usuario = await requerirUsuarioApi('reporte:crear');

  const largo = Number(req.headers.get('content-length') ?? 0);
  if (largo > FOTO_MAX_BYTES + 1024 * 1024) {
    throw new ApiError(413, 'ARCHIVO_DEMASIADO_GRANDE', 'La foto supera el máximo de 10 MB.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw errores.invalido('Se esperaba un formulario multipart/form-data.');
  }

  const campos: Record<string, FormDataEntryValue> = {};
  form.forEach((valor, clave) => {
    if (clave !== 'foto') campos[clave] = valor;
  });
  const input = NuevoReporteSchema.parse(campos);

  let foto: ImagenProcesada | null = null;
  const archivo = form.get('foto');
  if (archivo instanceof File && archivo.size > 0) {
    try {
      foto = await procesarImagen(Buffer.from(await archivo.arrayBuffer()));
    } catch (err) {
      if (err instanceof ImagenInvalidaError) throw errores.invalido(err.message);
      throw err;
    }
  }

  const creado = await crearReporte(db, { id: usuario.id, territorioId: usuario.territorioId }, input, foto);

  // RF-5.1: el reporte ya quedó guardado; la visión corre después de responder,
  // así el encargado no espera a la IA. La app consulta el resultado en el detalle.
  if (creado.analisis) {
    const analisisId = creado.analisis.id;
    after(() => procesarAnalisis(db, analisisId));
  }
  return NextResponse.json(creado, { status: 201 });
});

/** GET /api/reportes — bandeja municipal con filtros, orden y paginación (RF-6.1). */
export const GET = conErrores(async (req: Request) => {
  await requerirUsuarioApi('reporte:ver_todos');
  const filtros = leerFiltros(new URL(req.url).searchParams);
  const resultado = await listarBandeja(db, filtros);
  return NextResponse.json({ ...resultado, pagina: filtros.pagina });
});
