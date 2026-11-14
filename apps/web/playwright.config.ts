import { defineConfig, devices } from '@playwright/test';

/**
 * Prueba de punta a punta del guion de la demo (PROMPT_DESARROLLO §11).
 * Requiere la app corriendo (npm run dev o docker compose) con la base de datos
 * y el servicio de visión. Para el copiloto usa LM Studio real o el simulado
 * (npm run llm:simulado). Primera vez: npx playwright install chromium
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
    launchOptions: process.env.E2E_CHROME_PATH ? { executablePath: process.env.E2E_CHROME_PATH, args: ['--no-sandbox'] } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
