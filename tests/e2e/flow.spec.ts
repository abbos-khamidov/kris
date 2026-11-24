import { expect, test } from "@playwright/test";
import fs from "node:fs";

test.beforeAll(() => {
  fs.rmSync(".data-test", { recursive: true, force: true });
});

test("setup, create patient, anamnesis autosave persists after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  // first run: closed registration, owner account is created once
  await page.getByLabel("Имя").fill("Тест Косметолог");
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Создать учётную запись" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/patients/new");
  await page.getByRole("textbox", { name: "ФИО *" }).fill("Вымышленная Анна Тестовна");
  await page.getByRole("button", { name: "Создать пациента" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Вымышленная Анна Тестовна" })).toBeVisible();
  const patientUrl = page.url();

  await page.goto(`${patientUrl}?tab=anamnesis`);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  // nothing is pre-selected as "Нет"
  const allergies = page.getByRole("radiogroup", { name: "Аллергии" });
  await expect(allergies.getByRole("radio", { name: "Не указано" })).toHaveAttribute("aria-checked", "true");
  await allergies.getByRole("radio", { name: "Да" }).click();
  await page.getByLabel("Аллергии: уточнение").fill("пыльца");
  await expect(page.getByText("Сохранено")).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Аллергии" }).getByRole("radio", { name: "Да" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Аллергии: уточнение")).toHaveValue("пыльца");
});

test("login rejects wrong password and registration is closed", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
  await page.getByLabel("Email").fill("owner@example.test");
  await page.getByLabel("Пароль").fill("wrong-password-1");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный email или пароль")).toBeVisible();
});
