import { NextResponse } from "next/server";
import { z } from "zod";
import { textGuards } from "@/lib/ai/privacy";
import { ProofreadError, proofread, proofreadAvailable } from "@/lib/ai/proofread";
import { getCtxOrNull } from "@/lib/db";
import { createRateLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

const Input = z.object({ text: z.string().max(6000, "Слишком длинный текст: проверьте его частями").refine((t) => t.trim().length > 0, "Нечего проверять") });

const limiter = createRateLimiter([
  { limit: 20, windowMs: 60_000 },
  { limit: 300, windowMs: 3_600_000 },
]);

const fail = (error: string, status: number, headers?: HeadersInit) => NextResponse.json({ error }, { status, headers });

export async function POST(request: Request) {
  // The session cookie must not be usable from another site.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && URL.parse(origin)?.host !== host) return fail("Запрос отклонён", 403);

  try {
    const ctx = await getCtxOrNull();
    if (!ctx) return fail("Требуется вход", 401);
    if (!proofreadAvailable()) return fail("Проверка текста не настроена: добавьте OPENAI_API_KEY в Vercel и выполните Redeploy.", 503);

    const input = Input.safeParse(await request.json().catch(() => null));
    if (!input.success) return fail(input.error.issues[0]?.path.length ? input.error.issues[0].message : "Некорректный запрос", 400);

    const wait = limiter(ctx.user.id);
    if (wait) return fail(`Слишком много проверок. Повторите через ${wait} с.`, 429, { "retry-after": String(wait) });

    const result = await proofread(input.data.text, await textGuards(ctx));
    return NextResponse.json(
      { corrected: result.text, parts: result.parts, count: result.changes.length, rejected: result.rejected },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof ProofreadError) return fail(e.message, e.status);
    // The message may quote data, so only the error type is logged.
    console.error("[proofread] failed", e instanceof Error ? e.name : "unknown");
    return fail("Ошибка сервера. Повторите попытку.", 500);
  }
}
