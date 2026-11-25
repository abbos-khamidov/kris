import fs from "node:fs";
import http from "node:http";
import { expect, test, type Page } from "@playwright/test";

/**
 * Dictation end to end, with a fake microphone (SpeechRecognition) and a local stand-in for the
 * Claude API (ANTHROPIC_BASE_URL in playwright.config.ts). It verifies OUR pipeline; it does not
 * measure real recognition or real model quality.
 */
test.setTimeout(120_000);
const ready = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });

let server: http.Server;
const requests: Record<string, unknown>[] = [];

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}") as { messages?: { content: string }[] };
      requests.push(body as Record<string, unknown>);
      const phrase = /<фраза>([\s\S]*?)<\/фраза>/.exec(body.messages?.[0]?.content ?? "")?.[1] ?? "";
      // "magnesium" imitates a model that wrongly changes a dose: the app must reject that answer.
      const text = phrase.includes("агний") ? "Магний 800 мг." : `${phrase.replace("вечеру", "вечером").replace(/[.]?$/, ".")}`;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [{ type: "text", text }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(4555, r));
});
test.afterAll(() => void server.close());

const fakeMic = () => {
  class FakeRec {
    onresult: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: unknown = null;
    start() {
      (window as unknown as { __rec: FakeRec }).__rec = this;
    }
    stop() {
      this.onend?.();
    }
    abort() {
      this.onend?.();
    }
  }
  const w = window as unknown as Record<string, unknown>;
  w.SpeechRecognition = FakeRec;
  w.webkitSpeechRecognition = FakeRec;
  w.__say = (t: string) => {
    const result = Object.assign([{ transcript: t }], { isFinal: true });
    (w.__rec as FakeRec).onresult?.({ resultIndex: 0, results: [result] });
  };
};
const say = (page: Page, text: string) => page.evaluate((t) => (window as unknown as { __say: (s: string) => void }).__say(t), text);

test("card sections: speech is written at once and corrected in place; doses protected; undo; personal page keeps review", async ({ page }) => {
  fs.rmSync(".data-test", { recursive: true, force: true });
  await page.addInitScript(fakeMic);
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Имя").fill("Тест");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Создать учётную запись" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/patients/new");
  await ready(page);
  await page.getByRole("textbox", { name: "ФИО *" }).fill("Вымышленная Голосовая Проверка");
  await page.getByRole("button", { name: "Создать пациента" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?tab=cards`);
  await ready(page);
  await page.getByRole("button", { name: "Новая карта" }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+$/);
  await ready(page);
  const nav = page.getByRole("navigation", { name: "Разделы карты" });

  await nav.getByRole("button", { name: /Состояние кожи/ }).click();
  await page.getByRole("button", { name: "Добавить блок" }).click();
  await page.getByRole("menuitem", { name: "Абзац" }).click();
  const field = page.getByLabel(/Состояние кожи, блок 1/);
  await page.getByRole("button", { name: "Надиктовать" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Claude"); // the specialist is told the text leaves the app
  await dialog.getByRole("button", { name: "Согласен, начать запись" }).click();
  await expect(page.getByText("Идёт запись")).toBeVisible();

  // written immediately (no confirmation step), then corrected in place
  await say(page, "наносить крем утром и вечеру");
  await expect(field).toHaveValue("Наносить крем утром и вечером.");
  // the second phrase is appended; spoken punctuation works; the wrong dose from the "model" is rejected
  await say(page, "магний 400 мг в сутки");
  await expect(field).toHaveValue("Наносить крем утром и вечером. Магний 400 мг в сутки");
  await page.getByRole("button", { name: "Стоп" }).click();
  await expect(page.getByText("Идёт запись")).toHaveCount(0);

  await page.getByRole("button", { name: "Отменить последний голосовой ввод" }).click();
  await expect(field).toHaveValue("Наносить крем утром и вечером.");
  await expect(page.getByText("Сохранено")).toBeVisible({ timeout: 15_000 });

  const first = requests[0] as { model: string; output_config: { effort: string }; temperature?: number; system: string };
  expect(first.model).toBe("claude-opus-5-5");
  expect(first.output_config.effort).toBe("low");
  expect(first.temperature).toBeUndefined();
  expect(first.system).toContain("Строго запрещено");
  expect(JSON.stringify(requests)).not.toContain("Вымышленная Голосовая"); // patient name is not sent

  // works in the other sections too
  for (const s of [/Схема ухода/, /Активы/, /Питание/, /Витамины/, /Рекомендованные/, /План процедур/, /Заключение/]) {
    await nav.getByRole("button", { name: s }).click();
    await expect(page.getByText("Нажмите микрофон в любом поле")).toBeVisible();
  }
  // cover and personal data are excluded
  await nav.getByRole("button", { name: /Личные данные/ }).click();
  await expect(page.getByText("Нажмите микрофон в любом поле")).toHaveCount(0);
  await page.getByRole("button", { name: "Надиктовать" }).first().click();
  await say(page, "пыльца");
  await page.getByRole("button", { name: "Остановить запись" }).click();
  await expect(page.getByText("Расшифровка — проверьте")).toBeVisible();
});
