# Notas para el equipo IA (Soluciones Barriales)

Este documento resume qué tomamos de su repo, qué cambiamos y por qué, para que nada los sorprenda. Fue escrito por el equipo de Peñalolén Reporta.

## Lo esencial

- **Su repositorio no se modificó.** Todo lo leímos de `SolucionesBarriales` (commit `1da74be`) y el trabajo se hizo en este repo.
- **La fusión ya está hecha en este repo.** No hay que mezclar código a mano: `penalolen-reporta` es la app integrada, con su servicio de visión y su copiloto adentro. Lo que queda es instalarla en su PC (`docs/INSTALACION.md`) y revisar estas notas.
- **Su modelo entrenado es el que corre.** El servicio de visión usa sus pesos y su misma lógica de inferencia. No reentrenamos ni cambiamos el modelo.
- **Está probado con sus modelos reales:** YOLO en Docker con sus `.pt`, Llama 3.1 8B en LM Studio, 135 pruebas automáticas y la demo completa de punta a punta.

## 1. Servicio de visión (`services/vision/`)

**Qué se conservó igual:** `api_server.py` parte de su `IAvisual/api_server.py`. La inferencia, el modo ensemble, la deduplicación de cajas, el cálculo de cobertura y los umbrales de severidad (baja < 8 %, media 8–20 %, crítica > 20 %) son los mismos.

**Pesos que usa** (se copian desde su repo; ver `services/vision/weights/README.md`):

| Motor | Archivo aquí | Origen en su repo |
|---|---|---|
| `pretrained` | `yolov8s_pothole_pretrained.pt` | `IAvisual/yolov8s_pothole_pretrained.pt` |
| `local` | `best_obb_80ep.pt` | `runs/obb/detector_baches_penalolen-3/weights/best.pt` (YOLOv8s-OBB, 80 épocas, el de su commit `e0004ca`) |

El motor por defecto es `ensemble` (usa los dos), igual que en su servicio.

**Cambios, todos aditivos:**

1. **Elección del modelo `local` por variable de entorno.** Su servicio elegía el `best.pt` más reciente por fecha de modificación entre `runs/detect` y `runs/obb`. Después de un `git clone` todos los archivos quedan con la misma fecha, así que la elección era casi al azar (podía tomar `runs/detect/detector_baches_penalolen-4`). Fijamos el OBB de 80 épocas porque es el que su historial presenta como el modelo entrenado final. **Si prefieren otro, es solo cambiar `VISION_MODEL_LOCAL` en `infra/.env`**; no hay que tocar código.
2. **Campos nuevos en la respuesta:** `requiereRevision` (sin detección o confianza menor a 0,4) y `engineUsed`, que pide el contrato §8.2 del prompt de desarrollo.
3. **`GET /api/engine`** (contrato §8.2). `switch_engine` ahora valida el nombre del motor.
4. **API key interna opcional** entre la app y el servicio (`VISION_API_KEY`, RF-11.3). Viene apagada por defecto.
5. **CORS cerrado por defecto.** La app llama al servicio de servidor a servidor, así que no necesita CORS. **Ojo:** si quieren usar su frontend antiguo contra este servicio desde el navegador, agreguen su origen en `VISION_CORS_ORIGINS` (por ejemplo `http://localhost:3000`).
6. **Límite de 10 MB por imagen**, el mismo que la app.
7. **Dockerfile** (PyTorch para CPU) y **pruebas** en `services/vision/tests/`, con un sustituto de `ultralytics.YOLO` para correrlas sin PyTorch.

**Severidad:** la app recalcula la severidad con los umbrales de la tabla `configuracion`, que el administrador puede editar desde `/admin`. Los valores por defecto son los mismos suyos. La severidad que devuelve el servicio queda como referencia.

## 2. Copiloto (Llama 3 local)

**Qué se conservó:** la misma arquitectura suya. LM Studio (puerto 1234) u Ollama (11434), API compatible con OpenAI y detección automática del servidor activo.

**Qué cambiamos y por qué:**

1. **System prompt nuevo.** El suyo prometía plazos ("cuadrilla en 24–48 horas", "5–10 días hábiles") y se dirigía a vecinos. El prompt de desarrollo prohíbe los plazos (RF-8.5) y en la app las respuestas van a **encargados barriales**, porque los vecinos no tienen cuenta. Además, un filtro por código reemplaza cualquier plazo que el modelo escriba por `[plazo a definir por la DOM]` (`apps/web/src/server/copiloto/prompt.ts`).
2. **Un solo mensaje de sistema.** Su versión enviaba el contexto del ticket como un segundo mensaje `system`. Con Llama 3.1 en LM Studio eso hacía que a veces el modelo respondiera con JSON de "llamada a función" (`{"name": ..., "parameters": ...}`) en vez de texto. Ahora va todo en un mensaje. Si aun así responde en JSON, la app le pide texto una vez y, si insiste, muestra un error claro.
3. **Contexto real desde la base de datos:** folio, estado, respaldo vecinal, severidad e historial, sin datos personales. Cuando la pregunta lo requiere, se agregan **métricas reales** calculadas en el momento.
4. **Referencias normativas** en `apps/web/src/server/copiloto/referencias.ts`. **Es un borrador** con fuentes públicas (Ley 8.946 art. 77 bis, Ley 18.695): por favor revísenlo y complétenlo.

## 3. Frontend: qué se reutilizó y qué no

**Reutilizado (con crédito en el código):** `BoundingBoxOverlay` (las cajas sobre la foto), `InspectionBadge` (adaptado como `PanelAnalisis`), `Card`, `Badge`, `Button` y la paleta navy.

**No se trasladó**, porque la app integrada ya cubre esas funciones con base de datos real, usuarios y roles: sus páginas `bandeja`, `inspeccion` y `solicitudes`/`panel`, el `RegistrationForm`, el `IncidentDetailModal` y los datos de `solicitudesSeed.ts` guardados en `localStorage`. Sus equivalentes en la app son la bandeja del funcionario, el formulario del encargado, el detalle del reporte y la página de métricas.

**Next.js:** su `frontend` usa la versión 16.3.4, que tiene vulnerabilidades críticas publicadas (ejecución remota de código en la optimización de imágenes y en `use cache`). La app usa la 16.4.6. Si siguen usando su frontend, les recomendamos actualizarlo.

## 4. Pesos fuera de git

Su repo versiona 14 archivos `.pt` (unos 196 MB en total). El prompt de desarrollo pide no subirlos, así que en este repo van fuera de git, en `services/vision/weights/`, y se copian desde su repo al instalar.

## 5. Qué les pedimos

1. Instalar siguiendo `docs/INSTALACION.md`. Al final hay una sección para comprobar que todo quedó bien: 135 pruebas y la demo de punta a punta.
2. Confirmar que `runs/obb/detector_baches_penalolen-3` es el modelo que quieren usar como `local` (punto 1.1).
3. Revisar y completar `referencias.ts` (punto 2.4).
4. Avisarnos si algo de lo que cambiamos no les parece. Todo es configurable o reversible.
