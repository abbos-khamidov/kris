import { defineConfig, devices } from "@playwright/test";

const PORT = 3101;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_DIST_DIR: ".next-test", KRIS_DATA_DIR: ".data-test", ANTHROPIC_API_KEY: "test-key-for-local-stub", ANTHROPIC_BASE_URL: "http://localhost:4555", SESSION_SECRET: "test-secret-not-for-production-0123456789" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
