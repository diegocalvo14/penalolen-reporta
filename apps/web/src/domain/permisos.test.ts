import { describe, expect, it } from 'vitest';
import { esRol, puede, puedeEntrar, rutaInicio } from './permisos';

describe('matriz de permisos (§4)', () => {
  it('solo el encargado crea reportes y suma respaldo', () => {
    expect(puede('encargado', 'reporte:crear')).toBe(true);
    expect(puede('funcionario', 'reporte:crear')).toBe(false);
    expect(puede('admin', 'reporte:crear')).toBe(false);
  });

  it('el encargado no ve la bandeja completa ni gestiona estados', () => {
    expect(puede('encargado', 'reporte:ver_todos')).toBe(false);
    expect(puede('encargado', 'reporte:gestionar')).toBe(false);
    expect(puede('encargado', 'copiloto:usar')).toBe(false);
  });

  it('funcionario y admin gestionan reportes y usan el copiloto', () => {
    for (const rol of ['funcionario', 'admin'] as const) {
      expect(puede(rol, 'reporte:ver_todos')).toBe(true);
      expect(puede(rol, 'reporte:gestionar')).toBe(true);
      expect(puede(rol, 'copiloto:usar')).toBe(true);
      expect(puede(rol, 'metricas:ver')).toBe(true);
    }
  });

  it('solo el admin gestiona usuarios/umbrales y cambia el motor de visión', () => {
    expect(puede('admin', 'admin:gestionar')).toBe(true);
    expect(puede('funcionario', 'admin:gestionar')).toBe(false);
    expect(puede('admin', 'analisis:cambiar_motor')).toBe(true);
    expect(puede('funcionario', 'analisis:cambiar_motor')).toBe(false);
  });
});

describe('acceso a secciones', () => {
  it('cada rol entra a su sección', () => {
    expect(puedeEntrar('encargado', '/encargado/nuevo')).toBe(true);
    expect(puedeEntrar('funcionario', '/panel')).toBe(true);
    expect(puedeEntrar('admin', '/panel/reportes/1')).toBe(true);
    expect(puedeEntrar('admin', '/admin')).toBe(true);
  });

  it('bloquea las secciones de otros roles', () => {
    expect(puedeEntrar('encargado', '/panel')).toBe(false);
    expect(puedeEntrar('encargado', '/copiloto')).toBe(false);
    expect(puedeEntrar('funcionario', '/admin')).toBe(false);
    expect(puedeEntrar('funcionario', '/encargado')).toBe(false);
  });

  it('no confunde prefijos parecidos', () => {
    expect(puedeEntrar('encargado', '/paneles-publicos')).toBe(true);
  });

  it('las rutas públicas quedan abiertas', () => {
    expect(puedeEntrar('encargado', '/login')).toBe(true);
  });

  it('rutaInicio y esRol', () => {
    expect(rutaInicio('encargado')).toBe('/encargado');
    expect(rutaInicio('funcionario')).toBe('/panel');
    expect(rutaInicio('admin')).toBe('/admin');
    expect(esRol('vecino')).toBe(false);
    expect(esRol('admin')).toBe(true);
  });
});
