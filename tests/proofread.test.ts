import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../src/lib/rate-limit";
import { anonymize } from "../src/lib/text/anonymize";
import { safeMerge } from "../src/lib/text/safe-diff";

vi.mock("server-only", () => ({}));

describe("safeMerge: only spelling, grammar and punctuation", () => {
  it("applies corrections and counts them", () => {
    const r = safeMerge("кожа сухая , есть шелушенее и не большое покраснение", "Кожа сухая, есть шелушение и небольшое покраснение.");
    expect(r.text).toBe("Кожа сухая, есть шелушение и небольшое покраснение.");
    expect(r.rejected).toBe(0);
    expect(r.changes.length).toBeGreaterThan(2);
  });

  it.each([
    ["Магний 400 мг в сутки", "Магний 800 мг в сутки"],
    ["Магний 400 мг в сутки", "Магний 400 мкг в сутки"],
    ["Курс 2-3 недели", "Курс 23 недели"],
    ["Крем 5% на ночь", "Крем 5 на ночь"],
    ["Не наносить на веки", "Наносить на веки"],
    ["Принимать до еды", "Принимать после еды"],
    ["Диагноз: гипертония", "Диагноз: гипотония"],
    ["Наносить утром", "Наносить вечером"],
    ["Крем Avene на ночь", "Крем Aven на ночь"],
    ["Использовать ретинол", "Использовать адапален"],
    ["Кожа жирная", "Кожа жирная, рекомендую пилинг"],
  ])("keeps the meaning: %s -> %s", (from, to) => {
    expect(safeMerge(from, to).text).toBe(from);
  });

  it("discards only the unsafe fragment and keeps the other fixes", () => {
    const r = safeMerge("Наносить крэм 2 раза в день", "Наносить крем 3 раза в день.");
    expect(r.text).toContain("крем 2 раза");
    expect(r.rejected).toBe(1);
  });

  it("does not touch catalogue names", () => {
    expect(safeMerge("Гель Холи Лэнд", "Гель Холи Лэнд.", ["Холи Лэнд"]).text).toBe("Гель Холи Лэнд.");
    expect(safeMerge("Гель Холи Лэнд", "Гель Холи Лэнд", ["Холи Лэнд"]).changes).toHaveLength(0);
    expect(safeMerge("Сыворотка Клерасил", "Сыворотка Клирасил", ["Клерасил"]).text).toBe("Сыворотка Клерасил");
  });
});

describe("anonymize", () => {
  const source = "Сухаревой Полине звонить +7 (999) 123-45-67, почта test@example.com, ник @polina_test, визит 05.11.2026, паспорт 4510 123456. Петрова А.С. направила. Крем 2 раза.";
  const hidden = anonymize(source, ["Полина Сухарева"]);

  it("removes personal data and keeps doses", () => {
    for (const secret of ["Сухаревой", "Полине", "123-45-67", "test@example.com", "@polina_test", "05.11.2026", "4510 123456", "Петрова"]) {
      expect(hidden.text, secret).not.toContain(secret);
    }
    expect(hidden.text).toContain("Крем 2 раза");
  });

  it("restores exactly, and refuses answers that lost a marker", () => {
    expect(hidden.restore(hidden.text)).toBe(source);
    expect(hidden.restore(hidden.text.replace("⟦1⟧", ""))).toBeNull();
    expect(hidden.restore(`${hidden.text} ⟦1⟧`)).toBeNull();
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers when the window passes", () => {
    const allow = createRateLimiter([{ limit: 2, windowMs: 1000 }]);
    expect(allow("u", 0)).toBe(0);
    expect(allow("u", 10)).toBe(0);
    expect(allow("u", 20)).toBeGreaterThan(0);
    expect(allow("other", 20)).toBe(0);
    expect(allow("u", 1100)).toBe(0);
  });
});

describe("proofread: OpenAI request and error handling", () => {
  let status = 200;
  let code = "";
  let answer = (input: string) => input;
  const bodies: Record<string, unknown>[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const body = JSON.parse(raw) as { input: string };
      bodies.push(body);
      res.writeHead(status, { "content-type": "application/json", "x-should-retry": "false" });
      if (status !== 200) return res.end(JSON.stringify({ error: { message: "x", code } }));
      res.end(JSON.stringify({ id: "r", object: "response", status: "completed", output: [{ type: "message", id: "m", role: "assistant", status: "completed", content: [{ type: "output_text", text: answer(body.input), annotations: [] }] }] }));
    });
  });
  beforeAll(async () => {
    await new Promise<void>((r) => server.listen(0, r));
  });
  afterAll(() => void server.close());
  afterEach(() => {
    status = 200;
    code = "";
    bodies.length = 0;
    answer = (input) => input;
    vi.unstubAllEnvs();
  });
  const run = async (text: string) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", `http://localhost:${(server.address() as AddressInfo).port}/v1`);
    const { proofread } = await import("@/lib/ai/proofread");
    return proofread(text, { names: ["Тестова Анна"], terms: [] });
  };

  it("uses gpt-4.1-mini, stores nothing, hides the name and restores it", async () => {
    answer = (input) => input.replace("крэм", "крем");
    const r = await run("Анне Тестовой нанести крэм");
    expect(r.text).toBe("Анне Тестовой нанести крем");
    expect(r.changes).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ model: "gpt-4.1-mini", store: false });
    expect(String(bodies[0].input)).not.toMatch(/Анн|Тестов/);
  });

  it("rejects a rewritten text", async () => {
    answer = () => "Ок";
    await expect(run("Наносить крем утром и вечером")).rejects.toMatchObject({ status: 422 });
  });

  it.each([
    [401, "invalid_api_key", 502, "ключ"],
    [429, "insufficient_quota", 502, "балансе"],
    [429, "rate_limit_exceeded", 429, "ограничил"],
    [500, "", 502, "недоступен"],
  ])("explains API error %i %s", async (s, c, expected, text) => {
    status = s;
    code = c;
    await expect(run("Наносить крем")).rejects.toMatchObject({ status: expected, message: expect.stringContaining(text) });
  });
});
