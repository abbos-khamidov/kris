import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.setTimeout(240_000);
const ready = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });
const BRAND_DIR = path.resolve("assets-private/brand");
const primary = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim().toLowerCase());

async function login(page: Page) {
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Логин или email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");
}

test("themes: instant apply, persistence across reload and devices, dark mode, reset, PDF unchanged", async ({ page, browser }) => {
  fs.rmSync(".data-test", { recursive: true, force: true });
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Имя").fill("Тест");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Создать учётную запись" }).click();
  await expect(page).toHaveURL("/");

  if (fs.existsSync(BRAND_DIR)) {
    await page.goto("/settings");
    await ready(page);
    await page.locator('input[type="file"][multiple]').first().setInputFiles(fs.readdirSync(BRAND_DIR).filter((f) => f.endsWith(".jpg")).map((f) => path.join(BRAND_DIR, f)));
    await expect(page.getByText(/Загружено изображений/)).toBeVisible({ timeout: 90_000 });
  }

  await page.goto("/settings");
  await ready(page);
  expect(await primary(page)).toBe("#791f2b"); // default Burgundy, untouched

  // instant switch, no reload
  await page.getByRole("radio", { name: "Navy" }).click();
  await expect.poll(() => primary(page)).toBe("#304760");
  await page.getByRole("radio", { name: "Sage" }).click();
  await expect.poll(async () => (await primary(page)).startsWith("#")).toBe(true);
  expect(await primary(page)).not.toBe("#791f2b");

  // custom colour via HEX
  await page.getByRole("radio", { name: "Свой цвет" }).click();
  await page.getByLabel("HEX").fill("#2E6F40");
  await expect.poll(() => primary(page)).toBe("#2e6f40");

  // dark theme
  await page.getByRole("radio", { name: "Тёмная" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe("rgb(245, 241, 237)");

  // saved to the account: survives reload and a completely different "device" (new context, same login)
  await page.waitForTimeout(1200);
  await page.reload();
  await ready(page);
  await expect(page.locator("html")).toHaveClass(/dark/);
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await login(p2);
  await ready(p2);
  await expect(p2.locator("html")).toHaveClass(/dark/);
  await other.close();

  // PDF preview is identical in light and dark UI themes
  await page.goto("/patients/new");
  await ready(page);
  await page.getByRole("textbox", { name: "ФИО *" }).fill("Вымышленная Тема Проверка");
  await page.getByRole("button", { name: "Создать пациента" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?tab=cards`);
  await ready(page);
  await page.getByRole("button", { name: "Новая карта" }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+$/);
  const canvas = page.locator('canvas[aria-label="Страница 1"]');
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2000);
  const darkShot = await canvas.screenshot();
  // the viewer chrome around the PDF stays light even in dark mode
  const toolbarBg = await page.evaluate(() => getComputedStyle(document.querySelector('button[aria-label="Увеличить"]')!.parentElement!.parentElement!).backgroundColor);
  expect(toolbarBg).toBe("rgb(255, 255, 255)");

  await page.goto("/settings");
  await ready(page);
  await page.getByRole("radio", { name: "Светлая" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.waitForTimeout(800);
  await page.goBack();
  await ready(page);
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2000);
  const lightShot = await canvas.screenshot();
  expect(Buffer.compare(darkShot, lightShot)).toBe(0); // pixel-identical PDF page

  // reset
  await page.goto("/settings");
  await ready(page);
  await page.getByRole("button", { name: "Сбросить оформление" }).click();
  await expect.poll(() => primary(page)).toBe("#791f2b");
});
