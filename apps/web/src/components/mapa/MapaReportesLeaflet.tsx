'use client';

/** Mapa del panel (RF-6.2): un marcador por reporte, color por categoría y estilo por estado. */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Link from 'next/link';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { ESTADO_LABEL, esAbierto } from '@/domain/estados';
import { SEVERIDAD_LABEL } from '@/domain/severidad';
import type { PuntoMapa } from '@/server/reportes/consultas';

function Encuadre({ puntos }: { puntos: PuntoMapa[] }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length === 0) return;
    const bounds = L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [puntos, map]);
  return null;
}

export default function MapaReportesLeaflet({ puntos, centro }: { puntos: PuntoMapa[]; centro: { lat: number; lng: number } }) {
  return (
    <MapContainer center={[centro.lat, centro.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {puntos.map((p) => {
        const abierto = esAbierto(p.estado);
        const critico = p.severidad === 'critica';
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={Math.min(18, 7 + Math.sqrt(p.totalRespaldoVecinos) * 1.5)}
            pathOptions={{
              color: critico ? '#7f1d1d' : '#ffffff',
              weight: critico ? 3 : 2,
              fillColor: p.categoria.color,
              fillOpacity: abierto ? 0.9 : 0.3,
              dashArray: abierto ? undefined : '3 3',
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <Link href={`/panel/reportes/${p.id}`} className="font-mono font-semibold text-navy-700">
                  {p.folio}
                </Link>
                <p className="font-medium">{p.categoria.nombre}</p>
                <p className="text-slate-600">
                  {ESTADO_LABEL[p.estado]} · {p.totalRespaldoVecinos} vecinos · {p.territorio}
                </p>
                {p.severidad && <p className="text-slate-600">Severidad sugerida por IA: {SEVERIDAD_LABEL[p.severidad]}</p>}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      <Encuadre puntos={puntos} />
    </MapContainer>
  );
}
