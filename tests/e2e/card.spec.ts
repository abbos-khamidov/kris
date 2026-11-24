import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const BRAND_DIR = path.resolve("assets-private/brand");
const hasBrand = fs.existsSync(BRAND_DIR) && fs.readdirSync(BRAND_DIR).some((f) => f.endsWith(".jpg"));

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const ready = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });

async function readPdf(file: string) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    text += tc.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return { pages: doc.numPages, text };
}

test("full flow: brand images, patient, card, preview, approve, download, new version keeps v1 intact", async ({ page }) => {
  fs.rmSync(".data-test", { recursive: true, force: true });
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Имя").fill("Тест Косметолог");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Создать учётную запись" }).click();
  await expect(page).toHaveURL("/");

  // --- brand images (permanent template photos) uploaded once in Settings
  if (hasBrand) {
    await page.goto("/settings");
    await ready(page);
    const files = fs.readdirSync(BRAND_DIR).filter((f) => f.endsWith(".jpg")).map((f) => path.join(BRAND_DIR, f));
    await page.locator('input[type="file"][multiple]').first().setInputFiles(files);
    await expect(page.getByText(/Загружено изображений: \d+/)).toBeVisible({ timeout: 90_000 });
  }

  // --- patient
  await page.goto("/patients/new");
  await ready(page);
  await page.getByRole("textbox", { name: "ФИО *" }).fill("Вымышленная Анна Тестовна");
  await page.getByLabel("Дата рождения").fill("1996-03-10");
  await page.getByRole("button", { name: "Создать пациента" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  const patientUrl = page.url();

  // --- card from the Cards tab
  await page.goto(`${patientUrl}?tab=cards`);
  await ready(page);
  await page.getByRole("button", { name: "Новая карта" }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+$/);
  const cardUrl = page.url();
  await ready(page);

  // desktop: navigation · editor · PDF
  await expect(page.getByRole("navigation", { name: "Разделы карты" })).toBeVisible();
  await expect(page.locator('canvas[aria-label="Страница 1"]')).toBeVisible({ timeout: 60_000 });

  // edit "Состояние кожи": add a paragraph with text -> autosaved, confirmed by the server
  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Состояние кожи/ }).click();
  await page.getByRole("button", { name: "Добавить блок" }).click();
  await page.getByRole("menuitem", { name: "Абзац" }).click();
  await page.getByLabel(/Состояние кожи, блок 1/).fill("Тестовое заключение о коже без медицинских назначений.");
  await expect(page.getByText("Сохранено")).toBeVisible({ timeout: 15_000 });

  // reload: draft survives
  await page.reload();
  await ready(page);
  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Состояние кожи/ }).click();
  await expect(page.getByLabel(/Состояние кожи, блок 1/)).toHaveValue(/Тестовое заключение/);

  // --- review + approve
  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Проверка и утверждение/ }).click();
  await expect(page.getByText(/не указано/).first()).toBeVisible(); // medical fields are flagged, never auto-filled
  const approveBtn = page.getByRole("button", { name: /Утвердить карту/ });
  await expect(approveBtn).toBeDisabled(); // needs the specialist's explicit confirmation
  await page.getByRole("checkbox", { name: /Я лично проверил/ }).check();
  await approveBtn.click();
  await expect(page.getByRole("heading", { name: "Карта утверждена" })).toBeVisible({ timeout: 120_000 });

  // --- download the stored original PDF of version 1
  const dl1Promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать" }).first().click();
  const dl1 = await dl1Promise;
  expect(dl1.suggestedFilename()).toMatch(/^Карта_пациента_Вымышленная_Анна_Тестовна_\d{4}-\d{2}-\d{2}\.pdf$/);
  const p1 = (await dl1.path())!;
  const sha1 = crypto.createHash("sha256").update(fs.readFileSync(p1)).digest("hex");
  const pdf1 = await readPdf(p1);
  expect(pdf1.pages).toBe(10);
  expect(pdf1.text).toContain("Вымышленная Анна Тестовна");
  expect(pdf1.text).toContain("Тестовое заключение о коже");

  // --- new version: edit, approve again
  await page.getByRole("button", { name: "Создать новую версию" }).click();
  await ready(page);
  await expect(page.getByRole("navigation", { name: "Разделы карты" })).toBeVisible();
  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Состояние кожи/ }).click();
  await page.getByLabel(/Состояние кожи, блок 1/).fill("ИЗМЕНЁННЫЙ текст второй версии.");
  await expect(page.getByText("Сохранено")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Проверка и утверждение/ }).click();
  await page.getByRole("checkbox", { name: /Я лично проверил/ }).check();
  await page.getByRole("button", { name: /Утвердить карту/ }).click();
  await expect(page.getByRole("heading", { name: "Карта утверждена" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "Версия 2" })).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ hasText: "Версия 1" })).toHaveCount(1);

  // --- version 1 is byte-for-byte what it was (stored original, not regenerated)
  const v1Item = page.getByRole("listitem").filter({ hasText: "Версия 1" });
  const dlAgain = page.waitForEvent("download");
  await v1Item.getByRole("button", { name: "Скачать" }).click();
  const again = await dlAgain;
  const sha1Again = crypto.createHash("sha256").update(fs.readFileSync((await again.path())!)).digest("hex");
  expect(sha1Again).toBe(sha1);
  expect((await readPdf((await again.path())!)).text).not.toContain("ИЗМЕНЁННЫЙ");

  // --- version 2 contains the new text
  const v2Item = page.getByRole("listitem").filter({ hasText: "Версия 2" });
  const dl2Promise = page.waitForEvent("download");
  await v2Item.getByRole("button", { name: "Скачать" }).click();
  const dl2 = await dl2Promise;
  expect((await readPdf((await dl2.path())!)).text).toContain("ИЗМЕНЁННЫЙ текст второй версии");

  expect(cardUrl).toMatch(/cards\//);
});
