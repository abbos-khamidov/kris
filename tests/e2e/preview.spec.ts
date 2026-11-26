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
  await page.getByRole("button", { name: "По размеру окна" }).click();
  // enlarging the window: pages follow, a whole page stays visible, nothing is flipped or stretched
  for (const size of [{ width: 1100, height: 700 }, { width: 2560, height: 1300 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(60);
  }
  const divider = page.getByRole("separator", { name: "Изменить ширину предпросмотра" });
  for (let i = 0; i < 14; i++) await divider.press("ArrowLeft");
  await expect(page.getByLabel("Обновление")).toHaveCount(0, { timeout: 30_000 });
  const shape = () =>
    page.getByLabel("Страница 1", { exact: true }).evaluate((c) => {
      const r = c.getBoundingClientRect();
      const area = c.parentElement!.parentElement!.getBoundingClientRect();
      return { ratio: r.width / r.height, fits: r.height <= area.height + 1 && r.width <= area.width + 1, transform: getComputedStyle(c).transform };
    });
  await expect.poll(async () => (await shape()).fits, { timeout: 30_000 }).toBe(true);
  const page1 = await shape();
  expect(page1.ratio).toBeCloseTo(595 / 822, 1);
  expect(page1.transform).toBe("none");
  // same orientation as before the resizing: the top-left corner of the picture still matches
  const sample = () =>
    page.getByLabel("Страница 3", { exact: true }).evaluate((c) => {
      const small = document.createElement("canvas");
      small.width = 20;
      small.height = 28;
      const g = small.getContext("2d")!;
      g.drawImage(c as HTMLCanvasElement, 0, 0, 20, 28);
      return Array.from(g.getImageData(0, 0, 20, 28).data);
    });
  const big = await sample();
  await page.getByRole("button", { name: "Уменьшить" }).click();
  await expect(page.getByLabel("Обновление")).toHaveCount(0, { timeout: 30_000 });
  const small = await sample();
  const difference = big.reduce((sum, v, i) => sum + Math.abs(v - small[i]), 0) / big.length;
  expect(difference).toBeLessThan(8);
  expect(errors).toEqual([]);
});
