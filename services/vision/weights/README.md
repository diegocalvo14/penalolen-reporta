# Pesos del modelo (no se suben a git)

Esta carpeta debe contener los pesos del equipo IA (repo SolucionesBarriales):

| Archivo aquí | Origen en SolucionesBarriales | Motor |
|---|---|---|
| `yolov8s_pothole_pretrained.pt` | `IAvisual/yolov8s_pothole_pretrained.pt` | `pretrained` |
| `best_obb_80ep.pt` | `runs/obb/detector_baches_penalolen-3/weights/best.pt` (YOLOv8s-OBB, 80 épocas) | `local` |

El modo `ensemble` (por defecto) usa los dos.

En PowerShell, desde la carpeta `Ingenieria de Software`:

```powershell
Copy-Item SolucionesBarriales\IAvisual\yolov8s_pothole_pretrained.pt penalolen-reporta\services\vision\weights\
Copy-Item SolucionesBarriales\runs\obb\detector_baches_penalolen-3\weights\best.pt penalolen-reporta\services\vision\weights\best_obb_80ep.pt
```

Los nombres se pueden cambiar con `VISION_MODEL_PRETRAINED` y `VISION_MODEL_LOCAL` en el `.env`.
