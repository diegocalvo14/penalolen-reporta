"""
Servicio de visión — Peñalolén Reporta (contrato PROMPT_DESARROLLO §8.2)

Basado en IAvisual/api_server.py del equipo IA (repo SolucionesBarriales, commit 1da74be).
La lógica de inferencia, la deduplicación de cajas y el cálculo de cobertura son
LOS MISMOS del original. Cambios (todos aditivos):

  1. Las rutas de los pesos se configuran por variables de entorno. El original
     elegía el best.pt "más reciente" por fecha de modificación, que después de un
     `git clone` queda casi al azar.
  2. La respuesta agrega `requiereRevision` y `engineUsed` (contrato §8.2).
  3. Nuevo GET /api/engine (contrato §8.2). switch_engine valida el motor.
  4. API key interna opcional entre la API de negocio y este servicio (RF-11.3).
  5. CORS restringido por variable de entorno (por defecto, ningún origen: la
     API de negocio llama a este servicio de servidor a servidor).
  6. Límite de tamaño de imagen (10 MB, igual que la app).

La severidad que devuelve este servicio es referencial: la API de negocio la
recalcula con los umbrales configurables de la base de datos (RF-5.2).
"""

import datetime
import os

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Configuración por entorno
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_DIR = os.environ.get("VISION_WEIGHTS_DIR", os.path.join(SCRIPT_DIR, "weights"))
MODEL_PRETRAINED = os.environ.get("VISION_MODEL_PRETRAINED", "yolov8s_pothole_pretrained.pt")
MODEL_LOCAL = os.environ.get("VISION_MODEL_LOCAL", "best_obb_80ep.pt")
DEFAULT_ENGINE = os.environ.get("VISION_DEFAULT_ENGINE", "ensemble")
API_KEY = os.environ.get("VISION_API_KEY", "").strip()
CORS_ORIGINS = [o.strip() for o in os.environ.get("VISION_CORS_ORIGINS", "").split(",") if o.strip()]
MAX_BYTES = int(os.environ.get("VISION_MAX_BYTES", str(10 * 1024 * 1024)))
CONF_MINIMA_REVISION = float(os.environ.get("VISION_CONF_REVISION", "0.4"))

ENGINES_VALIDOS = ("local", "pretrained", "ensemble")

app = FastAPI(
    title="Motor de Visión YOLO - Peñalolén Reporta",
    description="Detección automática de baches y severidad sugerida (contrato §8.2)",
    version="1.1.0",
)

if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )


def verificar_api_key(x_api_key: str | None = Header(default=None)):
    """RF-11.3: si VISION_API_KEY está definida, exige el header X-API-Key."""
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="api key inválida")


# ---------------------------------------------------------------------------
# Deduplicación de cajas (idéntica al original)
# ---------------------------------------------------------------------------
def deduplicate_boxes(boxes, iou_thresh=0.35, containment_thresh=0.60):
    """
    Elimina cajas duplicadas, superpuestas o anidadas que correspondan al mismo bache.
    """
    if len(boxes) <= 1:
        return boxes

    # Ordenar por confianza descendente (la mejor detección tiene prioridad)
    boxes = sorted(boxes, key=lambda b: b["confidence"], reverse=True)
    kept = []

    for current in boxes:
        cx1, cy1, cx2, cy2 = current["x1"], current["y1"], current["x2"], current["y2"]
        c_area = max(0.0, cx2 - cx1) * max(0.0, cy2 - cy1)
        duplicate = False

        for k in kept:
            kx1, ky1, kx2, ky2 = k["x1"], k["y1"], k["x2"], k["y2"]
            k_area = max(0.0, kx2 - kx1) * max(0.0, ky2 - ky1)

            ix1 = max(cx1, kx1)
            iy1 = max(cy1, ky1)
            ix2 = min(cx2, kx2)
            iy2 = min(cy2, ky2)

            iw = max(0.0, ix2 - ix1)
            ih = max(0.0, iy2 - iy1)
            inter_area = iw * ih

            if inter_area > 0:
                union_area = c_area + k_area - inter_area
                iou = inter_area / union_area if union_area > 0 else 0
                min_area = min(c_area, k_area)
                containment = inter_area / min_area if min_area > 0 else 0

                if iou >= iou_thresh or containment >= containment_thresh:
                    duplicate = True
                    break

        if not duplicate:
            kept.append(current)

    return kept


