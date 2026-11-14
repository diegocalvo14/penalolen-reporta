/**
 * Bloque [REFERENCIAS] del copiloto (RF-8.4).
 *
 * ⚠️ BORRADOR PARA VALIDAR: lo redactó el equipo de desarrollo con fuentes
 * públicas (MINVU, BCN, Cámara de Diputados). Antes de la demo, el equipo debe
 * revisarlo y reemplazar o completar con los textos oficiales que entregue la
 * DOM/DIDECO. El copiloto responde SOLO con lo que esté aquí; si algo no está,
 * lo dice y recomienda verificar con la DOM.
 *
 * Mantener los textos breves: todo este bloque viaja en cada consulta al LLM.
 */
export const REFERENCIAS = `
## 1. Ley N° 8.946 de Pavimentación Comunal (texto definitivo de 1949, con modificaciones)
- Regula la pavimentación de calles y pasajes en las comunas. Los Servicios de Vivienda y Urbanización (SERVIU) aprueban proyectos, inspeccionan y reciben obras de pavimentación.
- Reparaciones de emergencia (artículo 77 bis, incorporado en 2018): una municipalidad puede ejecutar obras provisorias de emergencia en calzadas, veredas o ciclovías sin que el SERVIU apruebe el proyecto ni inspeccione o reciba las obras. El MINVU informó que esto aplica a "eventos" de hasta 20 m².
- La calificación de una obra como provisoria de emergencia la hace la Dirección de Obras Municipales (DOM) antes de iniciarla; una vez ejecutada, se informa al SERVIU respectivo.
- La ejecución debe seguir las especificaciones técnicas para reparación de pavimentos del Código de Normas y Especificaciones Técnicas de Obras de Pavimentación del MINVU.
- Reparaciones mayores, recapados o proyectos en vías estructurantes: requieren proyecto y coordinación con el SERVIU.

## 2. Ley N° 18.695, Orgánica Constitucional de Municipalidades
- Artículo 24: funciones de la unidad encargada de obras municipales (DOM), entre ellas velar por el cumplimiento de la Ley General de Urbanismo y Construcciones y fiscalizar obras en la comuna.
- Artículo 22: funciones de la unidad encargada del desarrollo comunitario (DIDECO), entre ellas asesorar al alcalde y al concejo en la promoción del desarrollo comunitario y prestar asesoría técnica a las organizaciones comunitarias.
- Artículo 25: funciones de la unidad de aseo y ornato (aseo de vías públicas, mantención de áreas verdes, extracción de basura).

## 3. Competencias por categoría en Peñalolén Reporta (configuración actual de la plataforma)
- Bache: DOM (reparación de emergencia según el art. 77 bis de la Ley 8.946; casos mayores, coordinación con SERVIU).
- Luminaria en falla: DOM; si la falla es de la red eléctrica, se deriva a la empresa eléctrica.
- Poda de arbolado: DOM / unidad de áreas verdes.
- Retiro de escombros: DIDECO (coordinación con aseo y ornato).
- Tendido eléctrico: se deriva a la empresa eléctrica.
- Otro: DIDECO evalúa y deriva.

## 4. Procedimiento interno de Peñalolén Reporta
- Los vecinos NO tienen cuenta: informan los problemas a su encargado barrial (junta de vecinos, WhatsApp, en persona). El encargado los registra en la plataforma con foto y ubicación.
- Antes de crear un reporte, la plataforma busca reportes abiertos cercanos de la misma categoría (por ejemplo, 15 m para baches) y sugiere "sumar respaldo" en vez de duplicar. El respaldo vecinal indica cuántos vecinos piden lo mismo.
- Para baches, el servicio de visión (YOLOv8) sugiere una severidad según el porcentaje de la foto cubierto por el bache: baja < 8 %, media 8–20 %, crítica > 20 % (umbrales configurables por el administrador). Es solo una sugerencia; la decisión es del funcionario.
- Estados del reporte: Ingresado → En revisión → En gestión → Resuelto. Desde En gestión se puede Derivar (indicando el organismo) y luego Resolver. Desde En revisión se puede marcar Duplicado (sus respaldos pasan al original) o Rechazado (con motivo obligatorio).
- Para cerrar como Resuelto se exige un comentario de cierre y, si es posible, una foto de evidencia.
- Cada cambio queda en el historial y el encargado recibe una notificación. El encargado puede compartir con sus vecinos el estado del reporte mediante la consulta pública por folio.
- La plataforma no compromete plazos de atención: los define la DOM.
`.trim();
