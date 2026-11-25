"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok } from "@/lib/action";
import { getCtx } from "@/lib/db";
import { normalizeKey } from "@/lib/format";
import { candidateKey, priceAmount } from "@/lib/import/parse";
import { TEMPLATE_KINDS } from "@/lib/templates";
import { mkBlock } from "@/lib/schemas/card";
import { logActivity } from "@/lib/services/activity";

/**
 * Import of reference cards (ADR-008). Personal data of the source patient is stored ONLY in the import
 * record (`patient_data`) and never reaches candidates, templates or the catalog. Nothing is added to the
 * shared library without the specialist ticking it and pressing the confirm button.
 */

const Parsed = z.object({
  pages: z.number().int().min(1).max(200),
  patient: z.object({ fullName: z.string().max(300), lines: z.array(z.string().max(400)).max(60) }),
  sections: z.record(z.string(), z.array(z.string().max(4000)).max(200)),
  products: z.array(z.object({ name: z.string().max(300), price: z.string().max(80), isAlternative: z.boolean() })).max(200),
  procedures: z.array(z.object({ name: z.string().max(1000), price: z.string().max(80), isAlternative: z.boolean() })).max(200),
  unrecognised: z.array(z.number()).max(200),
});

const SaveInput = z.object({
  fileName: z.string().trim().min(1).max(200),
  sourceHash: z.string().length(64),
  parsed: Parsed,
});

export interface ImportSummary {
  id: string;
  fileName: string;
  pages: number;
  status: string;
  importedAt: string;
  candidates: number;
  pending: number;
}

export async function saveImportAction(input: unknown) {
  return guard<{ id: string; duplicate: boolean; candidates: number; merged: number }>(async () => {
    const ctx = await getCtx();
    const v = SaveInput.parse(input);
    const existing = (await ctx.db.select<{ source_hash: string }>("pdf_imports", { where: { source_hash: v.sourceHash } }))[0];
    if (existing) return ok({ id: existing.id, duplicate: true, candidates: 0, merged: 0 });

    const row = await ctx.db.insert("pdf_imports", {
      file_name: v.fileName,
      source_hash: v.sourceHash,
      pages: v.parsed.pages,
      status: "parsed",
      patient_data: v.parsed.patient, // personal data lives here and only here
      draft: { unrecognised: v.parsed.unrecognised },
      imported_at: new Date().toISOString(),
      reviewed_at: null,
    });

    type Cand = { kind: "text_block" | "product" | "procedure"; section: string; payload: unknown; text: string };
    const cands: Cand[] = [];
    for (const [section, paras] of Object.entries(v.parsed.sections)) {
      for (const text of paras) if (text.trim().length >= 20) cands.push({ kind: "text_block", section, payload: { text }, text });
    }
    for (const p of v.parsed.products) cands.push({ kind: "product", section: "products", payload: p, text: p.name });
    for (const p of v.parsed.procedures) cands.push({ kind: "procedure", section: "procedures", payload: p, text: p.name });

    // Repeated blocks/products are folded into one candidate (counted), never duplicated.
    const known = new Map<string, { id: string; occurrences: number }>();
    for (const c of await ctx.db.select<{ content_key: string; occurrences: number }>("knowledge_candidates")) {
      known.set(c.content_key, { id: c.id, occurrences: c.occurrences });
    }
    let created = 0;
    let merged = 0;
    for (const c of cands) {
      const key = candidateKey(c.kind, c.text);
      const hit = known.get(key);
      if (hit) {
        hit.occurrences += 1;
        await ctx.db.update("knowledge_candidates", hit.id, { occurrences: hit.occurrences });
        merged++;
        continue;
      }
      const r = await ctx.db.insert("knowledge_candidates", {
        import_id: row.id,
        kind: c.kind,
        section: c.section,
        payload: c.payload,
        content_key: key,
        occurrences: 1,
        review_status: "pending",
        merged_into: null,
      });
      known.set(key, { id: r.id, occurrences: 1 });
      created++;
    }
    await logActivity(ctx, "import.parse", "pdf_import", row.id, { candidates: created, merged });
    revalidatePath("/import");
    return ok({ id: row.id, duplicate: false, candidates: created, merged });
  });
}

