# Peñalolén Reporta

Plataforma municipal de Peñalolén donde los **encargados barriales** registran problemas del espacio público que les informan los vecinos, y los **funcionarios municipales** (DOM / DIDECO) los priorizan, gestionan y cierran. Integra un **servicio de visión** (YOLOv8) que sugiere la severidad de los baches y un **copiloto** con LLM local (Llama 3).

Proyecto del curso Ingeniería de Software (UAI, 2026), resultado de la fusión de *Peñalolén Reporta* con el módulo IA de *Soluciones Barriales*. La especificación completa está en `PROMPT_DESARROLLO.md` (proyecto del curso).

## Estructura

```
penalolen-reporta/
├── apps/web/            Next.js 16: panel municipal, app del encargado (/encargado), API de negocio
│   ├── src/app/         Páginas y rutas de API (App Router)
│   ├── src/db/          Esquema de datos (Drizzle + PostGIS)
│   ├── src/domain/      Reglas de negocio puras con pruebas (folio, estados, severidad, permisos, territorio)
│   ├── src/server/      Sesión, autorización, fotos y servicios de reportes (crear, consultar)
│   ├── src/components/  UI compartida (mapa Leaflet, detalle de reporte, etiquetas)
│   ├── db/              Migración, seed y datos de ejemplo
│   └── drizzle/         Migraciones SQL generadas
├── services/vision/     FastAPI + YOLOv8 (traído de IAvisual del equipo IA)
├── infra/               docker-compose.yml (PostGIS, visión, web) y certificados locales
├── docs/                Contrato de la API (openapi.yaml), estado de hitos y capturas
└── uploads/             Fotos de los reportes (fuera de git)
```

## Requisitos (Windows)

- **Docker Desktop**
- **Node.js 22 LTS**: `winget install OpenJS.NodeJS.LTS`
- **LM Studio u Ollama** con Llama 3, para el copiloto

## Puesta en marcha (desarrollo)

> **Instalación desde cero en otro PC:** sigue [`docs/INSTALACION.md`](docs/INSTALACION.md), que trae paso a paso, verificación y problemas comunes.

Desde PowerShell, en la carpeta del repo:

```powershell
# 1. Pesos del modelo de visión (una sola vez; ver services/vision/weights/README.md)
Copy-Item ..\SolucionesBarriales\IAvisual\yolov8s_pothole_pretrained.pt services\vision\weights\
Copy-Item ..\SolucionesBarriales\runs\obb\detector_baches_penalolen-3\weights\best.pt services\vision\weights\best_obb_80ep.pt

# 2. Variables de entorno (una sola vez)
Copy-Item infra\.env.example infra\.env
Copy-Item apps\web\.env.example apps\web\.env
#    Edita apps\web\.env y pon un AUTH_SECRET propio:
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Base de datos y servicio de visión en Docker
docker compose -f infra/docker-compose.yml up -d db vision

# 4. Web
cd apps\web
npm install
npm run db:setup      # migraciones + datos de ejemplo
npm run dev
```

Abre <http://localhost:3000>. Desde el celular, en la misma red Wi-Fi: `http://IP-DEL-PC:3000` (agrega esa IP en `DEV_ALLOWED_ORIGINS` del `.env`).

> **Después de traer cambios nuevos** (git pull o archivos actualizados): `npm install` y `npm run db:migrate` en `apps/web`. Si cambió el servicio de visión: `docker compose -f infra/docker-compose.yml up -d --build vision`.

> **Mapa:** las teselas vienen de OpenStreetMap, así que el mapa necesita internet. Sin internet el mapa se ve gris, pero igual se puede tocar para marcar el punto.
>
> **GPS:** el navegador solo entrega el GPS en `localhost` o con HTTPS. Desde el celular por `http://IP:3000` el encargado marca el punto en el mapa (RF-3.4). HTTPS local se configura en el Hito 6.

### Copiloto (LM Studio)