# ---------------------------------------------------------------------------
# Carga de modelos
# ---------------------------------------------------------------------------
def _ruta_peso(nombre: str) -> str:
    return nombre if os.path.isabs(nombre) else os.path.join(WEIGHTS_DIR, nombre)


current_engine = DEFAULT_ENGINE if DEFAULT_ENGINE in ENGINES_VALIDOS else "ensemble"
models: dict = {}
model_files: dict = {}


def load_engines():
    global models, model_files
    models, model_files = {}, {}
    for engine, nombre in (("pretrained", MODEL_PRETRAINED), ("local", MODEL_LOCAL)):
        ruta = _ruta_peso(nombre)
        if os.path.exists(ruta):
            models[engine] = YOLO(ruta)
            model_files[engine] = os.path.basename(ruta)
        else:
            print(f"[MOTORES] No se encontró el peso de '{engine}': {ruta}")
    print(f"[MOTORES] Modelos cargados: {list(models.keys())} desde {WEIGHTS_DIR}")


load_engines()


def _modelos_activos():
    if current_engine == "ensemble":
        return list(models.items())
    if current_engine in models:
        return [(current_engine, models[current_engine])]
    return list(models.items())[:1]


def _engine_usado(activos) -> str:
    nombres = [n for n, _ in activos]
    if current_engine == "ensemble" and len(nombres) > 1:
        return "ensemble"
    return nombres[0] if nombres else "ninguno"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def health_check():
    return {
        "status": "online" if models else "sin_modelos",
        "engine": current_engine,
        "available_engines": list(models.keys()) + ["ensemble"],
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


@app.get("/api/engine", dependencies=[Depends(verificar_api_key)])
def get_engine():
    return {
        "engine": current_engine,
        "available_engines": list(models.keys()) + ["ensemble"],
        "models": model_files,
    }


@app.post("/api/switch_engine", dependencies=[Depends(verificar_api_key)])
def switch_engine(engine: str = "ensemble"):
    global current_engine
    if engine not in ENGINES_VALIDOS:
        raise HTTPException(status_code=400, detail=f"motor no válido; usa {', '.join(ENGINES_VALIDOS)}")
    current_engine = engine
    print(f"[SWITCH] Modo de motor cambiado a: {current_engine}")
    return {"status": "switched", "engine": current_engine}


@app.post("/api/reload", dependencies=[Depends(verificar_api_key)])
def reload_model():
    load_engines()
    return {"status": "reloaded", "available_engines": list(models.keys())}


def _caja_normalizada(x1, y1, x2, y2, width, height, conf, label):
    return {
        "x1": round(max(0.0, min(1.0, x1 / width)), 4),
        "y1": round(max(0.0, min(1.0, y1 / height)), 4),
        "x2": round(max(0.0, min(1.0, x2 / width)), 4),
        "y2": round(max(0.0, min(1.0, y2 / height)), 4),
        "confidence": round(conf, 4),
        "label": label,
    }


def _etiqueta(results, cls_id):
    raw_label = str(results.names.get(cls_id, "POTHOLE")).strip()
    # Filtrar clase basura 'object' que proviene del dataset de internet
    if raw_label.lower() in ["object", "objeto"]:
        return None
    return "bache" if raw_label.upper() == "POTHOLE" else raw_label.lower()


@app.post("/api/analyze", dependencies=[Depends(verificar_api_key)])
async def analyze_image(file: UploadFile = File(...)):
    filename = getattr(file, "filename", "desconocido")
    content_type = getattr(file, "content_type", "") or ""
    print(f"\n[INFERENCIA] Recibida imagen: {filename} ({content_type})")

    if not file or not filename or not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="archivo no válido")

    if not models:
        raise HTTPException(status_code=503, detail="no hay modelos cargados; revisa VISION_WEIGHTS_DIR")

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="archivo no válido")
        if len(contents) > MAX_BYTES:
            raise HTTPException(status_code=400, detail="imagen demasiado grande")

        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None or image.size == 0:
            raise HTTPException(status_code=400, detail="archivo no válido")

        height, width, _ = image.shape
        total_area = float(width * height)
        activos = _modelos_activos()
        print(f"[INFERENCIA] {width}x{height} px | Modo: {current_engine.upper()} | Modelos: {[n for n, _ in activos]}")

        raw_candidates = []
        for _, m in activos:
            results = m(image, conf=0.18, iou=0.35, verbose=False)[0]

            has_masks = getattr(results, "masks", None) is not None and len(results.masks) > 0
            has_boxes = getattr(results, "boxes", None) is not None and len(results.boxes) > 0
            has_obb = getattr(results, "obb", None) is not None and len(results.obb) > 0

            if has_masks and has_boxes:
                for box, mask_poly in zip(results.boxes, results.masks.xy):
                    label = _etiqueta(results, int(box.cls[0].cpu().numpy()))
                    if label is None:
                        continue
                    conf = float(box.conf[0].cpu().numpy())
                    if len(mask_poly) > 0:
                        mx1, my1 = float(mask_poly[:, 0].min()), float(mask_poly[:, 1].min())
                        mx2, my2 = float(mask_poly[:, 0].max()), float(mask_poly[:, 1].max())
                    else:
                        c = box.xyxy[0].cpu().numpy()
                        mx1, my1, mx2, my2 = float(c[0]), float(c[1]), float(c[2]), float(c[3])
                    raw_candidates.append(_caja_normalizada(mx1, my1, mx2, my2, width, height, conf, label))
            elif has_boxes:
                for box in results.boxes:
                    label = _etiqueta(results, int(box.cls[0].cpu().numpy()))
                    if label is None:
                        continue
                    c = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0].cpu().numpy())
                    raw_candidates.append(
                        _caja_normalizada(float(c[0]), float(c[1]), float(c[2]), float(c[3]), width, height, conf, label)
                    )
            elif has_obb:
                for box in results.obb:
                    label = _etiqueta(results, int(box.cls[0].cpu().numpy()))
                    if label is None:
                        continue
                    coords = box.xyxyxyxy[0].cpu().numpy().reshape(-1, 2)
                    conf = float(box.conf[0].cpu().numpy())
                    raw_candidates.append(
                        _caja_normalizada(
                            float(coords[:, 0].min()),
                            float(coords[:, 1].min()),
                            float(coords[:, 0].max()),
                            float(coords[:, 1].max()),
                            width,
                            height,
                            conf,
                            label,
                        )
                    )

        clean_boxes = deduplicate_boxes(raw_candidates, iou_thresh=0.35, containment_thresh=0.60)
        print(f"[INFERENCIA] Cajas detectadas: {len(raw_candidates)} -> sin duplicados: {len(clean_boxes)}")

        max_ratio = 0.0
        for b in clean_boxes:
            box_w = (b["x2"] - b["x1"]) * width
            box_h = (b["y2"] - b["y1"]) * height
            ratio = float(((box_w * box_h) / total_area) * 100.0)
            max_ratio = max(max_ratio, ratio)

        # Regla de severidad del prototipo (la API de negocio la recalcula con umbrales configurables)
        if len(clean_boxes) == 0:
            severidad = "sin_deteccion"
            max_ratio = 0.0
        elif max_ratio > 20.0:
            severidad = "critica"
        elif max_ratio >= 8.0:
            severidad = "media"
        else:
            severidad = "baja"

        mejor_conf = max((b["confidence"] for b in clean_boxes), default=0.0)
        requiere_revision = severidad == "sin_deteccion" or mejor_conf < CONF_MINIMA_REVISION

        print(f"[RESULTADO] Severidad: {severidad.upper()}, Cobertura máx: {max_ratio:.2f}%, revisión: {requiere_revision}\n")

        return {
            "boundingBoxes": clean_boxes,
            "severidad": severidad,
            "ratioCobertura": round(float(max_ratio), 2),
            "requiereRevision": requiere_revision,
            "engineUsed": _engine_usado(activos),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — un error al procesar una imagen no debe tirar el servidor
        print(f"[ERROR INFERENCIA] {e}")
        raise HTTPException(status_code=400, detail="archivo no válido")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api_server:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
