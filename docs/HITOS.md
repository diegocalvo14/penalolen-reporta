# Estado de los hitos y requisitos funcionales

Documento para el equipo de informe (PROMPT_DESARROLLO §14.5). Se actualiza al cerrar cada hito.
**Pasado** = criterio verificado · **Parcial** = base lista, falta parte del criterio · **Pendiente** = hito futuro.

## Hito 1 — Base (cerrado el 14-11-2026, probado en Windows)

Entregado: estructura del repo, docker compose (PostGIS + visión + web), esquema de datos completo con migraciones, seed, login por rol, protección de rutas y esqueleto de las tres vistas.

| RF | Prioridad | Estado | Cómo se verificó |
|---|---|---|---|
| RF-1.1 Login con email y contraseña, sesión segura, bcrypt | M | **Pasado** | Cookie `pr_session` HttpOnly + SameSite=Lax, JWT HS256 de 12 h. Credenciales inválidas y correo inexistente dan el mismo mensaje genérico. Cada rol llega a su vista (`/encargado`, `/panel`, `/admin`). Bloqueo tras 8 intentos fallidos (HTTP 429). |
| RF-1.2 Autorización por rol en API y páginas | M | **Pasado** | Prueba manual de los 3 roles × 6 rutas: cada rol solo entra a lo suyo y el resto redirige. API sin sesión → 401. Usuario desactivado con sesión abierta → se borra la cookie y vuelve al login. Matriz de permisos con pruebas unitarias. |
| RF-1.3 Admin crea/edita/desactiva usuarios | S | Parcial | La vista de administración lista usuarios, rol, unidad y territorio. La edición queda para el Hito 7. |
| RF-2.1 Seed: categorías, territorios, usuarios demo | M | **Pasado** | 6 categorías (solo Bache con IA), 5 territorios con centroide y 6 usuarios (1 admin, 2 funcionarios, 3 encargados). Se puede correr varias veces sin duplicar. |
| RF-2.2 Admin edita categorías y umbrales | S | Parcial | Umbrales y categorías ya están en la BD y se muestran en `/admin`. Falta la edición. |
| RF-3.2 Aviso de no incluir datos personales | M | **Pasado** | Visible en la pantalla de inicio del encargado. Se repetirá en el formulario (Hito 2). |
| RF-11.1 Todo cambio queda en EventoHistorial | M | Parcial | La tabla `eventos_historial` existe con usuario, fecha, estados y organismo. Se escribirá en cada acción desde el Hito 2. |
| RF-11.2 Seguridad de archivos, CORS, `.env` | M | Parcial | `.env` fuera de git, `.env.example` documentado. El servicio de visión limita el tamaño (10 MB), valida decodificando la imagen y tiene CORS cerrado por defecto. Falta la validación de subida en la API (Hito 2). |
| RF-11.3 API key interna web ↔ visión | S | Parcial | Implementada y probada en el servicio de visión (`VISION_API_KEY`). La web la enviará en el Hito 4. |

### Pruebas automatizadas del Hito 1

- **Web (Vitest), 50 pruebas:** generación de folio; máquina de estados (las 7 transiciones válidas y todas las inválidas); datos obligatorios por estado; severidad con umbrales configurables y los bordes 8 % y 20 %; matriz de permisos y acceso por sección; decodificación de puntos PostGIS.
- **Visión (pytest), 5 pruebas:** contrato §8.2 completo, deduplicación de cajas y filtro de la clase `object`, cambio de motor, archivos inválidos, API key y comportamiento sin pesos.
- **Manual:** migraciones y seed contra PostgreSQL 16 + PostGIS 3.4; login y redirecciones de los 3 roles; usuario desactivado; token alterado; límite de intentos. El equipo lo reprodujo en Windows con Docker Desktop: los 3 roles entran a su vista.

## Hito 2 — Registro (cerrado el 14-11-2026)

Entregado: formulario del encargado en 3 pasos (categoría → foto y ubicación → detalles), "Mis reportes" con detalle e historial, bandeja municipal con filtros, orden y paginación, y detalle de solo lectura en el panel.

