import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Peñalolén Reporta',
  description:
    'Plataforma municipal de Peñalolén para registrar y gestionar problemas del espacio público reportados por encargados barriales.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e3a8a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans bg-slate-50 text-slate-800 antialiased">{children}</body>
    </html>
  );
}
