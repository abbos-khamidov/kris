import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { CardDocument } from "../src/pdf/CardDocument";
import { registerPdfFonts } from "../src/pdf/fonts";
import { sampleSnapshot, type SampleKind } from "../src/pdf/sample";

beforeAll(() => registerPdfFonts(path.resolve("public/fonts")));

async function render(kind: SampleKind) {
  const buf = await renderToBuffer(<CardDocument snapshot={sampleSnapshot(kind)} />);
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  const pages = [] as { text: string; links: string[]; w: number; h: number }[];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const links = (await page.getAnnotations()).filter((a) => a.url).map((a) => a.url as string);
    pages.push({ text: tc.items.map((it) => ("str" in it ? it.str : "")).join(" "), links, w: page.view[2], h: page.view[3] });
  }
  return { buf, pages };
}

describe("PDF renderer (single renderer for preview, download, share, storage)", () => {
  it("short card: exactly 10 pages, 595x822, selectable Cyrillic text, ruble sign", async () => {
    const { pages } = await render("short-frame");
    expect(pages).toHaveLength(10);
    for (const p of pages) expect([p.w, p.h]).toEqual([595, 822]);
    const all = pages.map((p) => p.text).join(" ");
    expect(all).toContain("Вымышленная Анна");
    expect(all).toContain("ЛИЧНЫЕ ДАННЫЕ");
    expect(all).toContain("РЕКОМЕНДОВАННЫЕ СРЕДСТВА");
    expect(all).toContain("₽");
    expect(all).toContain("Связаться со мной");
  });

  it("the contact button is a real link on the last page", async () => {
    const { pages } = await render("short-frame");
    expect(pages.at(-1)!.links).toContain("https://example.com/contact");
  });

  it("long card: overflow continues on extra pages, nothing is dropped", async () => {
    const { pages } = await render("long-burgundy-bottom");
    expect(pages.length).toBeGreaterThan(10);
    const all = pages.map((p) => p.text).join(" ");
    expect(all).toContain("(продолжение)");
    // all 24 products and all 8 procedures are present
    expect(all).toContain("номер 24");
    expect(all).toContain("Тестовая процедура 8");
    // long name is present in full
    expect(all).toContain("Младшая");
  });

  it("prices are never split across lines (ranges stay in one text run)", async () => {
    const { pages } = await render("mixed-burgundy-top");
    const all = pages.map((p) => p.text).join(" ").replace(/\s+/g, " ");
    expect(all).toMatch(/8\s500\s–\s13\s000\s₽/);
  });

  it("the renderer never depends on the website theme", () => {
    const dir = path.resolve("src/pdf");
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect(src, f).not.toMatch(/lib\/theme|theme-provider|next-themes|globals\.css|var\(--/);
    }
  });
});