| RF | Prioridad | Estado | Cómo se verificó |
|---|---|---|---|
| RF-3.1 Formulario con categoría, descripción (≤ 500), foto, ubicación, dirección, vecinos y canal; folio único; ≤ 60 s | M | **Pasado** | Recorrido automatizado en un celular simulado: 3 pasos y folio `PR-2026-00004` en pocos segundos. La foto se valida por su firma binaria y decodificándola completa (texto disfrazado de .jpg o archivo truncado → rechazo). Máximo 10 MB. Foto obligatoria solo si la categoría usa IA. Folios correlativos y sin repetir aunque se creen 8 en paralelo (prueba de integración). |
| RF-3.2 Aviso de no incluir datos personales | M | **Pasado** | Visible en el inicio del encargado, junto a la foto y en el paso de detalles. Además, el servidor **elimina los metadatos EXIF** de cada foto (ubicación exacta, modelo del celular, autor); hay una prueba que lo verifica. |
| RF-3.3 Ubicación por GPS con precisión | M | **Pasado** | Se pide el GPS al entrar al paso 2 y se guarda la precisión (±m), que se muestra como un círculo en el mapa. La API rechaza una ubicación GPS sin precisión. Nota: en la red local el GPS del navegador exige HTTPS (Hito 6); mientras tanto se usa el respaldo de RF-3.4. |
| RF-3.4 Respaldo: marcar o ajustar el punto en el mapa (Leaflet + OSM) | M | **Pasado** | Tocar el mapa o arrastrar el marcador fija el punto con origen `mapa`. Opción "No sé el punto exacto": centro del territorio con origen `centroide`; el servidor usa el centroide guardado y no confía en el del cliente. |
| RF-3.5 Punto fuera del territorio del encargado | S | **Pasado** | Se asigna el territorio donde está el problema (polígono si existe; si no, el centroide más cercano) y se marca `fuera_de_territorio`. Destacado en la bandeja y en "Mis reportes". |
| RF-3.6 "Mis reportes" con estado, severidad sugerida e historial | M | **Pasado** | Lista con estado, severidad IA (o "IA pendiente"), respaldos y antigüedad; detalle con foto, mapa, respaldos e historial. Un encargado no puede abrir reportes ni fotos de otro (404). |
| RF-6.1 Bandeja con columnas, filtros y orden | M | **Pasado** | Columnas folio, categoría, territorio, respaldos, severidad sugerida, antigüedad y estado. Filtros por estado (incluido "abiertos"), categoría, territorio y severidad; orden por recientes, respaldos, antigüedad o severidad; 25 por página. |
| RF-6.4 Destacar fuera de territorio o requiere revisión | M | **Pasado** | Filas resaltadas con etiquetas y filtro "Solo destacados". "Requiere revisión" se llenará cuando la visión responda (Hito 4). |
| RF-6.3 Detalle con fotos, respaldos e historial | M | Parcial | La vista de detalle está lista; las acciones (cambiar estado, derivar, cerrar) son del Hito 3. |
| RF-11.2 Validación de archivos y nombres generados por el servidor | M | **Pasado** | Firma binaria + decodificación, 10 MB, nombres `reportes/AAAA/MM/<uuid>.jpg` generados por el servidor, protección contra rutas fuera de `uploads/`. Las fotos solo se entregan por `/api/imagenes/{id}`, con control de acceso, `nosniff` y caché privada. Si la transacción falla no queda la foto huérfana (prueba de integración). |
| RF-5.1 Análisis IA en estado `pendiente` al crear un bache | M | Parcial | Se crea el `AnalisisIA` pendiente, como pide el contrato. La llamada al servicio de visión es del Hito 4. |

### Pruebas automatizadas del Hito 2

- **Unitarias (+23):** validación del formulario (límites, números, canal, GPS sin precisión, coordenadas); lectura de filtros desde la URL; asignación de territorio (centroide más cercano, polígonos, solapes, ubicación aproximada); detección del tipo de imagen; normalización y eliminación de EXIF; rechazo de archivos falsos, truncados y de más de 10 MB.
- **Integración contra PostGIS (6):** creación completa con foto, folios en paralelo, fuera de territorio, centroide del servidor, limpieza de la foto si falla la transacción, y filtros y orden de la bandeja.
- **Recorrido en navegador (Chrome automatizado):** registro de un bache con GPS y foto y de una luminaria marcada en el mapa, "Mis reportes", detalle, bandeja ordenada por respaldos y filtrada por categoría, y detalle en el panel.
- **Total web: 79 pruebas** (Vitest). Las de integración se ejecutan si existe `TEST_DATABASE_URL`.

