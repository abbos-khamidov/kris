import fs from "node:fs";
import http from "node:http";
import { expect, test, type Page } from "@playwright/test";

/**
 * «Проверить текст» end to end: real button, real /api/proofread (auth, guards), with a local
 * stand-in for the OpenAI API (OPENAI_BASE_URL in playwright.config.ts). Model quality is not measured.
 */
test.setTimeout(150_000);
const ready = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });

let server: http.Server;
let status = 200;
const inputs: string[] = [];

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const input = (JSON.parse(raw || "{}") as { input?: string }).input ?? "";
      inputs.push(input);
      res.writeHead(status, { "content-type": "application/json", "x-should-retry": "false" });
      if (status !== 200) return res.end(JSON.stringify({ error: { message: "x", code: "insufficient_quota" } }));
      // fixes the spelling, but also tries to change the dose: the dose must stay
      const text = input.replace("крэм", "крем").replace("2 раза", "3 раза");
      res.end(JSON.stringify({ id: "r", object: "response", status: "completed", output: [{ type: "message", id: "m", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] }] }));
    });
  });
  await new Promise<void>((r) => server.listen(4556, r));
});
test.afterAll(() => void server.close());

test("check text: only on click, accept and reject, dose kept, error shown, three screen sizes", async ({ page, browser }) => {
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
  await page.getByRole("textbox", { name: "ФИО *" }).fill("Вымышленная Корректорова Проверка");
  await page.getByRole("button", { name: "Создать пациента" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?tab=cards`);
  await ready(page);
  await page.getByRole("button", { name: "Новая карта" }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+$/);
  await ready(page);

  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Состояние кожи/ }).click();
  await page.getByRole("button", { name: "Добавить блок" }).click();
  await page.getByRole("menuitem", { name: "Абзац" }).click();
  const field = page.getByLabel(/Состояние кожи, блок 1/);
  const original = "Корректоровой наносить крэм 2 раза в день";
  await field.pressSequentially(original, { delay: 5 });
  expect(inputs).toHaveLength(0); // typing sends nothing

  const check = page.getByRole("button", { name: /Проверить текст/ });
  await check.click();
  expect(inputs).toHaveLength(0); // first use asks for consent
  await page.getByRole("button", { name: "Согласен, проверить" }).click();
  await expect(page.getByText("Исправлений: 1")).toBeVisible();
  await expect(page.getByText("отклонено небезопасных правок: 1")).toBeVisible();
  expect(inputs[0]).not.toContain("Корректоров"); // the patient name never leaves the app
  await expect(field).toHaveValue(original); // nothing changes before accepting

  await page.getByRole("button", { name: "Отклонить" }).click();
  await expect(field).toHaveValue(original);
  await check.click();
  await page.getByRole("button", { name: "Принять" }).click();
  await expect(field).toHaveValue("Корректоровой наносить крем 2 раза в день");

  status = 429;
  await check.click();
  await expect(page.getByRole("alert").filter({ hasText: "балансе OpenAI" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  status = 200;
  await expect(page.getByText("Сохранено")).toBeVisible({ timeout: 15_000 });

  const url = page.url();
  const state = await page.context().storageState();
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, storageState: state, hasTouch: viewport.width < 1000 });
    const p = await context.newPage();
    await p.goto(url);
    await ready(p);
    if (viewport.width < 1024) await p.getByRole("tab", { name: "Редактор" }).click();
    const button = p.getByRole("button", { name: /Проверить текст/ });
    await expect(button).toBeVisible();
    await button.click();
    await p.getByRole("button", { name: "Согласен, проверить" }).or(p.getByText(/Исправлений|Ошибок не найдено/)).first().waitFor();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${viewport.width}px`).toBeLessThanOrEqual(0);
    await context.close();
  }

  // without a session the endpoint answers 401 and sends nothing to OpenAI
  const sent = inputs.length;
  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await anonymous.request.post(new URL("/api/proofread", url).href, { data: { text: "проверка" } });
  expect(res.status()).toBe(401);
  expect(inputs).toHaveLength(sent);
  await anonymous.close();
});
