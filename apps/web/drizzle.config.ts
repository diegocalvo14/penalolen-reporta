import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://reporta:reporta@localhost:5432/reporta',
  },
  // PostGIS crea sus propias tablas (spatial_ref_sys); no tocarlas
  extensionsFilters: ['postgis'],
  strict: true,
  verbose: true,
});
