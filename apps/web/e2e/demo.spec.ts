/**
 * Guion de la demo de punta a punta (PROMPT_DESARROLLO §11). Guarda capturas de
 * cada paso en docs/capturas/ para el equipo de informe.
 *
 *  1. La encargada registra un bache con foto, GPS y "6 vecinos por WhatsApp".
 *  2. Aparece con folio y, segundos después, la IA muestra "Severidad sugerida: Crítica".
 *  3. Otro encargado intenta registrar el mismo bache → suma respaldo → total 9.
 *  4. Se registra una luminaria en falla (sin IA).
 *  5. El funcionario DOM ordena por respaldos, ve los reportes en el mapa y abre el bache.
 *  6. Copiloto: borrador sin plazos + métricas reales por territorio.
 *  7. En gestión → Resuelto con foto de cierre.
 *  8. La encargada ve la notificación y el historial completo.
 */
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import sharp from 'sharp';

const CAPTURAS = process.env.E2E_CAPTURAS ?? path.resolve(__dirname, '../../../docs/capturas');
const CLAVE = process.env.SEED_PASSWORD ?? 'Demo2026!';

// Punto al azar cerca de La Faena: cada ejecución usa un lugar distinto y no choca con datos anteriores
const P = { latitude: -33.4815 + (Math.random() - 0.5) * 0.003, longitude: -70.579 + (Math.random() - 0.5) * 0.003 };
const CERCA = { latitude: P.latitude + 0.00004, longitude: P.longitude }; // ≈ 4 m al norte

async function foto(color: string) {
  const buffer = await sharp({ create: { width: 800, height: 600, channels: 3, background: color } }).jpeg().toBuffer();
  return { name: 'foto.jpg', mimeType: 'image/jpeg', buffer };
}

async function captura(page: Page, nombre: string) {
  await page.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

async function entrar(browser: Browser, email: string, celular: boolean, gps = P) {
  const ctx = await browser.newContext(
    celular
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: { ...gps, accuracy: 5 }, permissions: ['geolocation'] }
      : { viewport: { width: 1366, height: 900 } },
  );
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', CLAVE);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/(encargado|panel|admin)/);
  return page;
}

