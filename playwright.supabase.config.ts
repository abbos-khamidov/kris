import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke test against a REAL Supabase project. Credentials come from the environment only:
 *   KRIS_SUPABASE_URL, KRIS_SUPABASE_KEY (publishable key), KRIS_E2E_EMAIL, KRIS_E2E_PASSWORD
 * Never commit them. Run: npx playwright test -c playwright.supabase.config.ts
 */
const PORT = 3201;
export default defineConfig({
  testDir: "tests/e2e-supabase",
  timeout: 240_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.KRIS_BASE_URL ?? `http://localhost:${PORT}`, trace: "retain-on-failure" },
  webServer: process.env.KRIS_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          NEXT_DIST_DIR: ".next-supa",
          NEXT_PUBLIC_SUPABASE_URL: process.env.KRIS_SUPABASE_URL ?? "",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.KRIS_SUPABASE_KEY ?? "",
        },
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
