"use server";
import { z } from "zod";
import { guard, ok } from "@/lib/action";
import { correctSpeech, correctionAvailable } from "@/lib/ai/correct";
import { getCtx } from "@/lib/db";

const Input = z.object({
  phrase: z.string().trim().min(1).max(1500),
  context: z.string().max(2000).default(""),
  terms: z.array(z.string().max(120)).max(80).default([]),
});

/** Per-user sliding window: protects the owner's API budget from a stuck microphone. */
const calls = new Map<string, number[]>();
function allowed(userId: string) {
  const now = Date.now();
  const recent = (calls.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 60) return false;
  recent.push(now);
  calls.set(userId, recent);
  return true;
}

export async function voiceStatusAction() {
  return guard<{ ai: boolean }>(async () => {
    await getCtx();
    return ok({ ai: correctionAvailable() });
  });
}

export async function correctSpeechAction(input: unknown) {
  return guard<{ text: string | null }>(async () => {
    const ctx = await getCtx();
    const v = Input.parse(input);
    if (!correctionAvailable() || !allowed(ctx.user.id)) return ok({ text: null });
    const products = await ctx.db.select<{ name: string; brand: string; archived_at: string | null }>("products", { limit: 200 });
    const glossary = [...new Set([...products.filter((p) => !p.archived_at).map((p) => [p.brand, p.name].filter(Boolean).join(" ")), ...v.terms])]
      .filter(Boolean)
      .slice(0, 150);
    return ok({ text: await correctSpeech({ phrase: v.phrase, context: v.context, glossary }) });
  });
}
