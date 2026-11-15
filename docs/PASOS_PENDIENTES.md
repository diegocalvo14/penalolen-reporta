# Lo que falta hacer en el PC de la demo (Torre)

Todo lo que se podía construir y probar sin el PC está hecho (`docs/HITOS.md`). Estos pasos necesitan tu computador, en este orden.

## 1. Actualizar dependencias y base de datos
```powershell
cd "$HOME\Proyectos\Ingenieria de Software\penalolen-reporta\apps\web"
npm install
npm run db:migrate
```
(No hay migraciones nuevas desde el Hito 1, pero conviene correrlo igual.)

## 2. Servicio de visión con el modelo real (Docker)
```powershell
cd ..\..
docker compose -f infra/docker-compose.yml up -d --build vision
docker compose -f infra/docker-compose.yml logs vision
```
Debe decir `Modelos cargados: ['pretrained', 'local']`. Prueba una foto real de bache en <http://localhost:8000/docs> (`POST /api/analyze`).

## 3. Copiloto con Llama 3
LM Studio → descargar *Llama 3.1 8B Instruct* (Q4) → Developer → Start Server (:1234). Si en la Torre responde lento (más de 60 s), sube `LLM_INFERENCE_TIMEOUT_MS` o usa un modelo más chico (*Llama 3.2 3B*).

## 4. Probar el guion completo
```powershell
cd apps\web
npm run dev
# en otra terminal:
npx playwright install chromium
$env:E2E_IA_REAL="1"
npm run e2e
```
Esto deja las capturas finales en `docs/capturas/`, con el mapa real y la IA real. **Ojo:** con el modelo real, la foto sintética gris de la prueba puede quedar como "Sin detección". Para la demo en vivo usa una foto real de bache.

## 5. GPS en el celular (opcional, pero luce en la demo)
Seguir `infra/certs/README.md` (mkcert + `npm run dev:https` + instalar `rootCA.pem` en el celular).

## 6. Validar textos con el equipo
- `apps/web/src/server/copiloto/referencias.ts`: normativa y procedimiento que usa el copiloto (borrador con fuentes públicas).
- Territorios y centroides (aproximados) en `/admin` → Territorios.

## 7. Git
```powershell
cd "$HOME\Proyectos\Ingenieria de Software\penalolen-reporta"
git checkout -b feat/plataforma-integrada
git add .
git commit -m "feat: plataforma integrada Peñalolén Reporta (hitos 1 a 7)"
git push -u origin feat/plataforma-integrada
```
`.gitignore` ya excluye los `.env`, las fotos, los pesos `.pt` y los certificados.

## 8. Avisar al otro grupo
Enviarles `docs/NOTAS_PARA_EQUIPO_IA.md`.