1. Instala LM Studio (<https://lmstudio.ai>) y descarga un modelo **Llama 3** (por ejemplo *Llama 3.1 8B Instruct*, cuantizado Q4).
2. En la pestaña **Developer**, carga el modelo y presiona **Start Server** (puerto 1234).
3. En `/copiloto` debería aparecer "IA local activa · <modelo>". Para fijar un modelo: `LLM_MODEL` en el `.env`.

Sin LM Studio, `npm run llm:simulado` levanta un LLM de prueba en el mismo puerto (respuestas fijas, solo para probar el flujo).

### GPS en el celular (HTTPS)

Ver `infra/certs/README.md`: certificados con mkcert y `npm run dev:https`.

### Prueba de punta a punta del guion de la demo

Con la app corriendo (`npm run dev`), Docker arriba y LM Studio o el LLM simulado:

```powershell
npx playwright install chromium   # solo la primera vez
npm run e2e
```

Recorre los 8 pasos del guion (§11) y guarda las capturas en `docs/capturas/` para el informe.

### Demo completa en Docker

```powershell
docker compose -f infra/docker-compose.yml --profile app up -d --build
```

Levanta la base de datos, el servicio de visión, las migraciones con el seed y la web en <http://localhost:3000>. Requiere `AUTH_SECRET` en `infra/.env`.

## Usuarios demo

Contraseña de todos: `Demo2026!` (configurable con `SEED_PASSWORD`).

| Rol | Correo | Detalle |
|---|---|---|
| Administrador | admin@penalolen.demo | |
| Funcionario | dom@penalolen.demo | DOM |
| Funcionario | dideco@penalolen.demo | DIDECO |
| Encargada | encargada.lafaena@penalolen.demo | La Faena |
| Encargado | encargado.lohermida@penalolen.demo | Lo Hermida |
| Encargada | encargada.sanluis@penalolen.demo | San Luis |

## Comandos (en `apps/web`)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (escucha en toda la red local) |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run typecheck` / `npm run lint` | Revisión de tipos y estilo |
| `npm run db:generate` | Crea una migración SQL después de cambiar `src/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Carga datos de ejemplo (no pisa usuarios existentes; `-- --reset-usuarios` los restaura) |
| `npm run db:studio` | Explorador visual de la base de datos |

**Pruebas de integración** (contra PostGIS real; borran y recrean una base de pruebas):

```powershell
$env:TEST_DATABASE_URL="postgresql://reporta:reporta@localhost:5432/reporta_test"   # o en apps/web/.env
npm test
```

Cada archivo de pruebas crea y borra su propia base (`reporta_test_*`); no hace falta crear `reporta_test` antes.

Sin `TEST_DATABASE_URL` esas pruebas se omiten y corren solo las unitarias.

Pruebas del servicio de visión (sin PyTorch, con un modelo simulado): ver `services/vision/tests/test_api.py`.

## Qué hace la plataforma (resumen)

- **Encargado (celular):** registra en 3 pasos (categoría → foto y ubicación por GPS o mapa → detalles) y recibe un folio. Antes de crear, si hay un reporte igual cerca, puede **sumar respaldo**. Tiene "Mis reportes" con historial, notificaciones y un texto para compartir con los vecinos.
- **IA de visión:** para baches, sugiere la severidad (cajas sobre la foto) segundos después del registro, sin bloquearlo.
- **Funcionario (panel):** bandeja con filtros y orden, alertas, mapa, detalle con acciones (revisión, gestión, derivar, duplicado, rechazar, cerrar con foto), métricas y copiloto.
- **Copiloto (Llama 3 local):** resume casos, redacta respuestas sin plazos, responde con métricas reales y aclara normativa a partir de `src/server/copiloto/referencias.ts`.
- **Administrador:** usuarios (con clave temporal), categorías, territorios, umbrales y motor de visión.
- **Consulta pública:** `/consulta/<folio>` muestra el estado sin datos personales.

El estado de cada requisito está en `docs/HITOS.md`.

## Decisiones técnicas

- **Drizzle ORM** en lugar de Prisma. Es 100 % JavaScript: no descarga binarios, lo que simplifica Windows, Docker y la demo sin internet. Además maneja columnas `geography(Point, 4326)` de PostGIS como tipos propios (`src/db/geo.ts`); con Prisma habría que escribir SQL a mano cada vez que se guarda una ubicación. El esquema sigue la sección 5 del prompt.
- **Next.js 16.4.6**. Partimos de la 16.3.4 que usa Soluciones Barriales, pero esa versión tiene vulnerabilidades críticas publicadas; la 16.4.6 las corrige. En Next 16 el antiguo `middleware.ts` se llama `proxy.ts`.
- **Sesión** en cookie httpOnly con JWT firmado (HS256) y contraseñas con bcrypt. Los permisos se validan en el servidor en cada página y endpoint (`src/domain/permisos.ts`). El proxy solo hace una redirección temprana.
- **Servicio de visión:** misma inferencia que el original del equipo IA, más los campos `requiereRevision` y `engineUsed` del contrato §8.2, pesos configurables por entorno, `GET /api/engine` y una API key opcional. Ver la cabecera de `services/vision/api_server.py`.
- **Severidad:** la API la recalcula siempre con los umbrales de la tabla `configuracion` (`src/domain/severidad.ts`), sin depender de la que devuelve el servicio de visión.

## Convenciones

Ramas `feat/…` y `fix/…`. Commits semánticos (`feat(reportes): sugerir respaldo por radio`). PR con descripción y checklist. `.env.example` siempre actualizado. Nunca suben a git: pesos `.pt`, fotos ni `.env`.
