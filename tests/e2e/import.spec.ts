import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Fictional sample card produced by our own renderer (scripts/gen-sample-pdfs.tsx) — no real patient data.
const SAMPLE = path.resolve("assets-private/samples/sample-short-frame.pdf");
test.skip(!fs.existsSync(SAMPLE), "run: npx tsx scripts/gen-sample-pdfs.tsx");
test.setTimeout(120_000);

const ready = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });

test("import: parse a PDF in the browser, review candidates, add only what is ticked, no duplicates, personal data stays inside the import", async ({ page }) => {
  fs.rmSync(".data-test", { recursive: true, force: true });
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Имя").fill("Тест");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Создать учётную запись" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/import");
  await ready(page);
  const choose = page.getByRole("button", { name: "Выбрать PDF" });
  await expect(choose).toBeDisabled(); // consent first
  await page.getByRole("checkbox", { name: /Я понимаю это/ }).check();
  await expect(choose).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles(SAMPLE);
  await expect(page.getByText(/Найдено: \d+/)).toBeVisible({ timeout: 60_000 });

  // same file again -> detected as a duplicate, nothing is created twice
  await page.locator('input[type="file"]').setInputFiles(SAMPLE);
  await expect(page.getByText("Уже импортирован")).toBeVisible({ timeout: 60_000 });

  await page.getByRole("link", { name: /sample-short-frame\.pdf/ }).click();
  await expect(page).toHaveURL(/\/import\/[0-9a-f-]+$/);
  await ready(page);

  // personal data of the source patient is hidden by default and lives only here
  await expect(page.getByText("Вымышленная Анна Тестовна")).toHaveCount(0);
  await page.getByRole("button", { name: /Персональные данные пациента/ }).click();
  await expect(page.getByText(/Возраст/)).toBeVisible();

  // nothing is added until ticked
  const first = page.getByRole("checkbox").first();
  await expect(first).not.toBeChecked();
  const boxes = page.getByRole("checkbox");
  const total = await boxes.count();
  expect(total).toBeGreaterThan(3);
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole("button", { name: /Добавить отмеченное в библиотеку/ }).click();
  await expect(page.getByText(/Добавлено:/)).toBeVisible({ timeout: 30_000 });

  // the library received something, marked as imported and approved by the specialist's confirmation
  await page.goto("/templates");
  const catalog = await page.goto("/catalog");
  expect(catalog?.status()).toBe(200);

  // deleting the import removes the source patient's personal data
  await page.goto("/import");
  await page.getByRole("link", { name: /sample-short-frame\.pdf/ }).click();
  await page.getByRole("button", { name: "Удалить импорт" }).click();
  await expect(page).toHaveURL(/\/import$/, { timeout: 30_000 });
  await expect(page.getByText("Импортов пока нет.")).toBeVisible();
});
