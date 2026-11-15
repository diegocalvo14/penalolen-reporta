import { describe, expect, it } from 'vitest';
import { esLlamadaHerramienta, MARCA_PLAZO, necesitaMetricas, quitarDatosPersonales, sanearPlazos, systemPrompt } from './prompt';

describe('sanearPlazos (RF-8.5: el copiloto nunca menciona plazos)', () => {
  it.each([
    'La cuadrilla acudirá en 24 a 48 horas.',
    'Se programará dentro de 5 días hábiles.',
    'Tiene un plazo estimado de 10 días.',
    'Se repara en un plazo máximo de 3 semanas.',
    'Criterio: 24–48 horas para baches críticos.',
    'Estará listo en los próximos dos días.',
    'Se atenderá antes de 72 horas.',
  ])('oculta el plazo en: %s', (frase) => {
    const r = sanearPlazos(frase);
    expect(r.texto).toContain(MARCA_PLAZO);
    expect(r.reemplazos).toBeGreaterThan(0);
    expect(r.texto).not.toMatch(/\d+\s*(horas|días|semanas)/);
  });

  it.each([
    'El tiempo promedio en gestión es de 12 horas.',
    'El reporte fue creado hace 3 días.',
    'Lleva 5 días en revisión.',
    'Históricamente demoró 2 días en resolverse.',
    'Hay 4 reportes abiertos en La Faena.',
  ])('respeta estadísticas y datos que no son plazos: %s', (frase) => {
    expect(sanearPlazos(frase)).toEqual({ texto: frase, reemplazos: 0 });
  });
});

describe('quitarDatosPersonales', () => {
  it('omite correos, teléfonos y RUT', () => {
    const t = quitarDatosPersonales('Llamar a juan@mail.cl o al +56 9 1234 5678, RUT 12.345.678-9');
    expect(t).not.toMatch(/juan@mail|1234 5678|12\.345\.678/);
    expect(t).toContain('[correo omitido]');
    expect(t).toContain('[teléfono omitido]');
    expect(t).toContain('[RUT omitido]');
  });
});

describe('necesitaMetricas (RF-8.3)', () => {
  it('detecta preguntas sobre el trabajo', () => {
    expect(necesitaMetricas('¿Cuántos baches críticos hay abiertos en La Faena?')).toBe(true);
    expect(necesitaMetricas('¿Qué territorio tiene más reportes este mes?')).toBe(true);
    expect(necesitaMetricas('¿Cuánto demora en promedio la etapa En gestión?')).toBe(true);
  });
  it('no las agrega a dudas normativas', () => {
    expect(necesitaMetricas('¿Qué dice la ley sobre el bacheo de emergencia?')).toBe(false);
  });
});

describe('esLlamadaHerramienta (Llama 3.1 a veces responde con JSON de función)', () => {
  it('detecta llamadas a función en JSON, con o sin bloque de código', () => {
    expect(esLlamadaHerramienta('{"name": "responder_reporte", "parameters": {"folio": "PR-2026-00001", "estado": "En revisión"}}')).toBe(true);
    expect(esLlamadaHerramienta('```json\n{"name": "obtener_metricas", "parameters": {"filtro": "por_territorio"}}\n```')).toBe(true);
    expect(esLlamadaHerramienta('<|python_tag|>{"function": "x", "arguments": {}}')).toBe(true);
  });
  it('no confunde texto normal', () => {
    expect(esLlamadaHerramienta('Borrador para revisión del funcionario: el reporte está en revisión.')).toBe(false);
    expect(esLlamadaHerramienta('Hay 3 reportes abiertos en La Faena {según las métricas}.')).toBe(false);
    expect(esLlamadaHerramienta('{"total": 3}')).toBe(false);
  });
});

describe('systemPrompt', () => {
  it('incluye las referencias y las reglas obligatorias', () => {
    const p = systemPrompt();
    expect(p).toContain('[REFERENCIAS]');
    expect(p).toContain('77 bis');
    expect(p).toContain(MARCA_PLAZO);
    expect(p).toMatch(/No puedes modificar datos/);
    expect(p).toMatch(/NUNCA respondas con JSON/);
  });
});
