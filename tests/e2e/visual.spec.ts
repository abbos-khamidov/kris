import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Responsive QA matrix. Takes screenshots into test-results/visual/ and asserts the things that can be
 * asserted mechanically (no horizontal scroll, controls reachable, touch targets on phones).
 * It does NOT replace looking at the screenshots, and it does not claim real-device coverage.
 */
const VIEWPORTS = [
  { name: "320x568-phone-compact", width: 320, height: 568, touch: true },
  { name: "390x844-iphone", width: 390, height: 844, touch: true },
  { name: "430x932-phone-large", width: 430, height: 932, touch: true },
  { name: "768x1024-tablet-portrait", width: 768, height: 1024, touch: true },
  { name: "1024x768-tablet-landscape", width: 1024, height: 768, touch: true },
  { name: "1024x1366-ipad-pro", width: 1024, height: 1366, touch: true },
  { name: "1366x768-laptop", width: 1366, height: 768, touch: false },
  { name: "1440x900-laptop", width: 1440, height: 900, touch: false },
  { name: "1920x1080-desktop", width: 1920, height: 1080, touch: false },
  { name: "2560x1440-monitor", width: 2560, height: 1440, touch: false },
] as const;

const STATE = path.resolve(".data-test/visual-state.json");
const META = path.resolve(".data-test/visual-meta.json");
const OUT = path.resolve("test-results/visual");
const BRAND_DIR = path.resolve("assets-private/brand");

test.setTimeout(240_000);

const ready = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });

test.beforeAll(async ({ browser }) => {
  fs.rmSync(".data-test", { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Имя").fill("Тест Косметолог");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Создать учётную запись" }).click();
  await expect(page).toHaveURL("/");

  if (fs.existsSync(BRAND_DIR)) {
    await page.goto("/settings");
    await ready(page);
    const files = fs.readdirSync(BRAND_DIR).filter((f) => f.endsWith(".jpg")).map((f) => path.join(BRAND_DIR, f));
    await page.locator('input[type="file"][multiple]').first().setInputFiles(files);
    await expect(page.getByText(/Загружено изображений: \d+/)).toBeVisible({ timeout: 90_000 });
  }

  await page.goto("/patients/new");
  await ready(page);
  await page.getByRole("textbox", { name: "ФИО *" }).fill("Вымышленная Анна Тестовна");
  await page.getByRole("button", { name: "Создать пациента" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  const patientUrl = page.url();
  await page.goto(`${patientUrl}?tab=cards`);
  await ready(page);
  await page.getByRole("button", { name: "Новая карта" }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+$/);
  fs.writeFileSync(META, JSON.stringify({ patientUrl, cardUrl: page.url() }));
  await ctx.storageState({ path: STATE });
  await ctx.close();
});

async function open(browser: Browser, v: (typeof VIEWPORTS)[number]) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    hasTouch: v.touch,
    isMobile: v.touch,
    deviceScaleFactor: v.touch ? 2 : 1,
    storageState: STATE,
  });
  return { ctx, page: await ctx.newPage() };
}

async function noHorizontalScroll(page: Page, where: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, `horizontal overflow on ${where}`).toBeLessThanOrEqual(1);
}

for (const v of VIEWPORTS) {
  test(`layout ${v.name}`, async ({ browser }) => {
    const { page, ctx } = await open(browser, v);
    const meta = JSON.parse(fs.readFileSync(META, "utf8")) as { patientUrl: string; cardUrl: string };
    const shot = (n: string) => page.screenshot({ path: path.join(OUT, `${v.name}__${n}.png`), fullPage: false });

    // dashboard
    await page.goto("/");
    await ready(page);
    await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
    await noHorizontalScroll(page, "dashboard");
    await shot("1-dashboard");

    // patients
    await page.goto("/patients");
    await ready(page);
    await noHorizontalScroll(page, "patients");
    await shot("2-patients");

    // anamnesis form
    await page.goto(`${meta.patientUrl}?tab=anamnesis`);
    await ready(page);
    await noHorizontalScroll(page, "anamnesis");
    await shot("3-anamnesis");

    // settings (brand images grid)
    await page.goto("/settings");
    await ready(page);
    await noHorizontalScroll(page, "settings");
    await shot("4-settings");

    // card editor
    await page.goto(meta.cardUrl);
    await ready(page);
    if (v.width >= 1024) {
      await expect(page.getByRole("navigation", { name: "Разделы карты" })).toBeVisible();
      await expect(page.locator('canvas[aria-label="Страница 1"]')).toBeVisible({ timeout: 60_000 });
    } else {
      await expect(page.getByRole("tab", { name: "Разделы" })).toBeVisible();
    }
    await noHorizontalScroll(page, "card editor");
    await shot("5-card-editor");

    if (v.width < 1024) {
      // step-by-step on phones/tablet portrait: section list -> editor -> full-screen PDF
      await page.getByRole("button", { name: /Личные данные/ }).click();
      await expect(page.getByRole("radiogroup", { name: "Аллергии" })).toBeVisible();
      await noHorizontalScroll(page, "card editor / personal");
      await shot("6-card-personal");
      // primary controls must be at least 44x44 on touch devices
      const small = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("button, a, [role=radio], [role=tab], select, input[type=checkbox]"))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue; // hidden
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none") continue;
          if (r.height < 43.5 || (r.width < 43.5 && !/checkbox/.test(el.getAttribute("type") ?? ""))) {
            bad.push(`${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }
        return bad;
      });
      expect(small, `touch targets under 44px at ${v.name}`).toEqual([]);
      await page.getByRole("tab", { name: "PDF" }).click();
      await expect(page.locator('canvas[aria-label="Страница 1"]')).toBeVisible({ timeout: 60_000 });
      await noHorizontalScroll(page, "card editor / pdf");
      await shot("7-card-pdf");
    }
    await ctx.close();
  });
}
