import type { NextConfig } from 'next';

/**
 * Orígenes extra permitidos en `next dev` (por ejemplo, el celular del encargado
 * entrando por la IP de la red local: http://192.168.1.20:3000).
 * Se configuran en .env con DEV_ALLOWED_ORIGINS separados por coma.
 */
const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Imagen de Docker liviana (server.js autocontenido)
  output: 'standalone',
  allowedDevOrigins,
  // pg y bcryptjs se ejecutan solo en el servidor (Node.js)
  serverExternalPackages: ['pg', 'bcryptjs', 'sharp'],
  poweredByHeader: false,
};

export default nextConfig;
