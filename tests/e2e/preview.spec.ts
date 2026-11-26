import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** The on-screen preview must follow edits (even with an unchanged page count) and survive fast redraws. */
test.setTimeout(120_000);
const ready = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });

const picture = (page: Page, n: number) =>
  page.getByLabel(`Страница ${n}`, { exact: true }).evaluate((c) => ((c as HTMLCanvasElement).dataset.rendered ? (c as HTMLCanvasElement).toDataURL() : ""));

test("preview redraws after an edit, and zooming repeatedly causes no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => void (m.type() === "error" && /canvas|render\(\)/i.test(m.text()) && errors.push(m.text())));

  fs.rmSync(".data-test", { recursive: true, force: true });
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Имя").fill("Тест");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Создать учётную запись" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/patients/new");
  await ready(page);
  await page.getByRole("textbox", { name: "ФИО *" }).fill("Вымышленная Предпросмотрова Проверка");
  await page.getByRole("button", { name: "Создать пациента" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?tab=cards`);
  await ready(page);
  await page.getByRole("button", { name: "Новая карта" }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+$/);
  await ready(page);

  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Состояние кожи/ }).click();
  await expect.poll(() => picture(page, 3), { timeout: 30_000 }).not.toBe("");
  const before = await picture(page, 3);

  await page.getByRole("button", { name: "Добавить блок" }).click();
  await page.getByRole("menuitem", { name: "Абзац" }).click();
  await page.getByLabel(/Состояние кожи, блок 1/).fill("Кожа сухая, есть шелушение.");
  await expect.poll(async () => (await picture(page, 3)) !== before, { timeout: 30_000 }).toBe(true);
  await expect(page.getByLabel("Страница 11", { exact: true })).toHaveCount(0); // same page count as before

  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: "Увеличить" }).click();
    await page.getByRole("button", { name: "Уменьшить" }).click();
  }
  await page.getByRole("button", { name: "По ширине" }).click();
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByLabel("Обновление")).toHaveCount(0, { timeout: 30_000 });
  expect(errors).toEqual([]);
});