export async function listImportsAction() {
  return guard<ImportSummary[]>(async () => {
    const ctx = await getCtx();
    const [imports, cands] = await Promise.all([
      ctx.db.select<{ file_name: string; pages: number; status: string; imported_at: string }>("pdf_imports", { order: { col: "imported_at" } }),
      ctx.db.select<{ import_id: string | null; review_status: string }>("knowledge_candidates"),
    ]);
    return ok(
      imports.map((i) => {
        const mine = cands.filter((c) => c.import_id === i.id);
        return {
          id: i.id,
          fileName: i.file_name,
          pages: i.pages,
          status: i.status,
          importedAt: i.imported_at,
          candidates: mine.length,
          pending: mine.filter((c) => c.review_status === "pending").length,
        };
      }),
    );
  });
}

export interface CandidateItem {
  id: string;
  kind: "text_block" | "product" | "procedure";
  section: string;
  text: string;
  price: string;
  isAlternative: boolean;
  occurrences: number;
  status: string;
  /** Already present in the library / catalog (would be a duplicate). */
  inLibrary: boolean;
}

export async function getImportAction(id: string) {
  return guard<{ summary: { fileName: string; pages: number; importedAt: string; status: string; unrecognised: number[] }; patientData: { fullName: string; lines: string[] }; candidates: CandidateItem[] }>(
    async () => {
      const ctx = await getCtx();
      const imp = await ctx.db.get<{ file_name: string; pages: number; imported_at: string; status: string; patient_data: { fullName: string; lines: string[] }; draft: { unrecognised?: number[] } }>("pdf_imports", id);
      if (!imp) return { ok: false as const, error: "Импорт не найден" };
      const [rows, templates, products] = await Promise.all([
        ctx.db.select<{ import_id: string | null; kind: CandidateItem["kind"]; section: string; payload: { text?: string; name?: string; price?: string; isAlternative?: boolean }; occurrences: number; review_status: string; content_key: string }>("knowledge_candidates", { where: { import_id: id } }),
        ctx.db.select<{ content_key: string; archived_at: string | null }>("recommendation_templates"),
        ctx.db.select<{ name: string; brand: string; archived_at: string | null }>("products"),
      ]);
      const tKeys = new Set(templates.filter((t) => !t.archived_at).map((t) => t.content_key));
      const pKeys = new Set(products.filter((p) => !p.archived_at).map((p) => normalizeKey(`${p.brand} ${p.name}`)));
      const candidates = rows.map<CandidateItem>((r) => {
        const text = r.payload.text ?? r.payload.name ?? "";
        const inLibrary = r.kind === "text_block" ? tKeys.has(normalizeKey(text)) : r.kind === "product" ? pKeys.has(normalizeKey(text)) : false;
        return { id: r.id, kind: r.kind, section: r.section, text, price: r.payload.price ?? "", isAlternative: !!r.payload.isAlternative, occurrences: r.occurrences, status: r.review_status, inLibrary };
      });
      return ok({
        summary: { fileName: imp.file_name, pages: imp.pages, importedAt: imp.imported_at, status: imp.status, unrecognised: imp.draft?.unrecognised ?? [] },
        patientData: imp.patient_data,
        candidates,
      });
    },
  );
}

const SECTION_TO_KIND: Record<string, (typeof TEMPLATE_KINDS)[number]> = {
  skin: "skin",
  care: "morning",
  actives: "actives",
  nutrition: "nutrition",
  vitamins: "vitamins",
  conclusion: "conclusion",
};

const Decide = z.object({
  accept: z.array(z.object({ id: z.string(), text: z.string().max(4000), kind: z.enum(TEMPLATE_KINDS).optional(), title: z.string().max(120).optional() })).max(300),
  reject: z.array(z.string()).max(300),
});

