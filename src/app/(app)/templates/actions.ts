"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok } from "@/lib/action";
import { getCtx } from "@/lib/db";
import { normalizeKey } from "@/lib/format";
import { Block } from "@/lib/schemas/card";
import { TEMPLATE_KINDS, type TemplateKind } from "@/lib/templates";
import { stripInline } from "@/pdf/inline";
import { logActivity } from "@/lib/services/activity";

export interface TemplateItem {
  id: string;
  kind: TemplateKind;
  title: string;
  favorite: boolean;
  useCount: number;
  source: string;
  preview: string;
  reviewStatus: string;
}

interface Row {
  kind: TemplateKind;
  title: string;
  body: unknown;
  favorite: boolean;
  use_count: number;
  source: string;
  review_status: string;
  archived_at: string | null;
  content_key: string;
}

/** Flattens any template body to searchable text. */
function bodyText(body: unknown): string {
  if (body == null) return "";
  if (typeof body === "string") return stripInline(body);
  if (Array.isArray(body)) return body.map(bodyText).join(" ");
  if (typeof body === "object") return Object.values(body as Record<string, unknown>).map(bodyText).join(" ");
  return "";
}

const toItem = (r: Row & { id: string }): TemplateItem => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  favorite: r.favorite,
  useCount: r.use_count,
  source: r.source,
  preview: bodyText(r.body).replace(/\s+/g, " ").slice(0, 160),
  reviewStatus: r.review_status,
});

export async function listTemplatesAction(input: { kind?: string; q?: string } = {}) {
  return guard<TemplateItem[]>(async () => {
    const ctx = await getCtx();
    const kind = input.kind ? z.enum(TEMPLATE_KINDS).parse(input.kind) : undefined;
    const rows = await ctx.db.select<Row>("recommendation_templates", {
      where: kind ? { kind } : undefined,
      order: { col: "updated_at" },
      limit: 500,
    });
    const q = (input.q ?? "").trim().toLowerCase();
    const items = rows
      .filter((r) => !r.archived_at && r.review_status === "approved")
      .map(toItem)
      .filter((t) => !q || `${t.title} ${t.preview}`.toLowerCase().includes(q));
    // favourites first, then the most used
    items.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.useCount - a.useCount);
    return ok(items);
  });
}

export async function getTemplateAction(id: string, countUse = true) {
  return guard<{ title: string; kind: TemplateKind; body: unknown }>(async () => {
    const ctx = await getCtx();
    const r = await ctx.db.get<Row>("recommendation_templates", id);
    if (!r || r.archived_at) return { ok: false as const, error: "Шаблон не найден" };
    if (countUse) await ctx.db.update("recommendation_templates", id, { use_count: r.use_count + 1 });
    return ok({ title: r.title, kind: r.kind, body: r.body });
  });
}

const Save = z.object({
  id: z.string().optional(),
  kind: z.enum(TEMPLATE_KINDS),
  title: z.string().trim().min(2, "Укажите название шаблона").max(120),
  body: z.unknown(),
});

/** Words of every patient's name; a template containing one is rejected (de-identification guard). */
async function patientNameTokens(ctx: Awaited<ReturnType<typeof getCtx>>) {
  const patients = await ctx.db.select<{ full_name: string }>("patients");
  const set = new Set<string>();
  for (const p of patients) for (const w of normalizeKey(p.full_name).split(" ")) if (w.length >= 4) set.add(w);
  return set;
}

