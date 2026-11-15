/**
 * Roles y permisos (PROMPT_DESARROLLO §4). Los permisos se validan SIEMPRE en el
 * servidor; la interfaz solo oculta lo que el usuario no puede hacer.
 */
import type { Rol } from '@/db/schema';

export const ROLES: readonly Rol[] = ['encargado', 'funcionario', 'admin'] as const;

export const ROL_LABEL: Record<Rol, string> = {
  encargado: 'Encargado barrial',
  funcionario: 'Funcionario municipal',
  admin: 'Administrador',
};

export type Accion =
  | 'reporte:crear' // crear reporte y sumar respaldo
  | 'reporte:ver_propios'
  | 'reporte:ver_todos' // bandeja completa y mapa
  | 'reporte:gestionar' // cambiar estado, derivar, cerrar, duplicado, rechazado
  | 'analisis:reintentar'
  | 'analisis:cambiar_motor'
  | 'copiloto:usar'
  | 'metricas:ver'
  | 'admin:gestionar'; // usuarios, territorios, categorías y umbrales

const PERMISOS: Record<Rol, readonly Accion[]> = {
  encargado: ['reporte:crear', 'reporte:ver_propios'],
  funcionario: ['reporte:ver_todos', 'reporte:gestionar', 'analisis:reintentar', 'copiloto:usar', 'metricas:ver'],
  admin: [
    'reporte:ver_todos',
    'reporte:gestionar',
    'analisis:reintentar',
    'analisis:cambiar_motor',
    'copiloto:usar',
    'metricas:ver',
    'admin:gestionar',
  ],
};

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}

export function puede(rol: Rol, accion: Accion): boolean {
  return PERMISOS[rol].includes(accion);
}

/** Página de inicio de cada rol después del login. */
export function rutaInicio(rol: Rol): string {
  switch (rol) {
    case 'encargado':
      return '/encargado';
    case 'funcionario':
      return '/panel';
    case 'admin':
      return '/admin';
  }
}

/**
 * Secciones de la app y los roles que pueden entrar. Lo usa proxy.ts para
 * redirigir temprano y los layouts para validar de nuevo en el servidor.
 */
export const SECCIONES: ReadonlyArray<{ prefijo: string; roles: readonly Rol[] }> = [
  { prefijo: '/encargado', roles: ['encargado'] },
  { prefijo: '/panel', roles: ['funcionario', 'admin'] },
  { prefijo: '/copiloto', roles: ['funcionario', 'admin'] },
  { prefijo: '/admin', roles: ['admin'] },
];

export function rolesDeRuta(pathname: string): readonly Rol[] | null {
  const seccion = SECCIONES.find((s) => pathname === s.prefijo || pathname.startsWith(`${s.prefijo}/`));
  return seccion ? seccion.roles : null;
}

export function puedeEntrar(rol: Rol, pathname: string): boolean {
  const roles = rolesDeRuta(pathname);
  return roles === null || roles.includes(rol);
}
