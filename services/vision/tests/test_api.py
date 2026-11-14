"""
Pruebas del servicio de visión sin PyTorch ni pesos reales: `ultralytics.YOLO` se
reemplaza por un sustituto (tests/stubs) que devuelve detecciones conocidas.

Uso (desde services/vision):
    pip install fastapi python-multipart httpx numpy opencv-python-headless pytest
    PYTHONPATH=tests/stubs:. pytest -q tests          # Linux/macOS
    $env:PYTHONPATH="tests/stubs;."; pytest -q tests  # PowerShell
"""
import os
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def pesos(tmp_path: Path) -> Path:
    # El sustituto no lee los archivos: basta con que existan
    (tmp_path / "yolov8s_pothole_pretrained.pt").write_bytes(b"x")
    (tmp_path / "best_obb_80ep.pt").write_bytes(b"x")
    return tmp_path


def _imagen_jpg() -> bytes:
    img = np.full((240, 320, 3), 90, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def cargar(weights_dir: Path, **env):
    os.environ.pop("VISION_API_KEY", None)
    os.environ.update({"VISION_WEIGHTS_DIR": str(weights_dir), **env})
    sys.modules.pop("api_server", None)
    import api_server  # noqa: PLC0415

    return api_server, TestClient(api_server.app)


def subir(c, headers=None, data=None, ctype="image/jpeg"):
    data = _imagen_jpg() if data is None else data
    return c.post("/api/analyze", files={"file": ("x.jpg", data, ctype)}, headers=headers or {})


def test_ensemble_cumple_contrato(pesos):
    m, c = cargar(pesos)
    assert set(m.models) == {"pretrained", "local"}
    r = subir(c)
    assert r.status_code == 200, r.text
    j = r.json()
    assert set(j) >= {"boundingBoxes", "severidad", "ratioCobertura", "requiereRevision", "engineUsed", "timestamp"}
    assert j["engineUsed"] == "ensemble"
    assert len(j["boundingBoxes"]) == 1  # caja duplicada eliminada y clase 'object' filtrada
    b = j["boundingBoxes"][0]
    assert b["label"] == "bache" and b["confidence"] == 0.81
    assert all(0 <= b[k] <= 1 for k in ("x1", "y1", "x2", "y2"))
    assert 24 < j["ratioCobertura"] < 26 and j["severidad"] == "critica"
    assert j["requiereRevision"] is False


def test_cambio_de_motor(pesos):
    _, c = cargar(pesos)
    assert c.post("/api/switch_engine?engine=pretrained").json()["engine"] == "pretrained"
    j = subir(c).json()
    assert j["engineUsed"] == "pretrained" and len(j["boundingBoxes"]) == 1
    assert c.get("/api/engine").json()["engine"] == "pretrained"
    assert c.post("/api/switch_engine?engine=otro").status_code == 400


def test_archivos_invalidos(pesos):
    _, c = cargar(pesos)
    assert subir(c, ctype="text/plain").status_code == 400
    assert subir(c, data=b"no soy imagen").status_code == 400
    assert subir(c, data=b"").status_code == 400


def test_api_key_interna(pesos):
    _, c = cargar(pesos, VISION_API_KEY="secreta")
    assert subir(c).status_code == 401
    assert subir(c, headers={"X-API-Key": "secreta"}).status_code == 200
    assert c.get("/").status_code == 200  # el healthcheck queda abierto


def test_sin_pesos(tmp_path):
    _, c = cargar(tmp_path / "no-existe")
    assert c.get("/").json()["status"] == "sin_modelos"
    assert subir(c).status_code == 503
