import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';

/** GET /api/health — estado del servidor y de la BD (lo usa el healthcheck de Docker). */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'ok', db: 'ok' });
  } catch {
    return NextResponse.json({ status: 'degradado', db: 'sin conexión' }, { status: 503 });
  }
}
