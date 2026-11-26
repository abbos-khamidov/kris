import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** Local stand-in for both APIs: checks provider choice and fallback, not model quality. */
const hits: { path: string; body: Record<string, unknown> }[] = [];
let claudeStatus = 200;
let openaiText = "Наносить крем утром.";

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", () => {
    const path = req.url ?? "";
    hits.push({ path, body: JSON.parse(raw || "{}") });
    const claude = path.includes("/messages");
    const status = claude ? claudeStatus : 200;
    res.writeHead(status, { "content-type": "application/json", "x-should-retry": "false" });
    if (status !== 200) return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "no credit" } }));
    res.end(
      JSON.stringify(
        claude
          ? { id: "msg", type: "message", role: "assistant", model: "m", content: [{ type: "text", text: "Наносить крем утром." }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }
          : { id: "resp", object: "response", status: "completed", output: [{ type: "message", id: "m", role: "assistant", status: "completed", content: [{ type: "output_text", text: openaiText, annotations: [] }] }] },
      ),
    );
  });
});

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, r));
});
afterAll(() => void server.close());
afterEach(() => {
  vi.unstubAllEnvs();
  hits.length = 0;
  claudeStatus = 200;
  openaiText = "Наносить крем утром.";
});

function env(anthropic: string, openai: string) {
  const url = `http://localhost:${(server.address() as AddressInfo).port}`;
  vi.stubEnv("ANTHROPIC_API_KEY", anthropic);
  vi.stubEnv("OPENAI_API_KEY", openai);
  vi.stubEnv("ANTHROPIC_BASE_URL", url);
  vi.stubEnv("OPENAI_BASE_URL", `${url}/v1`);
}
const run = async () => {
  const { correctSpeech } = await import("@/lib/ai/correct");
  return correctSpeech({ phrase: "наносить крем утрам", context: "", glossary: [] });
};

describe("correctSpeech", () => {
  it("does nothing without keys", async () => {
    env("", "");
    expect(await run()).toBeNull();
    expect(hits).toHaveLength(0);
  });

  it("works with only the ChatGPT key and does not store the text", async () => {
    env("", "test-key");
    expect(await run()).toBe("Наносить крем утром.");
    expect(hits.map((h) => h.path)).toEqual(["/v1/responses"]);
    expect(hits[0].body.store).toBe(false);
  });

  it("prefers Claude when both keys are set", async () => {
    env("test-key", "test-key");
    expect(await run()).toBe("Наносить крем утром.");
    expect(hits.map((h) => h.path)).toEqual(["/v1/messages"]);
  });

  it("falls back to ChatGPT when the Claude request fails", async () => {
    env("test-key", "test-key");
    claudeStatus = 400;
    expect(await run()).toBe("Наносить крем утром.");
    expect(hits.map((h) => h.path)).toEqual(["/v1/messages", "/v1/responses"]);
  });

  it("rejects an answer that changes a number", async () => {
    env("", "test-key");
    openaiText = "Наносить крем 2 раза утром.";
    expect(await run()).toBeNull();
  });
});