/** The specialist's explicit decision: only ticked, reviewed (and possibly edited) items enter the library. */
export async function decideCandidatesAction(importId: string, input: unknown) {
  return guard<{ templates: number; products: number; procedures: number; duplicates: number }>(async () => {
    const ctx = await getCtx();
    const v = Decide.parse(input);
    const patientTokens = new Set<string>();
    for (const p of await ctx.db.select<{ full_name: string }>("patients")) for (const w of normalizeKey(p.full_name).split(" ")) if (w.length >= 4) patientTokens.add(w);
    const imp = await ctx.db.get<{ patient_data: { fullName: string } }>("pdf_imports", importId);
    for (const w of normalizeKey(imp?.patient_data?.fullName ?? "").split(" ")) if (w.length >= 4) patientTokens.add(w);

    const counts = { templates: 0, products: 0, procedures: 0, duplicates: 0 };
    for (const a of v.accept) {
      const cand = await ctx.db.get<{ import_id: string | null; kind: CandidateItem["kind"]; section: string; payload: { price?: string; isAlternative?: boolean } }>("knowledge_candidates", a.id);
      if (!cand || cand.import_id !== importId) continue;
      const text = a.text.trim();
      if (!text) continue;
      const leaked = normalizeKey(text).split(" ").find((w) => patientTokens.has(w));
      if (leaked) throw new Error(`В тексте найдено имя пациента («${leaked}»). Уберите персональные данные и повторите.`);

      if (cand.kind === "text_block") {
        const kind = a.kind ?? SECTION_TO_KIND[cand.section] ?? "skin";
        const key = normalizeKey(text);
        const dup = (await ctx.db.select<{ content_key: string; archived_at: string | null }>("recommendation_templates", { where: { kind, content_key: key } })).find((t) => !t.archived_at);
        if (dup) {
          counts.duplicates++;
          await ctx.db.update("knowledge_candidates", a.id, { review_status: "merged", merged_into: dup.id });
          continue;
        }
        const t = await ctx.db.insert("recommendation_templates", {
          kind,
          title: (a.title?.trim() || text.slice(0, 60)).slice(0, 120),
          body: [mkBlock("p", text)],
          favorite: false,
          use_count: 0,
          source: "import",
          review_status: "approved",
          content_key: key,
          archived_at: null,
        });
        await ctx.db.update("knowledge_candidates", a.id, { review_status: "accepted", merged_into: t.id });
        counts.templates++;
      } else if (cand.kind === "product") {
        const key = normalizeKey(text);
        const dup = (await ctx.db.select<{ name: string; brand: string; archived_at: string | null }>("products")).find((p) => !p.archived_at && normalizeKey(`${p.brand} ${p.name}`) === key);
        if (dup) {
          counts.duplicates++;
          await ctx.db.update("knowledge_candidates", a.id, { review_status: "merged", merged_into: dup.id });
          continue;
        }
        const amount = priceAmount(cand.payload.price ?? "");
        const p = await ctx.db.insert("products", {
          name: text,
          brand: "",
          category_id: null,
          description: "",
          variants: [{ id: crypto.randomUUID(), volume: "", price: { kind: amount ? "fixed" : "text", amount, max: null, text: amount ? "" : (cand.payload.price ?? "").slice(0, 80) } }],
          url: "",
          restrictions: "",
          alternatives: [],
          in_stock: true,
          image_asset_id: null,
          archived_at: null,
        });
        await ctx.db.update("knowledge_candidates", a.id, { review_status: "accepted", merged_into: p.id });
        counts.products++;
      } else {
        const amount = priceAmount(cand.payload.price ?? "");
        const p = await ctx.db.insert("procedures", {
          name: text.slice(0, 200),
          description: text.length > 200 ? text : "",
          sessions: "",
          frequency: "",
          dosage: "",
          volume: "",
          price: { kind: amount ? "fixed" : "text", amount, max: null, text: amount ? "" : (cand.payload.price ?? "").slice(0, 80) },
          archived_at: null,
        });
        await ctx.db.update("knowledge_candidates", a.id, { review_status: "accepted", merged_into: p.id });
        counts.procedures++;
      }
    }
    for (const id of v.reject) await ctx.db.update("knowledge_candidates", id, { review_status: "rejected" });

    const left = await ctx.db.select<{ review_status: string }>("knowledge_candidates", { where: { import_id: importId } });
    if (left.every((c) => c.review_status !== "pending")) await ctx.db.update("pdf_imports", importId, { status: "reviewed", reviewed_at: new Date().toISOString() });
    await logActivity(ctx, "import.review", "pdf_import", importId, { ...counts });
    revalidatePath("/import");
    revalidatePath("/templates");
    revalidatePath("/catalog");
    return ok(counts);
  });
}

/** Removes the import together with the source patient's personal data and every candidate. */
export async function deleteImportAction(importId: string) {
  return guard(async () => {
    const ctx = await getCtx();
    for (const c of await ctx.db.select("knowledge_candidates", { where: { import_id: importId } })) await ctx.db.remove("knowledge_candidates", c.id);
    await ctx.db.remove("pdf_imports", importId);
    await logActivity(ctx, "import.delete", "pdf_import", importId);
    revalidatePath("/import");
    return ok();
  });
}
