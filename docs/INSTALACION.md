# Instalación en un computador nuevo (Windows)

Guía para dejar **Peñalolén Reporta** funcionando desde cero en un PC con Windows 10/11. Toma entre 45 y 60 minutos, sobre todo por las descargas: Docker, PyTorch y el modelo Llama 3.

Todos los comandos son para **PowerShell**. Donde aparece `Ingenieria de Software`, usa la carpeta donde guardan los repos.

---

## 0. Programas necesarios

| Programa | Cómo instalarlo | Para qué |
|---|---|---|
| Git | `winget install Git.Git` | Clonar el repo |
| Node.js 22 LTS | `winget install OpenJS.NodeJS.LTS` | La app web |
| Docker Desktop | <https://www.docker.com/products/docker-desktop/> (pide activar WSL 2 y reiniciar) | Base de datos y servicio de visión |
| LM Studio | <https://lmstudio.ai> | Copiloto con Llama 3 |

Después de instalar, **cierra y vuelve a abrir PowerShell** para que reconozca los comandos nuevos. Comprueba que todo responde:

```powershell
git --version
node --version      # v22.x
docker --version
```

### PowerShell bloquea npm

Si al usar `npm` aparece *"la ejecución de scripts está deshabilitada en este sistema"*, corre esto una vez:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## 1. Clonar los repos

Necesitas el repo de la app y el de SolucionesBarriales, porque de ahí salen los pesos del modelo de visión.

```powershell
cd "$HOME\Proyectos\Ingenieria de Software"     # o la carpeta que usen
git clone https://github.com/diegocalvo14/penalolen-reporta.git penalolen-reporta
cd penalolen-reporta
git checkout feat/plataforma-integrada   # mientras no esté en main
cd ..
# Si no tienen SolucionesBarriales clonado en esta misma carpeta:
git clone https://github.com/BBLASCHKE1703/SolucionesBarriales.git SolucionesBarriales
```

## 2. Pesos del modelo de visión

Los archivos `.pt` no se suben a git. Cópialos desde SolucionesBarriales:

```powershell
Copy-Item SolucionesBarriales\IAvisual\yolov8s_pothole_pretrained.pt penalolen-reporta\services\vision\weights\
Copy-Item SolucionesBarriales\runs\obb\detector_baches_penalolen-3\weights\best.pt penalolen-reporta\services\vision\weights\best_obb_80ep.pt
```

Comprueba que en `penalolen-reporta\services\vision\weights\` quedaron `yolov8s_pothole_pretrained.pt` y `best_obb_80ep.pt`.

## 3. Variables de entorno

```powershell
cd penalolen-reporta
Copy-Item infra\.env.example infra\.env
Copy-Item apps\web\.env.example apps\web\.env
```

Genera un secreto para la sesión:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Abre `apps\web\.env` (con `notepad apps\web\.env`) y pega el resultado en `AUTH_SECRET="..."`. Pega el mismo valor en `AUTH_SECRET=` de `infra\.env`. El resto de los valores sirve tal cual para un PC local.

## 4. Base de datos y servicio de visión (Docker)

Abre **Docker Desktop** y espera a que diga *Engine running*. Luego:

```powershell
docker compose -f infra/docker-compose.yml up -d --build db vision
```

La primera vez demora entre 5 y 15 minutos, porque descarga PyTorch (unos 2 GB). Al terminar, revisa los logs:

```powershell
docker compose -f infra/docker-compose.yml logs vision
```

Debe aparecer `[MOTORES] Modelos cargados: ['pretrained', 'local']`. Si dice que no encuentra un `.pt`, vuelve al paso 2.

## 5. App web

```powershell
cd apps\web
npm install
npm run db:setup
```

- `npm install` termina con avisos de *vulnerabilities* y de `esbuild` / *install-scripts*. Son de las herramientas de desarrollo y se pueden ignorar. **No corras `npm audit fix --force`**, porque rompe las migraciones.
- `npm run db:setup` crea las tablas y carga los datos de ejemplo: territorios, categorías, usuarios demo y algunos reportes.

## 6. Copiloto con LM Studio

Descarga el **LM Studio** clásico desde <https://lmstudio.ai/download>. **No** descargues *LM Studio Bionic*: es otra app (un agente) y no pueden estar abiertas las dos a la vez. En la pantalla de bienvenida activa **Developer Mode** y deja activado *Start local LLM service on login*.

1. Entra a **Model Search** (la lupa). Busca `Llama 3.1 8B Instruct`, elige `lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF` y descarga la versión **Q4_K_M** (4,9 GB).
2. Carga el modelo desde la barra de arriba **Select a model to load** (`Ctrl + L`) y espera a que termine.
3. Entra a **Model Server** en la barra izquierda (en versiones antiguas se llama *Developer*) y prende el servidor (*Status: Running*). Debe quedar en el puerto `1234`. **No actives** *Require authentication*.
4. Comprueba que responde:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:1234/v1/models
   ```

   Debería aparecer el modelo con "llama" en el nombre.

