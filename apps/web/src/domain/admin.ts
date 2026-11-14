/** Validaciones de la administración (RF-1.3, RF-1.4, RF-2.2). */
import { z } from 'zod';

const vacioANull = (v: unknown) => (v === '' || v === undefined ? null : v);

export const PASSWORD_MIN = 8;

export const NuevoUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
    rol: z.enum(['encargado', 'funcionario', 'admin']),
    territorioId: z.preprocess(vacioANull, z.coerce.number().int().positive().nullable()),
    unidad: z.preprocess(vacioANull, z.enum(['DOM', 'DIDECO']).nullable()),
  })
  .superRefine((u, ctx) => {
    if (u.rol === 'encargado' && !u.territorioId) ctx.addIssue({ code: 'custom', path: ['territorioId'], message: 'Un encargado necesita un territorio.' });
    if (u.rol === 'funcionario' && !u.unidad) ctx.addIssue({ code: 'custom', path: ['unidad'], message: 'Un funcionario necesita una unidad (DOM o DIDECO).' });
  });

export const EditarUsuarioSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  rol: z.enum(['encargado', 'funcionario', 'admin']).optional(),
  territorioId: z.preprocess(vacioANull, z.coerce.number().int().positive().nullable()).optional(),
  unidad: z.preprocess(vacioANull, z.enum(['DOM', 'DIDECO']).nullable()).optional(),
  activo: z.boolean().optional(),
  /** true: genera una contraseña temporal nueva y obliga a cambiarla al entrar */
  resetPassword: z.boolean().optional(),
});

export const ConfiguracionSchema = z.object({
  umbralMedia: z.coerce.number().positive().max(100),
  umbralCritica: z.coerce.number().positive().max(100),
  umbralAlertaRespaldos: z.coerce.number().int().min(1).max(10000),
  visionTimeoutMs: z.coerce.number().int().min(1000).max(120000),
});

export const EditarCategoriaSchema = z.object({
  nombre: z.string().trim().min(2).max(60).optional(),
  radioDuplicadoM: z.coerce.number().int().min(1).max(500).optional(),
  usaIa: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: 'Color en formato #RRGGBB.' }).optional(),
  unidadResponsable: z.enum(['DOM', 'DIDECO']).optional(),
  activa: z.boolean().optional(),
});

export const TerritorioSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const CambioClaveSchema = z
  .object({
    actual: z.string().min(1, { message: 'Ingresa tu contraseña actual.' }).max(200),
    nueva: z.string().min(PASSWORD_MIN, { message: `La nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres.` }).max(200),
  })
  .refine((d) => d.actual !== d.nueva, { message: 'La nueva contraseña debe ser distinta de la actual.', path: ['nueva'] });

/** Contraseña temporal legible (sin caracteres ambiguos como 0/O o 1/l). */
export function generarClaveTemporal(largo = 10): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}
