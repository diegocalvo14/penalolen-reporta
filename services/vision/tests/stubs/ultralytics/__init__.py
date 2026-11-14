"""Sustituto mínimo de ultralytics.YOLO para probar api_server.py sin PyTorch ni pesos reales."""
import numpy as np

class _T:
    def __init__(self, a): self.a = np.array(a, dtype=float)
    def __getitem__(self, i): return _T(self.a[i])
    def cpu(self): return self
    def numpy(self): return self.a

class _Box:
    def __init__(self, xyxy, conf, cls):
        self.xyxy = _T([xyxy]); self.conf = _T([conf]); self.cls = _T([cls])

class _Obb:
    def __init__(self, pts, conf, cls):
        self.xyxyxyxy = _T([pts]); self.conf = _T([conf]); self.cls = _T([cls])

class _Masks:
    def __init__(self, polys): self.xy = [np.array(p, dtype=float) for p in polys]
    def __len__(self): return len(self.xy)

class _Res:
    def __init__(self, names, boxes=None, obb=None, masks=None):
        self.names = names; self.boxes = boxes; self.obb = obb; self.masks = masks


class YOLO:
    def __init__(self, path):
        self.kind = "obb" if "obb" in path else "boxes"
    def __call__(self, image, conf, iou, verbose):
        h, w = image.shape[:2]
        if self.kind == "obb":
            # bache grande: ~ 50% x 50% del área = 25% -> crítica
            pts = [[0.2*w,0.2*h],[0.7*w,0.2*h],[0.7*w,0.7*h],[0.2*w,0.7*h]]
            return [_Res({0: "pothole"}, obb=[_Obb(pts, 0.81, 0)])]
        # mismo bache algo desplazado (debe deduplicarse) + clase basura 'object'
        return [_Res({0: "POTHOLE", 1: "object"}, boxes=[
            _Box([0.22*w,0.21*h,0.69*w,0.71*h], 0.55, 0),
            _Box([0,0,w,h], 0.9, 1),
        ])]
