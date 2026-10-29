import { defineConfig, devices } from "@playwright/test";

// E2E_PORT permite correr las pruebas contra otro servidor (p. ej. `next start -p 3001`
// con PAYMENTS_MODE=mock) sin tocar el `npm run dev` del puerto 3000.
const port = process.env.E2E_PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Todas las pruebas comparten la base de Supabase: un solo worker evita interferencias.
  workers: 1,
  retries: 0,
  // Supabase Cloud responde con latencia variable: 5 s por defecto es poco para páginas con varias consultas.
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
    channel: "chrome",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: port === "3000" ? "npm run dev" : `npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