## Hito 3 — Duplicados, respaldo, gestión y notificaciones (cerrado el 14-11-2026)

| RF | Prior. | Estado | Cómo se verificó |
|---|---|---|---|
| RF-4.1 Búsqueda de reportes abiertos de la misma categoría en el radio (`ST_DWithin`); no aplica con centroide o precisión > radio | M | **Pasado** | Integración: encuentra a 10 m con su distancia, no a 40 m ni en otra categoría; con centroide o GPS de ±60 m no busca. Regla pura con pruebas unitarias. |
| RF-4.2 "Ya existe un reporte cerca" con distancia, foto y respaldos; "Sumar respaldo" o "Es otro problema" | M | **Pasado** | Paso intermedio del formulario, entre el paso 2 y el 3. Recorrido E2E (captura `06-ya-existe-cerca`). |
| RF-4.3 Sumar respaldo: crea `Respaldo`, actualiza el total y registra evento | M | **Pasado** | E2E del guion: 6 + 3 = **9**, visible al instante en la bandeja. Avisa al autor si suma otro encargado. No se puede sumar a reportes cerrados (409). Quien respalda ve el reporte en "Mis reportes" (etiqueta "Respaldado"). |
| RF-4.4 Marcar Duplicado: los respaldos pasan al original | S | **Pasado** | Integración: por folio o id; el original queda con la suma y el duplicado en 0; no se permite duplicado de sí mismo ni de un folio inexistente. |
| RF-6.2 Mapa con marcadores por categoría y estado; clic → detalle | M | **Pasado** | Color por categoría, relleno tenue si está cerrado, borde rojo si es crítico y tamaño según respaldo. Usa los mismos filtros de la bandeja. |
| RF-6.3 Detalle con fotos, análisis IA, respaldos, historial y acciones | M | **Pasado** | Solo muestra las transiciones permitidas. Derivar exige organismo (lista sugerida u "Otro"), rechazar exige motivo y cerrar exige comentario, con foto de evidencia opcional. Comentarios visibles en el historial. |
| RF-7.1 Notificación al encargado en cada cambio de estado (campana con contador) | M | **Pasado** | Campana que se actualiza cada 30 s; marcar una o todas como leídas. Integración: 3 avisos en el ciclo completo. E2E: la encargada abre el aviso de "fue resuelto". |
| RF-7.2 Alerta en el panel por umbral de respaldo o severidad crítica | S | **Pasado** | Recuadro "requieren atención" en la bandeja, con el umbral configurable. |
| RF-7.3 Texto para compartir por WhatsApp (botón "Copiar") | C | **Pasado** | "Copiar para vecinos" en el detalle del encargado: folio, estado, respaldos y el enlace a la consulta pública. Sin datos personales. |
| RF-11.1 Todo cambio queda en EventoHistorial | M | **Pasado** | Creación, respaldo, cada estado (con anterior y nuevo), derivación, cierre, comentario y análisis IA. Los eventos del sistema llevan usuario nulo. |

## Hito 4 — Servicio de visión (cerrado el 14-11-2026)

