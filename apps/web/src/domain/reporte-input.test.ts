import { describe, expect, it } from 'vitest';
import { leerFiltros } from './filtros-bandeja';
import { NuevoReporteSchema } from './reporte-input';

const valido = {
  categoriaId: '1',
  descripcion: 'Bache grande frente al paradero',
  lat: '-33.4812',
  lng: '-70.5785',
  origen: 'gps',
  precision: '8',
  nVecinos: '6',
  canal: 'whatsapp',
  direccionReferencia: '',
};

describe('NuevoReporteSchema (RF-3.1)', () => {
  it('acepta un formulario completo y convierte los números', () => {
    const r = NuevoReporteSchema.parse(valido);
    expect(r).toMatchObject({ categoriaId: 1, lat: -33.4812, nVecinos: 6, precision: 8 });
    expect(r.direccionReferencia).toBeUndefined(); // "" → sin dirección
  });

  it('limita la descripción a 500 caracteres', () => {
    expect(NuevoReporteSchema.safeParse({ ...valido, descripcion: 'x'.repeat(500) }).success).toBe(true);
    expect(NuevoReporteSchema.safeParse({ ...valido, descripcion: 'x'.repeat(501) }).success).toBe(false);
  });

  it('exige una descripción mínima', () => {
    expect(NuevoReporteSchema.safeParse({ ...valido, descripcion: '   ab ' }).success).toBe(false);
  });

  it('exige al menos 1 vecino y número entero', () => {
    expect(NuevoReporteSchema.safeParse({ ...valido, nVecinos: '0' }).success).toBe(false);
    expect(NuevoReporteSchema.safeParse({ ...valido, nVecinos: '2.5' }).success).toBe(false);
  });

  it('rechaza canal u origen desconocidos', () => {
    expect(NuevoReporteSchema.safeParse({ ...valido, canal: 'telegram' }).success).toBe(false);
    expect(NuevoReporteSchema.safeParse({ ...valido, origen: 'ip' }).success).toBe(false);
  });

  it('GPS sin precisión no es válido; mapa sin precisión sí', () => {
    expect(NuevoReporteSchema.safeParse({ ...valido, precision: '' }).success).toBe(false);
    expect(NuevoReporteSchema.safeParse({ ...valido, origen: 'mapa', precision: '' }).success).toBe(true);
  });

  it('rechaza coordenadas fuera de rango', () => {
    expect(NuevoReporteSchema.safeParse({ ...valido, lat: '-95' }).success).toBe(false);
    expect(NuevoReporteSchema.safeParse({ ...valido, lng: 'abc' }).success).toBe(false);
  });
});

describe('leerFiltros (RF-6.1)', () => {
  it('valores por defecto', () => {
    expect(leerFiltros({})).toEqual({ orden: 'recientes', pagina: 1, destacados: false });
  });

  it('lee filtros válidos desde la URL', () => {
    const f = leerFiltros(new URLSearchParams('estado=abiertos&categoria=1&territorio=2&severidad=critica&orden=respaldos&pagina=3&destacados=1'));
    expect(f).toEqual({
      estado: 'abiertos',
      categoria: 1,
      territorio: 2,
      severidad: 'critica',
      orden: 'respaldos',
      pagina: 3,
      destacados: true,
    });
  });

  it('descarta solo el campo inválido, no todo el filtro', () => {
    const f = leerFiltros({ estado: 'inventado', categoria: '1', orden: 'nada', pagina: '-2' });
    expect(f).toEqual({ categoria: 1, orden: 'recientes', pagina: 1, destacados: false });
  });
});
