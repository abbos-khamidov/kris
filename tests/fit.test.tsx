import path from "node:path";
import React from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { mkBlock } from "../src/lib/schemas/card";
import { CardDocument } from "../src/pdf/CardDocument";
import { computeFit, countPdfPages, type Fit } from "../src/pdf/fit";
import { registerPdfFonts } from "../src/pdf/fonts";
import { sampleSnapshot } from "../src/pdf/sample";
import { FIT_STEPS, MIN_TYPE, fitSize } from "../src/pdf/tokens";

beforeAll(() => registerPdfFonts(path.resolve("public/fonts")));

const toString = async (doc: React.ReactElement) => (await renderToBuffer(doc as never)).toString("latin1");

async function render(snapshot: ReturnType<typeof sampleSnapshot>, fit: Fit) {
  const buf = await renderToBuffer(<CardDocument snapshot={snapshot} fit={fit} />);
  expect(countPdfPages(buf.toString("latin1"))).toBeGreaterThan(0);
  const counted = countPdfPages(buf.toString("latin1"));
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  expect(counted).toBe(doc.numPages);
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    text += ` ${tc.items.map((it) => ("str" in it ? it.str : "")).join(" ")}`;
  }
  return { pages: doc.numPages, text: text.replace(/\s+/g, " ") };
}

const sentence = (i: number) => `Пункт ${i}: очищающий гель наносить на влажную кожу, массировать и смывать тёплой водой.`;
const paragraphs = (n: number) => Array.from({ length: n }, (_, i) => mkBlock("p", sentence(i + 1)));

describe("auto-fit of long text", () => {
  it("the type never becomes unreadably small", () => {
    const min = FIT_STEPS[FIT_STEPS.length - 1];
    expect(fitSize(15, min)).toBeGreaterThanOrEqual(10);
    expect(fitSize(10.5, min)).toBe(MIN_TYPE);
    expect(fitSize(8, min)).toBe(8);
  });

  it("a short card keeps the reference sizes", async () => {
    expect(await computeFit(sampleSnapshot("short-frame"), toString)).toEqual({});
  });

  it("text slightly longer than a page is shrunk to stay on one page", async () => {
    const s = sampleSnapshot("short-frame");
    s.card.skin.blocks = paragraphs(14);
    const plain = await render(s, {});
    expect(plain.pages).toBeGreaterThan(10);
    const fit = await computeFit(s, toString);
    expect(fit.skin).toBeLessThan(1);
    const fitted = await render(s, fit);
    expect(fitted.pages).toBe(10);
    expect(fitted.text).toContain("Пункт 14:");
  });

  it("very long text continues on further pages and nothing is lost, even one huge block", async () => {
    const s = sampleSnapshot("short-frame");
    const huge = `${Array.from({ length: 90 }, (_, i) => sentence(i + 1)).join(" ")} КОНЕЦБЛОКА`;
    s.card.skin.blocks = [mkBlock("note", huge)];
    s.card.nutrition.main = paragraphs(80);
    s.card.personal.allergies = `${"пыльца берёзы и ольхи, ".repeat(12)}КОНЕЦСТРОКИ`;
    s.card.personal.allergiesState = "yes";
    const { pages, text } = await render(s, await computeFit(s, toString));
    expect(pages).toBeGreaterThan(10);
    for (const part of ["КОНЕЦБЛОКА", "Пункт 80:", "КОНЕЦСТРОКИ", "Связаться со мной"]) expect(text).toContain(part);
  });
});
