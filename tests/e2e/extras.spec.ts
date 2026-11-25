import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

test.setTimeout(120_000);
const ready = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });

const MESSAGES = [
  "Солнышко, пока ты заботишься о красоте других, не забывай заботиться о себе.",
  "Самая красивая часть этого проекта сейчас смотрит на экран.",
  "Пока ты делаешь людей красивее, я стараюсь сделать твою жизнь немного легче.",
  "Даже за тысячи километров ты остаёшься моим солнышком.",
  "Этот кабинет создан, чтобы у тебя оставалось больше времени на себя. Ну и немного на меня.",
  "Если сегодня был тяжёлый день, просто знай: я горжусь тобой.",
  "Улыбнись. Тебе невероятно идёт.",
  "Здесь автоматизировано почти всё. Кроме того, как сильно я по тебе скучаю.",
  "Ты занимаешься красотой людей, а сама даже не представляешь, насколько красива.",
  "Некоторые проекты создаются ради денег. Этот создавался ради твоей улыбки.",
];

test("sun gift: opens only on click, random message, never the same twice in a row, not in the PDF app nav text", async ({ page }) => {
  fs.rmSync(".data-test", { recursive: true, force: true });
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Имя").fill("Тест");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Создать учётную запись" }).click();
  await expect(page).toHaveURL("/");

  // never opens by itself and is not described anywhere in the navigation
  await expect(page.getByText("Для моего солнышка")).toHaveCount(0);
  await expect(page.getByRole("navigation").first()).not.toContainText(/солныш|сюрприз|пасхал/i);

  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: "Солнце" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Для моего солнышка")).toBeVisible();
    await expect(dialog.getByText("С любовью, от твоего узбека, который похож на казаха")).toBeVisible();
    const text = (await dialog.locator("p.gift-text").innerText()).trim();
    expect(MESSAGES).toContain(text);
    seen.push(text);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
  for (let i = 1; i < seen.length; i++) expect(seen[i], `repeat at ${i}`).not.toBe(seen[i - 1]);
  expect(new Set(seen).size).toBeGreaterThan(3);
});

test("sun gift is reachable from the phone menu", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Логин или email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("button", { name: "Солнце" }).click();
  await expect(page.getByRole("dialog").getByText("Для моего солнышка")).toBeVisible();
  await ctx.close();
});

test("archive: patients and cards can be archived and restored", async ({ page }) => {
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Логин или email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/patients/new");
  await ready(page);
  await page.getByRole("textbox", { name: "ФИО *" }).fill("Вымышленная Архивная Пациентка");
  await page.getByRole("button", { name: "Создать пациента" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  const patientUrl = page.url();

  // card -> archive -> appears only in "Архив", restore -> back in "Все"
  await page.goto(`${patientUrl}?tab=cards`);
  await ready(page);
  await page.getByRole("button", { name: "Новая карта" }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+$/);
  await page.goto("/cards");
  await ready(page);
  await expect(page.getByText("Вымышленная Архивная Пациентка")).toBeVisible();
  await page.getByRole("button", { name: "В архив" }).first().click();
  await expect(page.getByText("Вымышленная Архивная Пациентка")).toHaveCount(0);
  await page.getByRole("link", { name: "Архив" }).click();
  await expect(page.getByText("Вымышленная Архивная Пациентка")).toBeVisible();
  await page.getByRole("button", { name: "Вернуть из архива" }).first().click();
  await expect(page.getByText("Архив пуст.")).toBeVisible();

  // patient -> archive -> hidden from active list, visible in archive
  await page.goto(patientUrl);
  await ready(page);
  await page.getByRole("button", { name: "В архив" }).click();
  await page.goto("/patients");
  await expect(page.getByText("Вымышленная Архивная Пациентка")).toHaveCount(0);
  await page.goto("/patients?archived=1");
  await expect(page.getByText("Вымышленная Архивная Пациентка")).toBeVisible();
});