test('guion completo de la demo', async ({ browser }) => {
  // ---------------------------------------------------------------- 1. Encargada registra un bache
  const marta = await entrar(browser, 'encargada.lafaena@penalolen.demo', true);
  await captura(marta, '01-encargado-inicio');
  await marta.getByRole('link', { name: /Registrar problema/ }).click();
  await marta.getByRole('button', { name: /^Bache/ }).click();
  await expect(marta.getByText(/GPS · precisión ±5 m/)).toBeVisible();
  await marta.locator('input[type=file]').setInputFiles(await foto('#5a5a5a'));
  await captura(marta, '02-foto-y-ubicacion');
  await marta.getByRole('button', { name: 'Continuar' }).click();
  await marta.fill('#descripcion', 'Bache profundo frente al paradero, los autos lo esquivan.');
  for (let i = 0; i < 5; i++) await marta.getByRole('button', { name: 'Más vecinos' }).click();
  await marta.getByRole('button', { name: 'WhatsApp' }).click();
  await captura(marta, '03-detalles');
  await marta.getByRole('button', { name: 'Enviar reporte' }).click();

  // ---------------------------------------------------------------- 2. Folio + severidad sugerida por IA
  await expect(marta.getByText('Reporte registrado con el folio')).toBeVisible();
  const folio = (await marta.locator('p.font-mono.text-3xl').textContent())!.trim();
  expect(folio).toMatch(/^PR-\d{4}-\d{5}$/);
  await captura(marta, '04-folio');
  await marta.getByRole('link', { name: 'Ver el reporte' }).click();
  await expect(marta.getByText('Severidad sugerida por IA: Crítica').first()).toBeVisible({ timeout: 30_000 });
  const reporteId = marta.url().split('/').pop()!;
  await captura(marta, '05-severidad-ia');

  // ---------------------------------------------------------------- 3. Otro encargado suma respaldo (6 + 3 = 9)
  const luis = await entrar(browser, 'encargado.lohermida@penalolen.demo', true, CERCA);
  await luis.goto('/encargado/nuevo');
  await luis.getByRole('button', { name: /^Bache/ }).click();
  await expect(luis.getByText(/GPS · precisión/)).toBeVisible();
  await luis.locator('input[type=file]').setInputFiles(await foto('#606060'));
  await luis.getByRole('button', { name: 'Continuar' }).click();
  await expect(luis.getByText('Ya existe un reporte cerca')).toBeVisible();
  await captura(luis, '06-ya-existe-cerca');
  const tarjeta = luis.locator('li').filter({ hasText: folio });
  await tarjeta.getByRole('button', { name: 'Sumar respaldo' }).click();
  await tarjeta.getByRole('button', { name: 'Más vecinos' }).click();
  await tarjeta.getByRole('button', { name: 'Más vecinos' }).click();
  await tarjeta.getByRole('button', { name: 'En persona' }).click();
  await tarjeta.getByRole('button', { name: 'Sumar 3 vecinos' }).click();
  await expect(luis.getByText('Ahora lo respaldan 9 vecinos')).toBeVisible();
  await captura(luis, '07-respaldo-sumado');

  // ---------------------------------------------------------------- 4. Luminaria en falla (sin IA)
  await marta.goto('/encargado/nuevo');
  await marta.getByRole('button', { name: /Luminaria en falla/ }).click();
  await expect(marta.getByText(/GPS · precisión/)).toBeVisible();
  await marta.getByRole('button', { name: 'Continuar' }).click();
  if (await marta.getByText('Ya existe un reporte cerca').isVisible().catch(() => false)) {
    await marta.getByRole('button', { name: /Es otro problema/ }).click();
  }
  await marta.fill('#descripcion', 'Luminaria apagada hace una semana en el pasaje.');
  await marta.getByRole('button', { name: 'Junta de vecinos' }).click();
  await marta.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(marta.getByText('Reporte registrado con el folio')).toBeVisible();

  // ---------------------------------------------------------------- 5. Funcionario: bandeja, mapa y detalle
  const dom = await entrar(browser, 'dom@penalolen.demo', false);
  await dom.selectOption('select[aria-label="Ordenar por"]', 'respaldos');
  await dom.waitForURL(/orden=respaldos/);
  const fila = dom.locator('tbody tr').filter({ hasText: folio });
  await expect(fila).toContainText('9');
  await captura(dom, '08-bandeja-por-respaldos');
  await dom.goto('/panel/mapa');
  await expect(dom.locator('.leaflet-interactive').nth(1)).toBeAttached();
  await captura(dom, '09-mapa');
  await dom.goto(`/panel/reportes/${reporteId}`);
  await expect(dom.getByText('Análisis de la foto')).toBeVisible();
  await captura(dom, '10-detalle-panel');

  // ---------------------------------------------------------------- 6. Copiloto
  await dom.getByRole('link', { name: 'Consultar al copiloto' }).click();
  await expect(dom.getByText(/IA local activa/)).toBeVisible();
  await dom.getByRole('button', { name: 'Redactar respuesta para el encargado' }).click();
  const borrador = dom.locator('p.whitespace-pre-wrap').filter({ hasText: 'Borrador para revisión del funcionario' });
  await expect(borrador).toBeVisible({ timeout: 60_000 });
  await expect(borrador).toContainText('[plazo a definir por la DOM]');
  await expect(borrador).not.toContainText('48 horas');
  await dom.getByPlaceholder(/Escribe tu pregunta/).fill('¿Cuántos reportes abiertos hay por territorio?');
  await dom.keyboard.press('Enter');
  await expect(dom.locator('p.whitespace-pre-wrap').filter({ hasText: /abiertos por territorio/ })).toBeVisible({ timeout: 60_000 });
  await captura(dom, '11-copiloto');

  // ---------------------------------------------------------------- 7. En revisión → En gestión → Resuelto con foto
  await dom.goto(`/panel/reportes/${reporteId}`);
  for (const [boton, estado] of [
    ['Pasar a revisión', 'En revisión'],
    ['Pasar a gestión', 'En gestión'],
  ] as const) {
    await dom.getByRole('button', { name: boton }).click();
    await dom.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dom.getByText(`Estado actual: ${estado}`)).toBeVisible();
  }
  await dom.getByRole('button', { name: 'Cerrar como resuelto' }).click();
  await dom.getByLabel(/Comentario de cierre/).fill('Bache reparado por la cuadrilla de la DOM.');
  await dom.locator('input[type=file]').setInputFiles(await foto('#2f6f2f'));
  await dom.getByRole('button', { name: 'Confirmar' }).click();
  await expect(dom.getByText('Estado actual: Resuelto')).toBeVisible();
  await expect(dom.getByText('Evidencia de cierre')).toBeVisible();
  await captura(dom, '12-resuelto');

  // ---------------------------------------------------------------- 8. La encargada ve la notificación y el historial
  await marta.goto('/encargado');
  const campana = marta.getByRole('button', { name: /Notificaciones: \d+ sin leer/ });
  await expect(campana).toBeVisible();
  await campana.click();
  await captura(marta, '13-notificaciones');
  await marta.getByRole('button', { name: new RegExp(`${folio}.*fue resuelto`) }).click();
  await marta.waitForURL(new RegExp(`/encargado/reportes/${reporteId}`));
  await expect(marta.getByText('Reporte resuelto')).toBeVisible();
  await expect(marta.getByText('Se sumó respaldo vecinal')).toBeVisible();
  await captura(marta, '14-historial-encargada');

  // Consulta pública por folio (RF-10.1)
  await marta.goto(`/consulta/${folio}`);
  await expect(marta.getByText('Resuelto').first()).toBeVisible();
  await captura(marta, '15-consulta-publica');
});