| RF | Prior. | Estado | Cómo se verificó |
|---|---|---|---|
| RF-5.1 Guardar primero, `AnalisisIA` pendiente y luego llamar a `POST /api/analyze`; con error o > 10 s queda en "error" con reintento | M | **Pasado** | El análisis corre después de responder al encargado (`after()` de Next.js). Integración con visión simulada: ok, HTTP 500 y tiempo agotado; el reporte siempre queda guardado. Además se probó en vivo con nuestro `api_server.py` (modelo simulado): pendiente → listo en ~1 s. |
| RF-5.2 Guardar cajas, ratio, severidad y `requiereRevision`; severidad recalculada con los umbrales de `Configuracion` | M | **Pasado** | Prueba: el servicio dice "media" y la API guarda "crítica" (25 % > 20 %); al cambiar los umbrales, el reanálisis da "media". Sin detección o confianza < 40 % → requiere revisión. |
| RF-5.3 Foto con las cajas superpuestas y rótulo "Severidad sugerida por IA" | M | **Pasado** | `BoundingBoxOverlay` adaptado del equipo IA y panel de análisis basado en su `InspectionBadge`. La vista se actualiza sola mientras el análisis está pendiente. |
| RF-5.4 Reanalizar y selector de motor (local / ensemble / preentrenado) para el admin | S | **Pasado** | Botón "Reintentar análisis / Reanalizar" en el detalle y selector de motor en `/admin`, conectado a `/api/engine` y `/api/switch_engine`. Cada intento queda como un análisis nuevo. |
| RF-11.3 API key interna web ↔ visión | S | **Pasado** | `VISION_API_KEY` en ambos lados (header `X-API-Key`), con pruebas en el servicio. |

## Hito 5 — Métricas y copiloto (cerrado el 14-11-2026)

| RF | Prior. | Estado | Cómo se verificó |
|---|---|---|---|
| RF-9.1 `GET /api/metricas?desde&hasta&territorio&categoria` desde Reporte y EventoHistorial | M | **Pasado** | Totales por estado, categoría y territorio; abiertos por severidad; **tiempo promedio por etapa** (con `LEAD` sobre el historial); top 5 por respaldos; creados por semana; filtro adicional por unidad. Integración con tiempos conocidos (2 h, 5 h y 12 h). |
| RF-9.2 Vista "Métricas" con gráficos | S | **Pasado** | Indicadores, barras por estado, categoría y territorio, columnas semanales, tabla de tiempos por etapa, severidad y top 5, con filtros de período, territorio, categoría y unidad. |
| RF-8.1 `/copiloto` y `/api/copiloto` integrados con sesión y permisos (funcionario/admin) | M | **Pasado** | Encargado → 403/redirección. Contrato §8.3. |
| RF-8.2 Contexto del reporte sin datos personales | M | **Pasado** | Folio, categoría, territorio, estado, respaldos, severidad, fechas e historial resumido. Sin nombres de encargados ni de funcionarios; correos, teléfonos y RUT se omiten. Verificado en una prueba que inspecciona lo que se envía al LLM. |
| RF-8.3 Bloque `[MÉTRICAS]` cuando la pregunta lo requiere | M | **Pasado** | Detección por palabras clave o acción rápida. Incluye métricas generales y "este mes". E2E: "¿Cuántos reportes abiertos hay por territorio?" responde con cifras reales. |
| RF-8.4 Bloque `[REFERENCIAS]` con normativa y procedimiento | M | Parcial | Implementado en `src/server/copiloto/referencias.ts`, con la Ley 8.946 (art. 77 bis, bacheo de emergencia hasta 20 m²), la Ley 18.695 (arts. 22, 24 y 25), las competencias por categoría y el procedimiento interno. **Lo redactó el equipo de desarrollo con fuentes públicas: falta que el equipo/DOM lo valide.** |
| RF-8.5 Sin plazos, ni en borradores | M | **Pasado** | Dos barreras: la instrucción del system prompt y un **filtro por código** que reemplaza cualquier plazo por `[plazo a definir por la DOM]` y respeta las estadísticas ("promedio 12 h", "hace 3 días"). 12 pruebas unitarias más el E2E: el LLM simulado escribe "24 a 48 horas" a propósito y la plataforma lo oculta. |
| RF-8.6 Acciones rápidas | M | **Pasado** | "Resumir este caso", "Redactar respuesta para el encargado", "¿Qué información falta?", "Métricas de mi unidad" y una de normativa. |
| RF-8.7 Errores: LLM apagado, tiempo agotado, entrada vacía o > 2.000 caracteres | M | **Pasado** | Aviso con instrucciones y botón Reintentar; 504 al agotarse `LLM_INFERENCE_TIMEOUT_MS` (60 s por defecto); 400 por entrada inválida. Pruebas de integración. |
| RF-8.8 Indicador "IA local activa · modelo" | S | **Pasado** | Healthcheck `GET /api/copiloto`, que detecta LM Studio (:1234) u Ollama (:11434). `LLM_MODEL` fija el modelo; si no, se prefiere uno "llama". |
| RF-6.5 "Consultar al copiloto" desde el detalle | S | **Pasado** | Abre `/copiloto?reporte=<id>` con el contexto cargado. |