Si el PC no tiene GPU dedicada y las respuestas tardan más de un minuto, usa *Llama 3.2 3B Instruct* o sube `LLM_INFERENCE_TIMEOUT_MS` en `apps\web\.env`.

## 7. Levantar la app

```powershell
npm run dev
```

Abre <http://localhost:3000>. La contraseña de todos los usuarios demo es `Demo2026!`.

| Rol | Correo |
|---|---|
| Administrador | admin@penalolen.demo |
| Funcionario DOM | dom@penalolen.demo |
| Funcionario DIDECO | dideco@penalolen.demo |
| Encargada La Faena | encargada.lafaena@penalolen.demo |
| Encargado Lo Hermida | encargado.lohermida@penalolen.demo |
| Encargada San Luis | encargada.sanluis@penalolen.demo |

En `/copiloto` debería aparecer **"IA local activa"** junto al nombre del modelo.

---

## 8. Comprobar que la instalación quedó bien

Abre **otra** ventana de PowerShell, deja `npm run dev` corriendo en la primera y entra a `apps\web`.

**Pruebas automáticas** (unitarias y contra la base de datos real):

```powershell
$env:TEST_DATABASE_URL="postgresql://reporta:reporta@localhost:5432/reporta_test"
npm test
```

Resultado esperado: **132 passed**. Las pruebas crean y borran sus propias bases temporales y no tocan los datos de la demo.

**Guion completo de la demo** (abre un navegador automático y recorre los 8 pasos):

```powershell
npx playwright install chromium     # solo la primera vez
$env:E2E_IA_REAL="1"
npm run e2e
```

Resultado esperado: **1 passed** (tarda 1 a 3 minutos por el copiloto). Las capturas quedan en `docs\capturas\`.

`E2E_IA_REAL=1` adapta la prueba a la IA real. La foto de la prueba es un rectángulo gris, así que con YOLO real sale "Sin detección", y Llama no responde con frases fijas. En este modo la prueba revisa que llegue el análisis, que el borrador no traiga plazos y que la respuesta use métricas reales. Sin esa variable, la prueba espera el servicio de visión simulado y `npm run llm:simulado`.

Para que las capturas muestren una detección de verdad, descarga una foto de un bache y pásala a la prueba:

```powershell
$env:E2E_FOTO_BACHE="C:\ruta\a\bache.jpg"
npm run e2e
```

**Visión con una foto real.** Entra a <http://localhost:8000/docs>, abre `POST /api/analyze`, pulsa *Try it out*, sube una foto de un bache y pulsa *Execute*. La respuesta debe traer detecciones y una severidad.

---

## Opcional: GPS desde el celular

El navegador del celular solo entrega el GPS por HTTPS. Sigue `infra/certs/README.md` (mkcert) y levanta la app con `npm run dev:https`.

Sin HTTPS, el encargado igual puede marcar el punto tocando el mapa en `http://IP-DEL-PC:3000`. Para que funcione, agrega esa IP en `DEV_ALLOWED_ORIGINS` de `apps\web\.env`.

## Día a día

Para retomar el trabajo después de apagar el PC:

1. Abre Docker Desktop. Los contenedores `db` y `vision` vuelven a levantarse solos; si no, corre `docker compose -f infra/docker-compose.yml up -d db vision`.
2. Abre LM Studio, carga el modelo y prende el servidor.
3. En `apps\web`, corre `npm run dev`.

Después de un `git pull`:

```powershell
cd apps\web
npm install
npm run db:migrate
# solo si cambió services/vision:
cd ..\..
docker compose -f infra/docker-compose.yml up -d --build vision
```

## Problemas comunes

| Síntoma | Solución |
|---|---|
| `node` / `npm` no se reconoce | Cierra y abre PowerShell. Si sigue igual, reinstala Node 22 LTS. |
| `npm.ps1 no se puede cargar… ejecución de scripts deshabilitada` | Corre `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`. |
| `failed to connect to the docker API … dockerDesktopLinuxEngine` | Docker Desktop no está abierto. Ábrelo y espera *Engine running*. |
| `ECONNREFUSED 127.0.0.1:5432` al migrar | La base no está arriba. Corre `docker compose -f infra/docker-compose.yml up -d db`. |
| El puerto 5432 ya está en uso | Hay otro PostgreSQL instalado. Detenlo, o cambia `DB_PORT` en `infra\.env` y el puerto en `DATABASE_URL` de `apps\web\.env`. |
| El detalle del reporte dice "No se pudo analizar la foto" | El servicio de visión está apagado. Revisa `docker compose -f infra/docker-compose.yml logs vision` y después pulsa **Re-analizar** en el mismo detalle. |
| El copiloto dice "IA local apagada" | LM Studio no tiene el servidor prendido o no hay modelo cargado (paso 6). |
| El copiloto avisa que se agotó el tiempo de respuesta | Sube `LLM_INFERENCE_TIMEOUT_MS` en `apps\web\.env` (por ejemplo a `120000`) o usa un modelo más chico. |
| El mapa se ve gris | No hay internet: el mapa usa las teselas de OpenStreetMap. Igual se puede tocar para marcar el punto. |
