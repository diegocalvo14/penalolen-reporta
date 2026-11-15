'use client';

import dynamic from 'next/dynamic';
import type { MapaSelectorProps } from './MapaSelector';

/** Leaflet usa `window`, así que el mapa se carga solo en el navegador. */
const MapaSelector = dynamic(() => import('./MapaSelector'), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-slate-200" aria-label="Cargando mapa" />,
});

export default function Mapa(props: MapaSelectorProps) {
  return <MapaSelector {...props} />;
}