## Hito 7 — Administración y extras (cerrado el 14-11-2026)

| RF | Prior. | Estado | Cómo se verificó |
|---|---|---|---|
| RF-1.3 Admin crea, edita y desactiva usuarios con rol y territorio | S | **Pasado** | Contraseña temporal que se muestra una sola vez; cambio de rol (encargado ↔ territorio, funcionario ↔ unidad); activar/desactivar; restablecer contraseña. El admin no puede desactivarse ni quitarse el rol. Integración. |
| RF-1.4 Cambio de contraseña en el primer ingreso | C | **Pasado** | Con clave temporal, todas las páginas redirigen a `/cambiar-clave` hasta cambiarla (mínimo 8 caracteres y distinta de la actual). |
| RF-2.2 Admin edita categorías (radio, `usa_ia`) y umbrales | S | **Pasado** | Edición en línea de categorías (también color, unidad y activa) y de territorios (nombre y centroide); umbrales validados (media < crítica ≤ 100). Integración. |
| RF-10.1 Consulta pública por folio | C | **Pasado** | `/consulta/PR-AAAA-NNNNN`: estado, fechas, categoría, territorio y respaldos. Sin datos del encargado, sin descripción, sin fotos ni ubicación exacta, y sin indexar en buscadores. |
| RF-3.7 Borradores guardados en el dispositivo | C | Pendiente | No se implementó (prioridad Could). |

## Hito 6 — Pulido, pruebas y seguridad (cerrado el 14-11-2026)

- **E2E del guion completo (§11)** con Playwright: `apps/web/e2e/demo.spec.ts` recorre los 8 pasos más la consulta pública y guarda 15 capturas en `docs/capturas/`. Pasó contra el build de producción, PostGIS, nuestro servicio de visión (modelo simulado) y un LLM simulado (`npm run llm:simulado`). **Las capturas finales para el informe hay que regenerarlas en el PC de la demo** (allí el mapa carga OpenStreetMap y la visión usa el modelo real).
- **Seguridad:** se actualizó Next.js 16.3.4 → **16.4.6** porque la 16.3.4 tiene vulnerabilidades críticas publicadas (RCE en optimización de imágenes y en `use cache`). `npm audit --omit=dev` → 0 vulnerabilidades. Se recomienda que el equipo IA también actualice.
- **HTTPS local** para el GPS del celular: `npm run dev:https` con certificados de mkcert (guía en `infra/certs/README.md`).
- **Total de pruebas automatizadas:** 132 en la web (Vitest: unitarias + integración contra PostGIS), 5 del servicio de visión (pytest) y 1 E2E del guion completo.

## Decisiones tomadas durante el desarrollo

- **Drizzle en vez de Prisma** (sin binarios; manejo nativo de PostGIS). El prompt dejaba la elección abierta.
- **El reporte se asigna al territorio donde está el problema**, no al del encargado, y se marca "fuera de territorio" si no coinciden.
- **Foto obligatoria solo para categorías con IA.** Las fotos se guardan en JPEG de hasta 2048 px y sin EXIF.
- **Duplicado:** los respaldos se traspasan al original y el duplicado queda en 0.
- **Quien suma respaldo puede ver ese reporte** en "Mis reportes" (etiqueta "Respaldado"). Los encargados ven las fotos de reportes abiertos, para reconocer el duplicado.
- **Comentarios del funcionario visibles para el encargado** en el historial (sirven de respuesta).
- **Cada reanálisis crea un análisis nuevo** (historial de intentos); se muestra siempre el más reciente.
- **Copiloto:** la regla de no plazos se aplica además por código. Las métricas del copiloto son las mismas de la vista "Métricas".

## Pendiente

- RF-3.7 (Could): borradores sin conexión en el celular.
- Validar con la DOM los textos de `[REFERENCIAS]` del copiloto.
- Probar en el PC de la demo: Llama 3 real, visión con el modelo real y GPS con HTTPS (ver `docs/PASOS_PENDIENTES.md`).
