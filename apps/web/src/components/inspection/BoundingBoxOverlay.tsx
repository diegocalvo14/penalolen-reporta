/**
 * Foto con las cajas detectadas superpuestas (RF-5.3).
 * Adaptado de Soluciones Barriales (frontend/src/components/inspection/BoundingBoxOverlay.tsx).
 * Las coordenadas vienen normalizadas (0–1) y se dibujan en porcentaje.
 */
interface Caja {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  label: string;
}

export default function BoundingBoxOverlay({ imageUrl, boundingBoxes, alt = 'Imagen analizada' }: { imageUrl: string; boundingBoxes: Caja[]; alt?: string }) {
  return (
    <div className="flex justify-center rounded-xl bg-slate-900">
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element -- la foto pasa por /api/imagenes con control de acceso */}
        <img src={imageUrl} alt={alt} className="block max-h-96 w-auto max-w-full" />
        {boundingBoxes.map((box, idx) => (
          <div
            key={idx}
            className="pointer-events-none absolute"
            style={{
              left: `${box.x1 * 100}%`,
              top: `${box.y1 * 100}%`,
              width: `${(box.x2 - box.x1) * 100}%`,
              height: `${(box.y2 - box.y1) * 100}%`,
            }}
          >
            <div className="absolute inset-0 rounded-sm border-2 border-red-500 bg-red-500/15" />
            <div className="absolute left-0 top-0 flex -translate-y-full items-center gap-1 whitespace-nowrap rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">
              <span>{box.label}</span>
              <span className="opacity-80">{Math.round(box.confidence * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