export async function saveTemplateAction(input: unknown) {
  return guard<{ id: string; duplicate: boolean }>(async () => {
    const ctx = await getCtx();
    const v = Save.parse(input);
    if (JSON.stringify(v.body ?? null).length > 200_000) return { ok: false as const, error: "Шаблон слишком большой" };

    const text = normalizeKey(`${v.title} ${bodyText(v.body)}`);
    const names = await patientNameTokens(ctx);
    const hit = text.split(" ").filter((w) => names.has(w));
    if (hit.length) {
      return { ok: false as const, error: `В шаблоне найдено имя пациента («${[...new Set(hit)].slice(0, 3).join("», «")}»). Уберите персональные данные.` };
    }

    const key = normalizeKey(bodyText(v.body));
    if (!v.id && key) {
      const same = (await ctx.db.select<Row>("recommendation_templates", { where: { kind: v.kind, content_key: key } })).find((r) => !r.archived_at);
      if (same) return ok({ id: same.id, duplicate: true });
    }
    const values = { kind: v.kind, title: v.title, body: v.body ?? [], content_key: key, source: "manual", review_status: "approved" };
    const row = v.id
      ? await ctx.db.update("recommendation_templates", v.id, values)
      : await ctx.db.insert("recommendation_templates", { ...values, favorite: false, use_count: 0, archived_at: null });
    await logActivity(ctx, "template.save", "template", row.id, { kind: v.kind });
    revalidatePath("/templates");
    return ok({ id: row.id, duplicate: false });
  });
}

export async function toggleFavoriteAction(id: string) {
  return guard(async () => {
    const ctx = await getCtx();
    const r = await ctx.db.get<Row>("recommendation_templates", id);
    if (!r) return { ok: false as const, error: "Шаблон не найден" };
    await ctx.db.update("recommendation_templates", id, { favorite: !r.favorite });
    revalidatePath("/templates");
    return ok();
  });
}

export async function archiveTemplateAction(id: string) {
  return guard(async () => {
    const ctx = await getCtx();
    await ctx.db.update("recommendation_templates", id, { archived_at: new Date().toISOString() });
    await logActivity(ctx, "template.archive", "template", id);
    revalidatePath("/templates");
    return ok();
  });
}

export interface PastFragment {
  id: string;
  section: string;
  text: string;
  blocks: Block[];
  approvedAt: string;
}

const SECTIONS: [string, (c: Record<string, unknown>) => unknown][] = [
  ["Состояние кожи", (c) => (c.skin as { blocks?: unknown })?.blocks],
  ["Утренний уход", (c) => (c.care as { morning?: unknown })?.morning],
  ["Вечерний уход", (c) => (c.care as { evening?: unknown })?.evening],
  ["Активы", (c) => (c.actives as { blocks?: unknown })?.blocks],
  ["Питание", (c) => (c.nutrition as { main?: unknown })?.main],
  ["Витамины", (c) => (c.vitamins as { supplements?: unknown })?.supplements],
  ["Анализы", (c) => (c.vitamins as { tests?: unknown })?.tests],
  ["Заключение", (c) => (c.conclusion as { blocks?: unknown })?.blocks],
];

/** Search across the text of previously APPROVED cards (latest version of each) to reuse a fragment. */
export async function searchApprovedAction(q: string) {
  return guard<PastFragment[]>(async () => {
    const ctx = await getCtx();
    const needle = z.string().max(100).parse(q).trim().toLowerCase();
    const versions = await ctx.db.select<{ card_id: string; version: number; snapshot: { card?: Record<string, unknown> }; approved_at: string }>(
      "card_versions",
      { order: { col: "approved_at" }, limit: 200 },
    );
    const latest = new Map<string, (typeof versions)[number]>();
    for (const v of versions) if (!latest.has(v.card_id)) latest.set(v.card_id, v);
    const out: PastFragment[] = [];
    for (const v of latest.values()) {
      const card = v.snapshot?.card;
      if (!card) continue;
      for (const [section, pick] of SECTIONS) {
        const parsed = z.array(Block).safeParse(pick(card));
        if (!parsed.success || parsed.data.length === 0) continue;
        const text = bodyText(parsed.data).replace(/\s+/g, " ").trim();
        if (!text || (needle && !text.toLowerCase().includes(needle))) continue;
        out.push({ id: `${v.id}:${section}`, section, text: text.slice(0, 220), blocks: parsed.data, approvedAt: v.approved_at });
      }
    }
    return ok(out.slice(0, 40));
  });
}
