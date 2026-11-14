/**
 * Datos de ejemplo (RF-2.1). Todo es editable después desde la BD o, más
 * adelante, desde la vista de administración.
 *
 * Territorios: los mismos barrios que usa Soluciones Barriales. Los centroides
 * son APROXIMADOS (para la demo); se pueden afinar o agregar polígonos reales.
 */
import type { Rol, Unidad } from '../src/db/schema';

export const TERRITORIOS: Array<{ nombre: string; lat: number; lng: number }> = [
  { nombre: 'Lo Hermida', lat: -33.4745, lng: -70.5655 },
  { nombre: 'La Faena', lat: -33.4815, lng: -70.579 },
  { nombre: 'San Luis', lat: -33.4925, lng: -70.5705 },
  { nombre: 'Peñalolén Alto', lat: -33.487, lng: -70.542 },
  { nombre: 'Nuevo Peñalolén', lat: -33.5025, lng: -70.553 },
];

export const CATEGORIAS: Array<{
  nombre: string;
  slug: string;
  usaIa: boolean;
  radioDuplicadoM: number;
  unidadResponsable: Unidad;
  color: string;
}> = [
  { nombre: 'Bache', slug: 'bache', usaIa: true, radioDuplicadoM: 15, unidadResponsable: 'DOM', color: '#dc2626' },
  {
    nombre: 'Luminaria en falla',
    slug: 'luminaria',
    usaIa: false,
    radioDuplicadoM: 25,
    unidadResponsable: 'DOM',
    color: '#f59e0b',
  },
  {
    nombre: 'Poda de arbolado',
    slug: 'poda',
    usaIa: false,
    radioDuplicadoM: 20,
    unidadResponsable: 'DOM',
    color: '#16a34a',
  },
  {
    nombre: 'Retiro de escombros',
    slug: 'escombros',
    usaIa: false,
    radioDuplicadoM: 20,
    unidadResponsable: 'DIDECO',
    color: '#92400e',
  },
  {
    nombre: 'Tendido eléctrico',
    slug: 'tendido',
    usaIa: false,
    radioDuplicadoM: 30,
    unidadResponsable: 'DOM',
    color: '#7c3aed',
  },
  { nombre: 'Otro', slug: 'otro', usaIa: false, radioDuplicadoM: 15, unidadResponsable: 'DIDECO', color: '#64748b' },
];

/** Usuarios demo: 1 admin, 2 funcionarios y 3 encargados. Nombres ficticios. */
export const USUARIOS: Array<{
  nombre: string;
  email: string;
  rol: Rol;
  unidad?: Unidad;
  territorio?: string;
}> = [
  { nombre: 'Administración Demo', email: 'admin@penalolen.demo', rol: 'admin' },
  { nombre: 'Carolina Fuentes (DOM)', email: 'dom@penalolen.demo', rol: 'funcionario', unidad: 'DOM' },
  { nombre: 'Rodrigo Pizarro (DIDECO)', email: 'dideco@penalolen.demo', rol: 'funcionario', unidad: 'DIDECO' },
  { nombre: 'Marta Rojas', email: 'encargada.lafaena@penalolen.demo', rol: 'encargado', territorio: 'La Faena' },
  { nombre: 'Luis Contreras', email: 'encargado.lohermida@penalolen.demo', rol: 'encargado', territorio: 'Lo Hermida' },
  { nombre: 'Ana Muñoz', email: 'encargada.sanluis@penalolen.demo', rol: 'encargado', territorio: 'San Luis' },
];
