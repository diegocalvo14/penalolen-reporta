# Servicio de visión (FastAPI + YOLOv8) — CPU
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    YOLO_OFFLINE=1 \
    YOLO_CONFIG_DIR=/tmp/ultralytics

# Librerías de sistema que necesita OpenCV (ultralytics instala opencv-python)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# PyTorch solo-CPU: ~4 veces más liviano que la versión con CUDA
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY api_server.py .

# Los pesos (.pt) NO van en la imagen ni en git: se montan como volumen en /app/weights
ENV VISION_WEIGHTS_DIR=/app/weights
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/').status==200 else 1)"

CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"]
