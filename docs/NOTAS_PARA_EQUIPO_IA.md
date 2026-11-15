# Notas para el equipo IA (Soluciones Barriales) antes de la fusión

Integramos sus piezas en `penalolen-reporta` **sin modificar su repositorio**. Esto es lo que encontramos y cómo lo resolvimos en el nuestro:

1. **El copiloto mencionaba plazos.** Su system prompt decía "cuadrilla en 24–48 horas" y "5–10 días hábiles", y además se dirigía a vecinos. Eso choca con RF-8.5. En el nuestro el system prompt es nuevo y, además, un filtro por código reemplaza cualquier plazo por `[plazo a definir por la DOM]` (`apps/web/src/server/copiloto/prompt.ts`).
2. **Contrato §8.2 del servicio de visión.** Faltaban `requiereRevision`, `engineUsed` y `GET /api/engine`. En `services/vision/api_server.py` los agregamos sin cambiar la lógica de inferencia (la deduplicación y la cobertura son idénticas a las suyas).
3. **Elección del modelo "local".** Su servicio tomaba el `best.pt` modificado más recientemente; después de un `git clone` todos tienen la misma fecha y la elección queda casi al azar. En el nuestro, la ruta va por entorno: `VISION_MODEL_LOCAL=best_obb_80ep.pt` (su `runs/obb/detector_baches_penalolen-3/weights/best.pt`).
4. **Next.js 16.3.4 tiene vulnerabilidades críticas publicadas** (RCE en optimización de imágenes y en `use cache`). Actualizamos a 16.4.6 y les recomendamos hacer lo mismo.
5. **Pesos en git.** Su repo versiona los `.pt` (~45 MB). El prompt pide no hacerlo; en el nuestro los pesos van fuera de git, en `services/vision/weights/`.
6. **Severidad.** La API recalcula la severidad con los umbrales de la tabla `configuracion` (editables por el admin). La que devuelve el servicio queda como referencia.
7. **Componentes reutilizados (con crédito en el código):** `BoundingBoxOverlay` e `InspectionBadge` (adaptado como `PanelAnalisis`), además de `Card`, `Badge`, `Button` y la paleta navy.

**Pruebas del servicio de visión sin PyTorch:** `services/vision/tests/` (sustituto de `ultralytics.YOLO`). **Textos normativos:** completar o validar `apps/web/src/server/copiloto/referencias.ts`.
