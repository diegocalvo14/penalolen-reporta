'use client';

/**
 * Mapa Leaflet + OpenStreetMap (RF-3.4). Modo edición: tocar el mapa o arrastrar
 * el marcador fija el punto. Modo lectura: solo muestra el punto.
 * Se carga solo en el navegador (ver Mapa.tsx).
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

export interface PuntoMapa {
  lat: number;
  lng: number;
}

// Marcador dibujado con CSS: evita el problema de las imágenes por defecto de Leaflet con los bundlers
function icono(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

function AlTocar({ onCambio }: { onCambio: (p: PuntoMapa) => void }) {
  useMapEvents({
    click(e) {
      onCambio({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Recentra el mapa cuando el punto cambia desde fuera (por ejemplo, llega el GPS). */
function Seguir({ punto, zoom }: { punto: PuntoMapa | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (punto) map.setView([punto.lat, punto.lng], Math.max(map.getZoom(), zoom), { animate: true });
  }, [punto, map, zoom]);
  return null;
}

export interface MapaSelectorProps {
  centro: PuntoMapa;
  punto: PuntoMapa | null;
  onCambio?: (p: PuntoMapa) => void;
  precisionM?: number | null;
  color?: string;
  alto?: number;
  zoom?: number;
}

export default function MapaSelector({
  centro,
  punto,
  onCambio,
  precisionM,
  color = '#1e3a8a',
  alto = 260,
  zoom = 16,
}: MapaSelectorProps) {
  const editable = Boolean(onCambio);
  const markerIcon = useMemo(() => icono(color), [color]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height: alto }}>
      <MapContainer
        center={[(punto ?? centro).lat, (punto ?? centro).lng]}
        zoom={punto ? zoom : 15}
        scrollWheelZoom={editable}
        dragging
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {punto && (
          <>
            <Marker
              position={[punto.lat, punto.lng]}
              icon={markerIcon}
              draggable={editable}
              eventHandlers={
                editable
                  ? {
                      dragend(e) {
                        const ll = (e.target as L.Marker).getLatLng();
                        onCambio?.({ lat: ll.lat, lng: ll.lng });
                      },
                    }
                  : undefined
              }
            />
            {precisionM ? (
              <Circle
                center={[punto.lat, punto.lng]}
                radius={precisionM}
                pathOptions={{ color, weight: 1, fillOpacity: 0.1 }}
              />
            ) : null}
          </>
        )}
        {editable && onCambio && <AlTocar onCambio={onCambio} />}
        <Seguir punto={punto} zoom={zoom} />
      </MapContainer>
    </div>
  );
}
