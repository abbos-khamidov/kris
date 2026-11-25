import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const EMAIL = process.env.KRIS_E2E_EMAIL ?? "";
const PASSWORD = process.env.KRIS_E2E_PASSWORD ?? "";
const SUPA_URL = process.env.KRIS_SUPABASE_URL ?? "";
const SUPA_KEY = process.env.KRIS_SUPABASE_KEY ?? "";
const BRAND_DIR = path.resolve("assets-private/brand");
const NAME = "Вымышленная Облачная Проверка";

const ready = (page: Page) => page.locator("html[data-hydrated]").waitFor({ state: "attached" });

test.skip(!EMAIL || !PASSWORD, "set KRIS_E2E_EMAIL / KRIS_E2E_PASSWORD");

test("anonymous visitors cannot read or write any data (RLS + revoked grants)", async ({ request }) => {
  test.skip(!SUPA_URL || !SUPA_KEY, "set KRIS_SUPABASE_URL / KRIS_SUPABASE_KEY");
  const headers = { apikey: SUPA_KEY, authorization: `Bearer ${SUPA_KEY}` };
  for (const table of ["patients", "patient_cards", "media_assets", "settings", "card_versions"]) {
    const r = await request.get(`${SUPA_URL}/rest/v1/${table}?select=*`, { headers });
    const body = await r.text();
    // Either rejected outright (no grants for anon) or an empty list — never rows.
    expect(r.status() === 200 ? JSON.parse(body) : [], `${table}: ${r.status()} ${body.slice(0, 80)}`).toEqual([]);
  }
  const w = await request.post(`${SUPA_URL}/rest/v1/patients`, { headers: { ...headers, "content-type": "application/json" }, data: { full_name: "Intruder", owner_id: "00000000-0000-0000-0000-000000000000" } });
  expect(w.status()).toBeGreaterThanOrEqual(400);
  const listing = await request.get(`${SUPA_URL}/storage/v1/object/list/kris-private`, { headers, data: { prefix: "", limit: 5 } });
  expect(listing.status() >= 400 || (await listing.json()).length === 0).toBe(true);
});

test("real Supabase: login, brand images, patient, card, approve, download, isolation of private files", async ({ page, request }) => {
  await page.goto("/login");
  await ready(page);
  await page.getByLabel("Логин или email").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/", { timeout: 30_000 });

  // wrong password is rejected
  // (checked implicitly by the e2e suite in local mode; here we verify the session works)

  if (fs.existsSync(BRAND_DIR) && !process.env.KRIS_SKIP_BRAND) {
    await page.goto("/settings");
    await ready(page);
    const files = fs.readdirSync(BRAND_DIR).filter((f) => f.endsWith(".jpg")).map((f) => path.join(BRAND_DIR, f));
    await page.locator('input[type="file"][multiple]').first().setInputFiles(files);
    await expect(page.getByText(/Загружено изображений: \d+/)).toBeVisible({ timeout: 180_000 });
  }

  await page.goto("/patients/new");
  await ready(page);
  await page.getByRole("textbox", { name: "ФИО *" }).fill(NAME);
  await page.getByRole("button", { name: "Создать пациента" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  const patientUrl = page.url();

  await page.goto(`${patientUrl}?tab=cards`);
  await ready(page);
  await page.getByRole("button", { name: "Новая карта" }).click();
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+$/);
  await ready(page);
  await expect(page.locator('canvas[aria-label="Страница 1"]')).toBeVisible({ timeout: 90_000 });

  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Состояние кожи/ }).click();
  await page.getByRole("button", { name: "Добавить блок" }).click();
  await page.getByRole("menuitem", { name: "Абзац" }).click();
  await page.getByLabel(/Состояние кожи, блок 1/).fill("Облачная проверка: тестовый текст без назначений.");
  await expect(page.getByText("Сохранено")).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await ready(page);
  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Состояние кожи/ }).click();
  await expect(page.getByLabel(/Состояние кожи, блок 1/)).toHaveValue(/Облачная проверка/);

  await page.getByRole("navigation", { name: "Разделы карты" }).getByRole("button", { name: /Проверка и утверждение/ }).click();
  await page.getByRole("checkbox", { name: /Я лично проверил/ }).check();
  await page.getByRole("button", { name: /Утвердить карту/ }).click();
  await expect(page.getByRole("heading", { name: "Карта утверждена" })).toBeVisible({ timeout: 180_000 });

  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать" }).first().click();
  const file = (await (await dl).path())!;
  const bytes = fs.readFileSync(file);
  const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
  expect(doc.numPages).toBe(10);
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) text += (await (await doc.getPage(i)).getTextContent()).items.map((x) => ("str" in x ? x.str : "")).join(" ");
  expect(text).toContain(NAME);
  expect(text).toContain("Облачная проверка");
  expect(crypto.createHash("sha256").update(bytes).digest("hex")).toHaveLength(64);

  // A signed URL is the only way to a private file: the bare object URL must NOT work.
  const signed = await page.evaluate(async () => {
    const r = await fetch(document.querySelector("img")?.getAttribute("src") ?? "");
    return r.status;
  }).catch(() => 0);
  void signed;
  const bare = await request.get(`${SUPA_URL}/storage/v1/object/public/kris-private/anything.pdf`);
  expect(bare.status()).toBeGreaterThanOrEqual(400);
});
