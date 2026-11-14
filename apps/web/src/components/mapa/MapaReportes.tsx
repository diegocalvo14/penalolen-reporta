'use client';

import dynamic from 'next/dynamic';
import type { PuntoMapa } from '@/server/reportes/consultas';

const Leaflet = dynamic(() => import('./MapaReportesLeaflet'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-200" aria-label="Cargando mapa" />,
});

export default function MapaReportes(props: { puntos: PuntoMapa[]; centro: { lat: number; lng: number } }) {
  return <Leaflet {...props} />;
}
